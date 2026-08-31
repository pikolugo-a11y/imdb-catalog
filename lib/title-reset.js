import 'server-only';
import {db} from './db';

const imdbOk=value=>/^tt\d+$/.test(String(value||''));
const PRESERVE_TABLES=new Set(['process_runs','process_run_events','process_run_errors','admin_events','pipeline_runs']);
const RESET_TABLES=new Set([
  'identity_validation','catalog_lifecycle','movie_metadata','movie_genres','movie_credits','movie_collections',
  'acquisition_status','acquisition_priority_snapshots','saga_universe_titles','catalog_exclusions','plex_catalog_status',
  'plex_manual_overrides','series_reference','saga_collection_members','movies',
  'movie_countries','movie_country_names','movie_genre_names','movie_genres_canonical','title_ratings',
  'movie_file_validation','movie_quality_findings'
]);
const MOV003_PRESERVE_TABLES=new Set([...PRESERVE_TABLES,'plex_manual_overrides']);
const MOV003_RESET_TABLES=new Set([...RESET_TABLES].filter(x=>x!=='catalog_exclusions'&&x!=='plex_manual_overrides'));

const quoteIdent=value=>{const v=String(value||'');if(!/^[a-z_][a-z0-9_]*$/.test(v))throw new Error(`Identificador SQL no permitido: ${v}`);return `"${v}"`};

export async function getResetCandidate(imdbId){
  const id=String(imdbId||'').trim();if(!imdbOk(id))throw new Error('IMDb ID inválido');
  const sql=db();
  const[movie]=await sql`SELECT imdb_id,type,COALESCE(title_es,title,original_title) AS display_title,original_title,year,tmdb_id,inclusion_origin,origin,final_rating FROM movies WHERE imdb_id=${id} LIMIT 1`;
  if(!movie)return null;
  const[candidate]=await sql`SELECT candidate_type,year,imdb_rating,imdb_votes,source_snapshot,eligibility_status FROM catalog_candidates WHERE imdb_id=${id} LIMIT 1`;
  return{movie,candidate:candidate||null};
}

async function relationsWithImdbRows(sql,imdbId,{preserveTables=PRESERVE_TABLES,includeCandidates=false}={}){
  const relations=await sql`
    SELECT DISTINCT c.table_name,t.table_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='imdb_id'
    ORDER BY c.table_name`;
  const baseTables=[];const views=[];
  for(const row of relations){
    const name=String(row.table_name||'');if(!name||preserveTables.has(name)||(!includeCandidates&&name==='catalog_candidates'))continue;
    const q=`SELECT 1 AS hit FROM ${quoteIdent(name)} WHERE imdb_id=$1 LIMIT 1`;
    const hit=await sql.unsafe(q,[imdbId]);if(!hit?.length)continue;
    if(String(row.table_type||'').toUpperCase()==='BASE TABLE')baseTables.push(name);else views.push(name);
  }
  return{baseTables,views};
}

function candidateType(type){return type==='Película'?'movie':type==='Miniserie'?'tvMiniSeries':'tvSeries'}

async function recoverExistingResetCandidate(sql,id,trace){
  const[c]=await sql`SELECT imdb_id,candidate_type,year,eligibility_status,source_snapshot FROM catalog_candidates WHERE imdb_id=${id} LIMIT 1`;
  const source=c?.source_snapshot||{};
  if(!c||source.resetFromOperations!==true)return null;
  const recoveredAt=new Date().toISOString();
  await trace?.event?.({eventType:'step_started',step:'recover_reset_candidate',message:'Normalizando candidato ya reiniciado en Novedades'});
  const merged={...source,manual:true,manualActive:true,matchedRule:'manual',origin:'manual_reset',authoritativeStatus:'complete',manualAuthoritativeResolvedAt:source.manualAuthoritativeResolvedAt||recoveredAt,resetFromOperations:true};
  await sql`UPDATE catalog_candidates SET eligibility_status='eligible',processed_at=NULL,source_snapshot=${JSON.stringify(merged)}::jsonb,last_evaluated_at=now(),updated_at=now() WHERE imdb_id=${id}`;
  await trace?.event?.({eventType:'step_completed',step:'recover_reset_candidate',message:'Candidato de Novedades recuperado y listo para añadir',data:{eligibility_status:'eligible',authoritative_status:'complete'}});
  return{before:{imdb_id:id,location:'novedades',eligibility_status:c.eligibility_status},after:{imdb_id:id,location:'novedades',eligibility_status:'eligible',candidate_type:c.candidate_type,year:c.year,news_state:'eligible'},tablesCleared:[],derivedViews:[],recovered:true};
}

export async function resetTitleToNews(imdbId,trace=null){
  const id=String(imdbId||'').trim();if(!imdbOk(id))throw new Error('IMDb ID inválido');
  const sql=db();
  const snapshot=await getResetCandidate(id);
  if(!snapshot){const recovered=await recoverExistingResetCandidate(sql,id,trace);if(recovered)return recovered;throw new Error('Título no encontrado en catálogo ni como candidato reiniciado')}
  const title=snapshot.movie.display_title||snapshot.movie.original_title||id;
  const source=snapshot.candidate?.source_snapshot||{};
  const resetAt=new Date().toISOString();
  const candidate={candidate_type:snapshot.candidate?.candidate_type||candidateType(snapshot.movie.type),year:snapshot.candidate?.year??snapshot.movie.year??null,imdb_rating:snapshot.candidate?.imdb_rating??null,imdb_votes:snapshot.candidate?.imdb_votes??null,source_snapshot:{...source,title:source.title||title,originalTitle:source.originalTitle||snapshot.movie.original_title||title,manual:true,manualActive:true,matchedRule:'manual',origin:'manual_reset',authoritativeStatus:'complete',manualAuthoritativeResolvedAt:resetAt,resetFromOperations:true,resetAt}};

  await trace?.event?.({eventType:'step_started',step:'reset_preflight',message:'Comprobando dependencias antes del reinicio'});
  const{baseTables,views}=await relationsWithImdbRows(sql,id);
  const unknown=baseTables.filter(t=>!RESET_TABLES.has(t));
  if(unknown.length){const e=new Error(`Reinicio bloqueado: existen dependencias persistentes no contempladas (${unknown.join(', ')})`);e.processStep='reset_preflight';e.detail={unknown_tables:unknown,derived_views:views};throw e}
  await trace?.event?.({eventType:'step_completed',step:'reset_preflight',message:'Dependencias verificadas',data:{tables:baseTables,derived_views:views}});

  await trace?.event?.({eventType:'step_started',step:'reset_catalog_state',message:'Retirando estado derivado y recreando candidato de Novedades'});
  const findingIds=(await sql`SELECT id FROM movie_quality_findings WHERE imdb_id=${id}`).map(x=>Number(x.id)).filter(Number.isFinite);
  const ratingKeys=(await sql`SELECT DISTINCT rating_key FROM plex_items p JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' AND x.external_id=${id}`).map(x=>String(x.rating_key)).filter(Boolean);
  const ops=[];
  if(findingIds.length)ops.push(sql`DELETE FROM movie_quality_actions WHERE finding_id=ANY(${findingIds}::bigint[])`);
  if(ratingKeys.length)ops.push(sql`DELETE FROM piko_quality WHERE rating_key=ANY(${ratingKeys}::text[])`);
  for(const table of baseTables.filter(t=>t!=='movies'))ops.push(sql.unsafe(`DELETE FROM ${quoteIdent(table)} WHERE imdb_id=$1`,[id]));
  ops.push(sql`DELETE FROM movies WHERE imdb_id=${id}`);
  ops.push(sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,processed_at,source_snapshot,created_at,updated_at) VALUES(${id},${candidate.candidate_type},${candidate.year},${candidate.imdb_rating},${candidate.imdb_votes},'eligible',now(),now(),now(),now(),NULL,${JSON.stringify(candidate.source_snapshot)}::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=EXCLUDED.candidate_type,year=EXCLUDED.year,imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,eligibility_status='eligible',last_seen_at=now(),became_eligible_at=now(),last_evaluated_at=now(),processed_at=NULL,source_snapshot=${JSON.stringify(candidate.source_snapshot)}::jsonb,updated_at=now()`);
  await sql.transaction(ops);
  await trace?.event?.({eventType:'step_completed',step:'reset_catalog_state',message:'Estado derivado retirado y candidato recreado',data:{tables:baseTables,derived_views:views}});

  await trace?.event?.({eventType:'step_started',step:'verify_reset',message:'Verificando estado final en Novedades'});
  const[after]=await sql`SELECT imdb_id,eligibility_status,candidate_type,year,source_snapshot FROM catalog_candidates WHERE imdb_id=${id}`;
  const[movieAfter]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${id}`;
  if(!after||after.eligibility_status!=='eligible'||after.source_snapshot?.authoritativeStatus!=='complete'||!after.source_snapshot?.manualAuthoritativeResolvedAt||movieAfter)throw new Error('El reinicio no terminó en un candidato manual listo y elegible');
  await trace?.event?.({eventType:'step_completed',step:'verify_reset',message:'Título devuelto a Novedades y listo para añadir',data:{eligibility_status:after.eligibility_status,candidate_type:after.candidate_type,authoritative_status:after.source_snapshot?.authoritativeStatus}});
  return{before:{imdb_id:id,title,type:snapshot.movie.type,year:snapshot.movie.year,tmdb_id:snapshot.movie.tmdb_id||null,inclusion_origin:snapshot.movie.inclusion_origin||null},after:{imdb_id:id,location:'novedades',eligibility_status:'eligible',candidate_type:after.candidate_type,year:after.year,news_state:'eligible'},tablesCleared:baseTables,derivedViews:views,recovered:false};
}

async function existingPhysicalIdentity(sql,id){
  const rows=await sql`SELECT DISTINCT p.rating_key,x.external_id AS imdb_id,o.imdb_id AS manual_imdb FROM plex_items p LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' LEFT JOIN plex_manual_overrides o ON o.rating_key=p.rating_key WHERE p.active AND p.item_type='movie' AND (x.external_id=${id} OR o.imdb_id=${id})`;
  return rows.map(r=>({rating_key:String(r.rating_key),imdb_id:r.imdb_id||null,manual_imdb:r.manual_imdb||null}));
}

export async function resetTitleForFullReprocessing(imdbId,trace=null){
  const id=String(imdbId||'').trim();if(!imdbOk(id))throw new Error('IMDb ID inválido');
  const sql=db(),snapshot=await getResetCandidate(id),physical=await existingPhysicalIdentity(sql,id);
  if(!snapshot){
    if(physical.length){return{before:{imdb_id:id,location:'outside_catalog'},after:{imdb_id:id,location:'awaiting_plex_sync',next:'plex_sync_to_news'},tablesCleared:[],derivedViews:[],physicalIdentity:physical,recovered:true}}
    throw new Error('Título no encontrado en catálogo ni asociado actualmente a Plex');
  }
  if(snapshot.movie.type!=='Película')throw new Error('MOV-003 sólo aplica a películas');
  if(!physical.length)throw new Error('No existe una identidad física Plex activa que preservar para esta película');
  const[excluded]=await sql`SELECT imdb_id,reason FROM catalog_exclusions WHERE imdb_id=${id} LIMIT 1`;
  if(excluded){const e=new Error('Reinicio bloqueado: el título está excluido. Restaura primero la exclusión antes de reprocesarlo.');e.processStep='reset_preflight';throw e}

  await trace?.event?.({eventType:'step_started',step:'reset_preflight',message:'Comprobando dependencias y preservación de identidad Plex'});
  const{baseTables,views}=await relationsWithImdbRows(sql,id,{preserveTables:MOV003_PRESERVE_TABLES,includeCandidates:true});
  const unknown=baseTables.filter(t=>!MOV003_RESET_TABLES.has(t)&&t!=='catalog_candidates');
  if(unknown.length){const e=new Error(`Reinicio bloqueado: existen dependencias persistentes no contempladas (${unknown.join(', ')})`);e.processStep='reset_preflight';e.detail={unknown_tables:unknown,derived_views:views};throw e}
  await trace?.event?.({eventType:'step_completed',step:'reset_preflight',message:'Dependencias verificadas; Plex e identidad externa se conservarán',data:{tables:baseTables,derived_views:views,physical_identity:physical}});

  const findingIds=(await sql`SELECT id FROM movie_quality_findings WHERE imdb_id=${id}`).map(x=>Number(x.id)).filter(Number.isFinite);
  const ratingKeys=[...new Set(physical.map(x=>x.rating_key))];
  await trace?.event?.({eventType:'step_started',step:'reset_full_reprocessing',message:'Eliminando estado funcional derivado del título'});
  const ops=[];
  if(findingIds.length)ops.push(sql`DELETE FROM movie_quality_actions WHERE finding_id=ANY(${findingIds}::bigint[])`);
  if(ratingKeys.length)ops.push(sql`DELETE FROM piko_quality WHERE rating_key=ANY(${ratingKeys}::text[])`);
  ops.push(sql`DELETE FROM catalog_candidates WHERE imdb_id=${id}`);
  for(const table of baseTables.filter(t=>!['movies','catalog_candidates'].includes(t)))ops.push(sql.unsafe(`DELETE FROM ${quoteIdent(table)} WHERE imdb_id=$1`,[id]));
  ops.push(sql`DELETE FROM movies WHERE imdb_id=${id}`);
  await sql.transaction(ops);
  await trace?.event?.({eventType:'step_completed',step:'reset_full_reprocessing',message:'Estado funcional retirado; identidad Plex preservada',data:{tables:baseTables,rating_keys:ratingKeys}});

  await trace?.event?.({eventType:'step_started',step:'verify_reset',message:'Verificando que el título queda fuera del catálogo y sigue identificado en Plex'});
  const[movieAfter]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${id}`;
  const[candidateAfter]=await sql`SELECT imdb_id FROM catalog_candidates WHERE imdb_id=${id}`;
  const physicalAfter=await existingPhysicalIdentity(sql,id);
  if(movieAfter||candidateAfter||!physicalAfter.length)throw new Error('El reinicio completo no dejó el estado esperado para el siguiente Plex Sync');
  await trace?.event?.({eventType:'step_completed',step:'verify_reset',message:'Título listo para volver a entrar por el próximo Plex Sync manual',data:{next:'plex_sync_to_news',physical_identity:physicalAfter}});
  return{before:{imdb_id:id,title:snapshot.movie.display_title||snapshot.movie.original_title||id,type:snapshot.movie.type,year:snapshot.movie.year,tmdb_id:snapshot.movie.tmdb_id||null},after:{imdb_id:id,location:'awaiting_plex_sync',next:'plex_sync_to_news'},tablesCleared:baseTables,derivedViews:views,physicalIdentity:physicalAfter,recovered:false};
}
