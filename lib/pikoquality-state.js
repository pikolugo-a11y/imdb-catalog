import 'server-only';
import {db} from './db';
import {PIKOQUALITY_ACTIVE_VERSION} from './pikoquality-version.mjs';

const pct=(n,d)=>d?Math.round((Number(n||0)*1000)/Number(d))/10:0;

export async function getPikoQualityState(){
  const sql=db();
  const [summary,recent,runs,agg]=await Promise.all([
    sql.query(`
      WITH eligible AS (
        SELECT p.rating_key,p.item_type,p.plex_title,p.plex_year,p.parent_index,p.item_index,
          pts.technical_fingerprint,m.resolution,m.video_codec,
          q.score,q.band,q.confidence,q.status,q.formula_version,q.source_fingerprint,q.enriched_at,q.evaluated_at,q.updated_at,
          COALESCE(q.status='evaluated' AND q.formula_version=$1 AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint,false) AS valid
        FROM plex_items p
        JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
        LEFT JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
        LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
        WHERE p.active AND p.item_type IN('movie','episode')
      )
      SELECT count(*)::int total,
        count(*) FILTER(WHERE item_type='movie')::int movies,
        count(*) FILTER(WHERE item_type='episode')::int episodes,
        count(*) FILTER(WHERE valid)::int evaluated,
        count(*) FILTER(WHERE NOT valid)::int pending,
        count(*) FILTER(WHERE q_status='error')::int errors,
        count(*) FILTER(WHERE NOT valid AND formula_version=$1 AND source_fingerprint IS DISTINCT FROM technical_fingerprint)::int stale,
        max(updated_at) FILTER(WHERE valid) latest_valid,
        count(*) FILTER(WHERE valid AND band='fail')::int fail,
        count(*) FILTER(WHERE valid AND band='sufficient')::int sufficient,
        count(*) FILTER(WHERE valid AND band='good')::int good,
        count(*) FILTER(WHERE valid AND band='notable')::int notable,
        count(*) FILTER(WHERE valid AND band='outstanding')::int outstanding,
        count(*) FILTER(WHERE valid AND band='honors')::int honors
      FROM (SELECT *,status q_status FROM eligible) e`,[PIKOQUALITY_ACTIVE_VERSION]),
    sql.query(`
      SELECT p.rating_key,p.item_type,q.score,q.band,q.confidence,q.status,q.evaluated_at,p.plex_title,p.plex_year,p.parent_index,p.item_index,m.resolution,m.video_codec
      FROM plex_items p
      JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
      JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=$1 AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
      LEFT JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
      WHERE p.active AND p.item_type IN('movie','episode')
      ORDER BY q.updated_at DESC NULLS LAST LIMIT 8`,[PIKOQUALITY_ACTIVE_VERSION]),
    sql`SELECT id,job_type,status,started_at,finished_at,processed_count,error_count,summary,round(extract(epoch from (COALESCE(finished_at,now())-started_at))::numeric,1) duration_seconds FROM pipeline_runs WHERE job_type='pikoquality_c6' ORDER BY created_at DESC LIMIT 6`,
    sql`SELECT count(*) FILTER(WHERE formula_version=${PIKOQUALITY_ACTIVE_VERSION})::int count,max(updated_at) FILTER(WHERE formula_version=${PIKOQUALITY_ACTIVE_VERSION}) last_aggregate FROM piko_quality_aggregates`
  ]);
  const x=summary[0]||{};
  const counts={total:Number(x.total||0),movies:Number(x.movies||0),episodes:Number(x.episodes||0),evaluated:Number(x.evaluated||0),pending_a:Number(x.pending||0),stale:Number(x.stale||0),errors:Number(x.errors||0),enriched:Number(x.evaluated||0),high:Number(x.evaluated||0),pending_b:0,blocked_by_lifecycle:0};
  const distribution={fail:Number(x.fail||0),sufficient:Number(x.sufficient||0),good:Number(x.good||0),notable:Number(x.notable||0),outstanding:Number(x.outstanding||0),honors:Number(x.honors||0)};
  const aggregateCount=Number(agg[0]?.count||0);
  const aggregatePending=counts.pending_a===0&&counts.errors===0&&(aggregateCount===0||(x.latest_valid&&(!agg[0]?.last_aggregate||new Date(x.latest_valid)>new Date(agg[0].last_aggregate))));
  const recommendation=counts.pending_a>0?{phase:'score',label:'PikoQuality C6 pendiente',description:`${counts.pending_a.toLocaleString('es-ES')} archivos necesitan cálculo o actualización.`}:counts.errors>0?{phase:'errors',label:'Revisar errores',description:`${counts.errors.toLocaleString('es-ES')} archivos tienen un error C6 pendiente.`}:aggregatePending?{phase:'aggregate',label:'Actualizando series',description:'Los episodios están calculados y faltan agregados C6 de temporadas/series.'}:{phase:'done',label:'PikoQuality C6 al día',description:'No necesitas hacer nada.'};
  return{...counts,formulaVersion:PIKOQUALITY_ACTIVE_VERSION,progressA:pct(counts.evaluated,counts.total),progressB:pct(counts.evaluated,counts.total),distribution,recent,runs,aggregateCount,aggregatePending,recommendation};
}

export async function getPikoQualityPendingPage({page=1,pageSize=25,query='',resolution='',codec='',status='',sort='priority'}={}){
  const sql=db();
  const safePage=Math.max(1,Number(page)||1),safeSize=Math.min(100,Math.max(10,Number(pageSize)||25));
  const params=[PIKOQUALITY_ACTIVE_VERSION];
  const where=[`p.active`,`p.item_type='movie'`,`pts.snapshot_status='ready'`,`pts.technical_fingerprint IS NOT NULL`,`NOT(q.status='evaluated' AND q.formula_version=$1 AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint)`];
  const add=(value,clause)=>{params.push(value);where.push(clause(params.length));};
  const q=String(query||'').trim();
  if(q)add(`%${q}%`,i=>`(COALESCE(mv.title_es,'') ILIKE $${i} OR COALESCE(mv.title,'') ILIKE $${i} OR COALESCE(mv.original_title,'') ILIKE $${i} OR COALESCE(p.plex_title,'') ILIKE $${i} OR COALESCE(mx.external_id,'') ILIKE $${i})`);
  if(resolution)add(String(resolution),i=>`pm.resolution=$${i}`);
  if(codec)add(String(codec).toLowerCase(),i=>`lower(pm.video_codec)=$${i}`);
  if(status==='stale')where.push(`q.formula_version=$1 AND q.source_fingerprint IS DISTINCT FROM pts.technical_fingerprint`);
  else if(status==='error')where.push(`q.formula_version=$1 AND q.status='error'`);
  else if(status==='pending')where.push(`q.rating_key IS NULL OR q.formula_version<>$1`);
  const joins=`FROM plex_items p JOIN plex_technical_state pts ON pts.rating_key=p.rating_key LEFT JOIN LATERAL(SELECT external_id FROM plex_external_ids WHERE rating_key=p.rating_key AND provider='imdb' LIMIT 1) mx ON true LEFT JOIN movies mv ON mv.imdb_id=mx.external_id LEFT JOIN LATERAL(SELECT resolution,video_codec,bitrate,audio_codec,audio_channels FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1) pm ON true LEFT JOIN piko_quality q ON q.rating_key=p.rating_key`;
  const priorityCase=`CASE WHEN q.formula_version=$1 AND q.status='error' THEN 0 WHEN q.formula_version=$1 AND q.source_fingerprint IS DISTINCT FROM pts.technical_fingerprint THEN 1 WHEN q.rating_key IS NULL OR q.formula_version<>$1 THEN 2 ELSE 3 END`;
  const priorityReason=`CASE WHEN q.formula_version=$1 AND q.status='error' THEN 'Error C6' WHEN q.formula_version=$1 AND q.source_fingerprint IS DISTINCT FROM pts.technical_fingerprint THEN 'Archivo cambiado desde C6' WHEN q.rating_key IS NULL OR q.formula_version<>$1 THEN 'Nunca calculado con C6' ELSE 'Pendiente C6' END`;
  const order={year:`COALESCE(mv.year,p.plex_year) DESC NULLS LAST,COALESCE(mv.title_es,p.plex_title),p.rating_key`,title:`COALESCE(mv.title_es,p.plex_title) ASC,p.rating_key`,priority:`${priorityCase},COALESCE(mv.year,p.plex_year) DESC NULLS LAST,COALESCE(mv.title_es,p.plex_title),p.rating_key`}[sort]||`${priorityCase},p.rating_key`;
  const base=`${joins} WHERE ${where.join(' AND ')}`;
  const [overallRows,countRows]=await Promise.all([sql.query(`SELECT count(*)::int total ${joins} WHERE p.active AND p.item_type='movie' AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL AND NOT(q.status='evaluated' AND q.formula_version=$1 AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint)`,[PIKOQUALITY_ACTIVE_VERSION]),sql.query(`SELECT count(*)::int total ${base}`,params)]);
  const overallTotal=Number(overallRows[0]?.total||0),total=Number(countRows[0]?.total||0),pageCount=Math.max(1,Math.ceil(total/safeSize)),effectivePage=Math.min(safePage,pageCount),effectiveOffset=(effectivePage-1)*safeSize;
  const rows=await sql.query(`SELECT mx.external_id imdb_id,mv.title_es,mv.title,mv.original_title,COALESCE(mv.year,p.plex_year) AS item_year,p.rating_key,p.plex_title,p.plex_year,pts.technical_fingerprint fingerprint,pm.resolution,pm.video_codec,pm.bitrate,pm.audio_codec,pm.audio_channels,q.score,q.status,q.formula_version,q.source_fingerprint,${priorityCase} priority_rank,${priorityReason} priority_reason ${base} ORDER BY ${order} LIMIT ${safeSize} OFFSET ${effectiveOffset}`,params);
  const facets=await sql.query(`SELECT array_remove(array_agg(DISTINCT pm.resolution ORDER BY pm.resolution),NULL) resolutions,array_remove(array_agg(DISTINCT lower(pm.video_codec) ORDER BY lower(pm.video_codec)),NULL) codecs ${joins} WHERE p.active AND p.item_type='movie' AND pts.snapshot_status='ready'`,[PIKOQUALITY_ACTIVE_VERSION]);
  return{rows:rows.map(r=>({...r,year:r.item_year})),total,overallTotal,page:effectivePage,pageSize:safeSize,pageCount,resolutions:facets[0]?.resolutions||[],codecs:facets[0]?.codecs||[]};
}
