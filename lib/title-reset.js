import 'server-only';
import {db} from './db';

const imdbOk=value=>/^tt\d+$/.test(String(value||''));
const PRESERVE_TABLES=new Set(['process_runs','process_run_events','process_run_errors','admin_events','pipeline_runs']);
const RESET_TABLES=new Set([
  'identity_validation','catalog_lifecycle','movie_metadata','movie_genres','movie_credits','movie_collections',
  'acquisition_status','acquisition_priority_snapshots','saga_universe_titles','catalog_exclusions','plex_catalog_status',
  'plex_manual_overrides','series_reference','saga_collection_members','movies',
  'movie_countries','movie_country_names','movie_genre_names','movie_genres_canonical','title_ratings'
]);

const quoteIdent=value=>{const v=String(value||'');if(!/^[a-z_][a-z0-9_]*$/.test(v))throw new Error(`Identificador SQL no permitido: ${v}`);return `"${v}"`};

export async function getResetCandidate(imdbId){
  const id=String(imdbId||'').trim();if(!imdbOk(id))throw new Error('IMDb ID inválido');
  const sql=db();
  const[movie]=await sql`SELECT imdb_id,type,COALESCE(title_es,title,original_title) AS display_title,original_title,year,tmdb_id,inclusion_origin,origin,final_rating FROM movies WHERE imdb_id=${id} LIMIT 1`;
  if(!movie)return null;
  const[candidate]=await sql`SELECT candidate_type,year,imdb_rating,imdb_votes,source_snapshot,eligibility_status FROM catalog_candidates WHERE imdb_id=${id} LIMIT 1`;
  return{movie,candidate:candidate||null};
}

async function relationsWithImdbRows(sql,imdbId){
  const relations=await sql`
    SELECT DISTINCT c.table_name,t.table_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='imdb_id'
    ORDER BY c.table_name`;
  const baseTables=[];const views=[];
  for(const row of relations){
    const name=String(row.table_name||'');if(!name||PRESERVE_TABLES.has(name)||name==='catalog_candidates')continue;
    const q=`SELECT 1 AS hit FROM ${quoteIdent(name)} WHERE imdb_id=$1 LIMIT 1`;
    const hit=await sql.unsafe(q,[imdbId]);if(!hit?.length)continue;
    if(String(row.table_type||'').toUpperCase()==='BASE TABLE')baseTables.push(name);else views.push(name);
  }
  return{baseTables,views};
}

function candidateType(type){return type==='Película'?'movie':type==='Miniserie'?'tvMiniSeries':'tvSeries'}

export async function resetTitleToNews(imdbId,trace=null){
  const id=String(imdbId||'').trim();if(!imdbOk(id))throw new Error('IMDb ID inválido');
  const sql=db();
  const snapshot=await getResetCandidate(id);if(!snapshot)throw new Error('Título no encontrado en catálogo');
  const title=snapshot.movie.display_title||snapshot.movie.original_title||id;
  const source=snapshot.candidate?.source_snapshot||{};
  const candidate={candidate_type:snapshot.candidate?.candidate_type||candidateType(snapshot.movie.type),year:snapshot.candidate?.year??snapshot.movie.year??null,imdb_rating:snapshot.candidate?.imdb_rating??null,imdb_votes:snapshot.candidate?.imdb_votes??null,source_snapshot:{...source,title:source.title||title,originalTitle:source.originalTitle||snapshot.movie.original_title||title,manual:true,manualActive:true,matchedRule:'manual',origin:'manual_reset',resetFromOperations:true,resetAt:new Date().toISOString()}};

  await trace?.event?.({eventType:'step_started',step:'reset_preflight',message:'Comprobando dependencias antes del reinicio'});
  const{baseTables,views}=await relationsWithImdbRows(sql,id);
  const unknown=baseTables.filter(t=>!RESET_TABLES.has(t));
  if(unknown.length){const e=new Error(`Reinicio bloqueado: existen dependencias persistentes no contempladas (${unknown.join(', ')})`);e.processStep='reset_preflight';e.detail={unknown_tables:unknown,derived_views:views};throw e}
  await trace?.event?.({eventType:'step_completed',step:'reset_preflight',message:'Dependencias verificadas',data:{tables:baseTables,derived_views:views}});

  await trace?.event?.({eventType:'step_started',step:'reset_catalog_state',message:'Retirando estado derivado y recreando candidato de Novedades'});
  const ops=[];
  for(const table of baseTables.filter(t=>t!=='movies'))ops.push(sql.unsafe(`DELETE FROM ${quoteIdent(table)} WHERE imdb_id=$1`,[id]));
  ops.push(sql`DELETE FROM movies WHERE imdb_id=${id}`);
  ops.push(sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,processed_at,source_snapshot,created_at,updated_at) VALUES(${id},${candidate.candidate_type},${candidate.year},${candidate.imdb_rating},${candidate.imdb_votes},'eligible',now(),now(),now(),now(),NULL,${JSON.stringify(candidate.source_snapshot)}::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=EXCLUDED.candidate_type,year=EXCLUDED.year,imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,eligibility_status='eligible',last_seen_at=now(),became_eligible_at=now(),last_evaluated_at=now(),processed_at=NULL,source_snapshot=${JSON.stringify(candidate.source_snapshot)}::jsonb,updated_at=now()`);
  await sql.transaction(ops);
  await trace?.event?.({eventType:'step_completed',step:'reset_catalog_state',message:'Estado derivado retirado y candidato recreado',data:{tables:baseTables,derived_views:views}});

  await trace?.event?.({eventType:'step_started',step:'verify_reset',message:'Verificando estado final en Novedades'});
  const[after]=await sql`SELECT imdb_id,eligibility_status,candidate_type,year,source_snapshot FROM catalog_candidates WHERE imdb_id=${id}`;
  const[movieAfter]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${id}`;
  if(!after||after.eligibility_status!=='eligible'||movieAfter)throw new Error('El reinicio no terminó en un candidato elegible limpio');
  await trace?.event?.({eventType:'step_completed',step:'verify_reset',message:'Título devuelto a Novedades',data:{eligibility_status:after.eligibility_status,candidate_type:after.candidate_type}});
  return{before:{imdb_id:id,title,type:snapshot.movie.type,year:snapshot.movie.year,tmdb_id:snapshot.movie.tmdb_id||null,inclusion_origin:snapshot.movie.inclusion_origin||null},after:{imdb_id:id,location:'novedades',eligibility_status:'eligible',candidate_type:after.candidate_type,year:after.year},tablesCleared:baseTables,derivedViews:views};
}
