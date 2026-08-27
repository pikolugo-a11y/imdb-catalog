import 'server-only';
import {db} from './db';
import {PIKOQUALITY_ACTIVE_VERSION} from './pikoquality-version.mjs';

const prioritySql=(ps,pq)=>`CASE WHEN ${ps} IS NULL THEN NULL ELSE round((100 * power(GREATEST(0,LEAST(10,${ps}))/10.0,2.2) * (GREATEST(0,10-(${pq}))/10.0))::numeric,1) END`;

export async function getPikoQualityLibrary({page=1,pageSize=20,q='',kind='',band='',priority='',sort='priority',load=false}={}){
  const sql=db(),safePage=Math.max(1,Number(page)||1),safeSize=Math.min(50,Math.max(10,Number(pageSize)||20));
  const base=`WITH items AS (
    SELECT 'movie'::text kind,p.rating_key::text entity_key,NULL::int season_index,
      COALESCE(m.title_es,m.title,m.original_title,p.plex_title) title,COALESCE(m.year,p.plex_year) item_year,m.final_rating pikoscore,
      q.score/10.0 pikoquality,q.band,p.rating_key::text href_key
    FROM plex_items p
    JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
    JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=$1 AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
    LEFT JOIN LATERAL(SELECT external_id FROM plex_external_ids WHERE rating_key=p.rating_key AND provider='imdb' LIMIT 1)x ON true
    LEFT JOIN movies m ON m.imdb_id=x.external_id
    WHERE p.active AND p.item_type='movie'
    UNION ALL
    SELECT 'season'::text kind,a.entity_key,a.season_index,
      COALESCE(m.title_es,m.title,m.original_title,sh.plex_title)||' · Temporada '||a.season_index,
      COALESCE(m.year,sh.plex_year),m.final_rating,a.score/10.0,a.band,a.parent_key
    FROM piko_quality_aggregates a
    JOIN plex_items sh ON sh.rating_key=a.parent_key AND sh.active AND sh.item_type='show'
    LEFT JOIN LATERAL(SELECT external_id FROM plex_external_ids WHERE rating_key=sh.rating_key AND provider='imdb' LIMIT 1)x ON true
    LEFT JOIN movies m ON m.imdb_id=x.external_id
    WHERE a.formula_version=$1 AND a.entity_type='season'
  ), scored AS (SELECT *,${prioritySql('pikoscore','pikoquality')} priority_score FROM items)`;
  const [summary]=await sql.query(`${base} SELECT count(*)::int total,round(avg(pikoquality)::numeric,2) avg_quality,count(*) FILTER(WHERE band='fail')::int fail,count(*) FILTER(WHERE priority_score>=40)::int high_priority,count(*) FILTER(WHERE priority_score>=30 AND priority_score<40)::int medium_priority,count(*) FILTER(WHERE kind='movie')::int movies,count(*) FILTER(WHERE kind='season')::int seasons, json_build_object('fail',count(*) FILTER(WHERE band='fail'),'sufficient',count(*) FILTER(WHERE band='sufficient'),'good',count(*) FILTER(WHERE band='good'),'notable',count(*) FILTER(WHERE band='notable'),'outstanding',count(*) FILTER(WHERE band='outstanding'),'honors',count(*) FILTER(WHERE band='honors')) distribution FROM scored`,[PIKOQUALITY_ACTIVE_VERSION]);
  if(!load)return{summary:summary||{},rows:[],total:0,page:1,pageCount:1};
  const params=[PIKOQUALITY_ACTIVE_VERSION],where=[];const add=(v,fn)=>{params.push(v);where.push(fn(params.length))};
  if(q.trim())add(`%${q.trim()}%`,i=>`title ILIKE $${i}`);if(kind)add(kind,i=>`kind=$${i}`);if(band)add(band,i=>`band=$${i}`);
  if(priority==='high')where.push(`priority_score>=40`);else if(priority==='medium')where.push(`priority_score>=30 AND priority_score<40`);else if(priority==='low')where.push(`priority_score<30 OR priority_score IS NULL`);
  const w=where.length?`WHERE ${where.join(' AND ')}`:'';
  const [{total=0}={}]=await sql.query(`${base} SELECT count(*)::int total FROM scored ${w}`,params);const n=Number(total),pageCount=Math.max(1,Math.ceil(n/safeSize)),effective=Math.min(safePage,pageCount),offset=(effective-1)*safeSize;
  const order=sort==='quality'?'pikoquality ASC,title':sort==='pikoscore'?'pikoscore DESC NULLS LAST,title':sort==='title'?'title ASC':`priority_score DESC NULLS LAST,pikoscore DESC NULLS LAST,pikoquality ASC,title`;
  const rows=await sql.query(`${base} SELECT *,CASE WHEN priority_score>=40 THEN 'Alta' WHEN priority_score>=30 THEN 'Media' ELSE 'Baja' END priority_label FROM scored ${w} ORDER BY ${order} LIMIT ${safeSize} OFFSET ${offset}`,params);
  return{summary:summary||{},rows,total:n,page:effective,pageCount};
}
