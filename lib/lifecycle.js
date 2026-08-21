import 'server-only';
import {db} from './db';

export const LIFECYCLE={
  IDENTITY_PENDING:{label:'Identidad pendiente',area:'/calidad/identidad',tone:'warn'},
  IDENTITY_VALIDATION:{label:'Validación pendiente',area:'/calidad/validacion-identidad',tone:'warn'},
  IDENTITY_REVIEW_REQUIRED:{label:'Revisión de identidad',area:'/calidad/validacion-identidad',tone:'bad'},
  DATA_INCOMPLETE:{label:'Datos incompletos',area:'/calidad/datos',tone:'warn'},
  SERIES_SYNC_PENDING:{label:'Serie pendiente de sincronizar',area:'/calidad/series',tone:'warn'},
  SERIES_REVIEW:{label:'Serie requiere revisión',area:'/calidad/series',tone:'bad'},
  TECH_PENDING:{label:'Calidad técnica pendiente',area:'/calidad/pikoquality',tone:'warn'},
  TECH_REVIEW:{label:'Calidad técnica a revisar',area:'/calidad/peliculas',tone:'bad'},
  COMPLETE:{label:'Completa',area:'/catalogo',tone:'ok'},
  EXCLUDED:{label:'Excluida',area:'/catalogo/excluidas',tone:'muted'}
};

const present=v=>v!==null&&v!==undefined&&v!=='';
const positive=v=>v!=null&&Number(v)>0;

function dataComplete(r){
  const required=[
    present(r.title_es),present(r.original_title),Number(r.year)>1800,
    positive(r.imdb_rating),positive(r.imdb_votes),positive(r.fa_rating),positive(r.fa_votes),
    positive(r.tmdb_rating),positive(r.tmdb_votes),positive(r.final_rating),
    positive(r.runtime),present(r.country),Boolean(r.has_genres),present(r.overview),
    Boolean(r.poster_path||r.external_poster_url),present(r.release_date),
    Boolean(r.has_director||r.external_director),Boolean(r.has_cast||r.external_cast)
  ];
  return required.every(Boolean);
}

export function classifyLifecycle(r){
  if(r.excluded)return 'EXCLUDED';
  if(!/^tt\d+$/.test(String(r.imdb_id||''))||!r.tmdb_id||!r.fa_id)return 'IDENTITY_PENDING';
  if(['doubtful','invalid'].includes(String(r.validation_status||'')))return 'IDENTITY_REVIEW_REQUIRED';
  if(String(r.validation_status||'')!=='valid')return 'IDENTITY_VALIDATION';
  if(!dataComplete(r))return 'DATA_INCOMPLETE';
  const inPlex=String(r.plex_status||'')==='in_plex';
  if(!inPlex)return 'COMPLETE';
  if(r.type==='Serie'||r.type==='Miniserie'){
    if(!r.has_series_reference)return 'SERIES_SYNC_PENDING';
    if(Number(r.series_missing||0)>0||Number(r.series_extra||0)>0||Number(r.series_unknown||0)>0)return 'SERIES_REVIEW';
    if(Number(r.pq_pending||0)>0)return 'TECH_PENDING';
    return 'COMPLETE';
  }
  if(!r.pq_status||String(r.pq_status)!=='evaluated')return 'TECH_PENDING';
  if(r.tech_issue)return 'TECH_REVIEW';
  return 'COMPLETE';
}

async function rawRows(ids=null){
  const sql=db();
  const rows=await sql`
    SELECT m.imdb_id,m.type,m.title_es,m.original_title,m.year,m.runtime,m.country,m.final_rating,
      m.imdb_rating,m.imdb_votes,m.fa_id,m.fa_rating,m.fa_votes,m.tmdb_id,m.tmdb_rating,m.tmdb_votes,m.poster_path,
      mm.overview,mm.release_date,iv.validation_status,
      (ex.imdb_id IS NOT NULL) excluded,
      CASE WHEN pcs.status='in_plex' AND EXISTS(SELECT 1 FROM plex_items physical WHERE physical.rating_key=pcs.rating_key AND physical.active AND ((m.type='Película' AND physical.item_type='movie') OR (m.type IN('Serie','Miniserie') AND physical.item_type='show'))) THEN 'in_plex' WHEN pcs.status='in_plex' THEN 'missing' ELSE pcs.status END plex_status,
      pcs.rating_key,pq.status pq_status,
      COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') external_poster_url,
      COALESCE(m.source_status #>> '{data_quality_external_director,value}','') external_director,
      COALESCE(m.source_status #>> '{data_quality_external_cast,value}','') external_cast,
      EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id) has_genres,
      EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='crew' AND c.job='Director') has_director,
      EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='cast') has_cast,
      EXISTS(SELECT 1 FROM movie_quality_findings f WHERE f.imdb_id=m.imdb_id AND f.status IN('pending','waiting_sync','exception')) tech_issue,
      EXISTS(SELECT 1 FROM series_reference sr WHERE sr.imdb_id=m.imdb_id) has_series_reference,
      COALESCE((SELECT count(*) FROM series_reference sr JOIN series_episode_effective_status e ON e.show_rating_key=sr.show_rating_key WHERE sr.imdb_id=m.imdb_id AND e.effective_status='missing_actionable'),0)::int series_missing,
      COALESCE((SELECT count(*) FROM series_reference sr JOIN series_episode_effective_status e ON e.show_rating_key=sr.show_rating_key WHERE sr.imdb_id=m.imdb_id AND e.effective_status='availability_unknown'),0)::int series_unknown,
      COALESCE((SELECT count(*) FROM series_reference sr JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode' LEFT JOIN series_reference_episodes re ON re.show_rating_key=sr.show_rating_key AND re.season_number=p.parent_index AND re.episode_number=p.item_index WHERE sr.imdb_id=m.imdb_id AND re.show_rating_key IS NULL),0)::int series_extra,
      COALESCE((SELECT count(*) FROM series_reference sr JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode' LEFT JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' WHERE sr.imdb_id=m.imdb_id AND q.rating_key IS NULL),0)::int pq_pending
    FROM movies m
    LEFT JOIN movie_metadata mm USING(imdb_id)
    LEFT JOIN identity_validation iv USING(imdb_id)
    LEFT JOIN catalog_exclusions ex USING(imdb_id)
    LEFT JOIN plex_catalog_status pcs USING(imdb_id)
    LEFT JOIN piko_quality pq ON pq.rating_key=pcs.rating_key
    WHERE (${ids}::text[] IS NULL OR m.imdb_id=ANY(${ids}::text[]))`;
  return rows;
}

export async function getLifecycleForIds(ids=[]){
  if(!ids.length)return new Map();
  const rows=await rawRows(ids);
  return new Map(rows.map(r=>{const state=classifyLifecycle(r);return[r.imdb_id,{state,...LIFECYCLE[state]}]}));
}

export async function attachLifecycle(rows=[]){
  const map=await getLifecycleForIds(rows.map(r=>r.imdb_id).filter(Boolean));
  return rows.map(r=>({...r,lifecycle:map.get(r.imdb_id)||{state:'IDENTITY_PENDING',...LIFECYCLE.IDENTITY_PENDING}}));
}

export async function getLifecycleSnapshot(){
  const rows=await rawRows(null),counts={};
  for(const r of rows){const s=classifyLifecycle(r);counts[s]=(counts[s]||0)+1}
  return{total:rows.length,counts,states:Object.entries(LIFECYCLE).map(([state,meta])=>({state,...meta,count:counts[state]||0}))};
}
