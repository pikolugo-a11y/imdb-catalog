import 'server-only';
import {db} from './db';
import {isPikoScoreV3Due} from './pikoscore-v3';
import {QUALITY_VERSION} from './pikoquality';
import {dataComplete} from './lifecycle-data-stage.mjs';

export const LIFECYCLE={
  IDENTITY_PENDING:{label:'Identidad pendiente',area:'/calidad/identidad',tone:'warn'},
  IDENTITY_VALIDATION:{label:'Validación pendiente',area:'/calidad/validacion-identidad',tone:'warn'},
  IDENTITY_REVIEW_REQUIRED:{label:'Revisión de identidad',area:'/calidad/validacion-identidad',tone:'bad'},
  DATA_INCOMPLETE:{label:'Datos incompletos',area:'/calidad/datos',tone:'warn'},
  PIKOSCORE_PENDING:{label:'PikoScore pendiente',area:'/calidad/datos',tone:'warn'},
  MOVIE_FILE_PENDING:{label:'Validación de película pendiente',area:'/calidad/peliculas',tone:'warn'},
  MOVIE_FILE_REVIEW:{label:'Archivo de película a revisar',area:'/calidad/peliculas',tone:'bad'},
  SERIES_SYNC_PENDING:{label:'Serie pendiente de sincronizar',area:'/calidad/series',tone:'warn'},
  SERIES_REVIEW:{label:'Serie requiere revisión',area:'/calidad/series',tone:'bad'},
  TECH_PENDING:{label:'PikoQuality pendiente',area:'/calidad/pikoquality',tone:'warn'},
  COMPLETE:{label:'Completa',area:'/catalogo',tone:'ok'},
  EXCLUDED:{label:'Excluida',area:'/catalogo/excluidas',tone:'muted'}
};

export function classifyLifecycle(r){
  if(r.excluded)return 'EXCLUDED';
  if(!/^tt\d+$/.test(String(r.imdb_id||''))||!r.tmdb_id)return 'IDENTITY_PENDING';
  if(['doubtful','invalid'].includes(String(r.validation_status||'')))return 'IDENTITY_REVIEW_REQUIRED';
  if(String(r.validation_status||'')!=='valid')return 'IDENTITY_VALIDATION';
  if(!dataComplete(r))return 'DATA_INCOMPLETE';
  if(isPikoScoreV3Due(r))return 'PIKOSCORE_PENDING';
  const inPlex=String(r.plex_status||'')==='in_plex';if(!inPlex)return 'COMPLETE';
  if(r.type==='Serie'||r.type==='Miniserie'){
    if(!r.has_series_reference)return 'SERIES_SYNC_PENDING';
    if(Number(r.series_missing||0)>0||Number(r.series_extra||0)>0||Number(r.series_unknown||0)>0)return 'SERIES_REVIEW';
    if(Number(r.pq_pending||0)>0)return 'TECH_PENDING';return 'COMPLETE';
  }
  if(!r.file_validation_current)return 'MOVIE_FILE_PENDING';
  if(r.file_validation_issue)return 'MOVIE_FILE_REVIEW';
  if(!r.pq_current)return 'TECH_PENDING';
  return 'COMPLETE';
}

function blockingReason(r,state){
  if(state==='EXCLUDED')return 'Título excluido';
  if(state==='IDENTITY_PENDING')return !/^tt\d+$/.test(String(r.imdb_id||''))?'IMDb inválido o ausente':'Falta identidad: TMDb';
  if(state==='IDENTITY_REVIEW_REQUIRED')return `Validación de identidad: ${r.validation_status||'revisión'}`;
  if(state==='IDENTITY_VALIDATION')return 'Identidad pendiente de validación';
  if(state==='DATA_INCOMPLETE')return 'Ficha de datos incompleta';
  if(state==='PIKOSCORE_PENDING')return 'Datos completos; ratings o PikoScore 3.0 pendientes/caducados';
  if(state==='MOVIE_FILE_PENDING')return 'Archivo físico pendiente de validar';
  if(state==='MOVIE_FILE_REVIEW')return 'Validación del archivo detectó una incidencia';
  if(state==='SERIES_SYNC_PENDING')return 'Falta referencia oficial de serie';
  if(state==='SERIES_REVIEW')return 'Serie con episodios o disponibilidad a revisar';
  if(state==='TECH_PENDING')return 'PikoQuality pendiente para el archivo actual';
  return null;
}

async function rawRows(ids=null){const sql=db();return sql`
  SELECT m.imdb_id,m.type,m.title_es,m.original_title,m.year,m.runtime,m.country,m.final_rating,m.imdb_rating,m.imdb_votes,m.fa_id,m.fa_rating,m.fa_votes,m.tmdb_id,m.tmdb_rating,m.tmdb_votes,m.poster_path,mm.overview,mm.release_date,iv.validation_status,(ex.imdb_id IS NOT NULL) excluded,
    m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_imdb_votes,m.pikoscore_fa_votes,m.pikoscore_tmdb_votes,
    CASE WHEN pcs.status='in_plex' AND EXISTS(SELECT 1 FROM plex_items physical WHERE physical.rating_key=pcs.rating_key AND physical.active AND ((m.type='Película' AND physical.item_type='movie') OR (m.type IN('Serie','Miniserie') AND physical.item_type='show'))) THEN 'in_plex' WHEN pcs.status='in_plex' THEN 'missing' ELSE pcs.status END plex_status,
    pcs.rating_key,physical.fingerprint physical_fingerprint,pq.status pq_status,pq.formula_version pq_formula_version,pq.source_fingerprint pq_source_fingerprint,
    (mfv.rating_key IS NOT NULL AND mfv.source_fingerprint=physical.fingerprint AND mfv.status='checked') file_validation_current,
    EXISTS(SELECT 1 FROM movie_quality_findings f WHERE f.imdb_id=m.imdb_id AND f.finding_type IN('duration','filename','duplicate') AND f.status IN('pending','waiting_sync')) file_validation_issue,
    (pq.status='evaluated' AND pq.formula_version=${QUALITY_VERSION} AND pq.source_fingerprint=physical.fingerprint) pq_current,
    COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') external_poster_url,
    EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id) has_genres,
    EXISTS(SELECT 1 FROM series_reference sr WHERE sr.imdb_id=m.imdb_id) has_series_reference,
    COALESCE((SELECT count(*) FROM series_reference sr JOIN series_episode_effective_status e ON e.show_rating_key=sr.show_rating_key WHERE sr.imdb_id=m.imdb_id AND e.effective_status='missing_actionable'),0)::int series_missing,
    COALESCE((SELECT count(*) FROM series_reference sr JOIN series_episode_effective_status e ON e.show_rating_key=sr.show_rating_key WHERE sr.imdb_id=m.imdb_id AND e.effective_status='availability_unknown'),0)::int series_unknown,
    COALESCE((SELECT count(*) FROM series_reference sr JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode' LEFT JOIN series_reference_episodes re ON re.show_rating_key=sr.show_rating_key AND re.season_number=p.parent_index AND re.episode_number=p.item_index LEFT JOIN series_episode_overrides o ON o.show_rating_key=sr.show_rating_key AND o.season_number=p.parent_index AND o.episode_number=p.item_index WHERE sr.imdb_id=m.imdb_id AND re.show_rating_key IS NULL AND COALESCE(o.decision,'') NOT IN('special','not_needed') AND NOT EXISTS(SELECT 1 FROM series_diagnostics d WHERE d.show_rating_key=sr.show_rating_key AND p.rating_key=ANY(string_to_array(COALESCE(d.covered_by_rating_key,''),',')))),0)::int series_extra,
    COALESCE((SELECT count(*) FROM series_reference sr JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode' LEFT JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=p.fingerprint WHERE sr.imdb_id=m.imdb_id AND q.rating_key IS NULL),0)::int pq_pending
  FROM movies m
  LEFT JOIN movie_metadata mm USING(imdb_id)
  LEFT JOIN identity_validation iv USING(imdb_id)
  LEFT JOIN catalog_exclusions ex USING(imdb_id)
  LEFT JOIN plex_catalog_status pcs USING(imdb_id)
  LEFT JOIN plex_items physical ON physical.rating_key=pcs.rating_key AND physical.active
  LEFT JOIN movie_file_validation mfv ON mfv.rating_key=pcs.rating_key
  LEFT JOIN piko_quality pq ON pq.rating_key=pcs.rating_key
  WHERE (${ids}::text[] IS NULL OR m.imdb_id=ANY(${ids}::text[]))`}

export async function recomputeLifecycleForIds(ids=[]){
  const clean=[...new Set(ids.filter(x=>/^tt\d+$/.test(String(x||''))))];if(!clean.length)return new Map();
  const sql=db(),rows=await rawRows(clean),out=new Map();
  for(const r of rows){const state=classifyLifecycle(r),reason=blockingReason(r,state);const[saved]=await sql`INSERT INTO catalog_lifecycle(imdb_id,lifecycle_state,previous_state,blocking_reason,state_changed_at,computed_at) VALUES(${r.imdb_id},${state},NULL,${reason},now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET previous_state=CASE WHEN catalog_lifecycle.lifecycle_state<>EXCLUDED.lifecycle_state THEN catalog_lifecycle.lifecycle_state ELSE catalog_lifecycle.previous_state END,lifecycle_state=EXCLUDED.lifecycle_state,blocking_reason=EXCLUDED.blocking_reason,state_changed_at=CASE WHEN catalog_lifecycle.lifecycle_state<>EXCLUDED.lifecycle_state THEN now() ELSE catalog_lifecycle.state_changed_at END,computed_at=now() RETURNING imdb_id,lifecycle_state,previous_state,blocking_reason,state_changed_at,computed_at`;out.set(r.imdb_id,{...saved,state:saved.lifecycle_state,...LIFECYCLE[saved.lifecycle_state]})}
  return out;
}

export async function getLifecycleForIds(ids=[]){
  const clean=[...new Set(ids.filter(Boolean))];if(!clean.length)return new Map();const sql=db();
  const rows=await sql`SELECT imdb_id,lifecycle_state,previous_state,blocking_reason,state_changed_at,computed_at FROM catalog_lifecycle WHERE imdb_id=ANY(${clean}::text[])`;
  return new Map(rows.map(r=>[r.imdb_id,{...r,state:r.lifecycle_state,...LIFECYCLE[r.lifecycle_state]}]));
}

export async function attachLifecycle(rows=[]){const map=await getLifecycleForIds(rows.map(r=>r.imdb_id).filter(Boolean));return rows.map(r=>({...r,lifecycle:map.get(r.imdb_id)||{state:'IDENTITY_PENDING',...LIFECYCLE.IDENTITY_PENDING}}))}
export async function reconcileLifecycleBatch({after=null,limit=500}={}){const sql=db();const rows=await sql`SELECT imdb_id FROM movies WHERE (${after}::text IS NULL OR imdb_id>${after}) ORDER BY imdb_id LIMIT ${Math.max(1,Math.min(Number(limit)||500,2000))}`;const ids=rows.map(r=>r.imdb_id);await recomputeLifecycleForIds(ids);return{processed:ids.length,last:ids.at(-1)||null,done:ids.length===0}}
export async function getLifecycleSnapshot(){const sql=db(),counts={};const rows=await sql`SELECT lifecycle_state,count(*)::int count FROM catalog_lifecycle GROUP BY lifecycle_state`;for(const r of rows)counts[r.lifecycle_state]=Number(r.count||0);const[totals]=await sql`SELECT count(*)::int total FROM movies`;const materialized=Object.values(counts).reduce((a,b)=>a+Number(b||0),0);return{total:Number(totals?.total||0),materialized,missing:Math.max(0,Number(totals?.total||0)-materialized),counts,states:Object.entries(LIFECYCLE).map(([state,meta])=>({state,...meta,count:counts[state]||0}))}}
