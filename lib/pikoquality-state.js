import 'server-only';
import {db} from './db';
import {ensureQualitySchema,QUALITY_VERSION} from './pikoquality';

const pct=(n,d)=>d?Math.round((Number(n||0)*1000)/Number(d))/10:0;
const ALLOWED_LIFECYCLE=['TECH_PENDING','TECH_REVIEW','COMPLETE'];

export async function getPikoQualityState(){
  await ensureQualitySchema();
  const sql=db();
  const [summary,recent,runs,agg]=await Promise.all([
    sql.query(`
      WITH physical AS (
        SELECT p.rating_key,p.item_type,p.fingerprint,p.plex_title,p.plex_year,p.parent_index,p.item_index,
          m.resolution,m.video_codec,
          COALESCE(mx.external_id,sr.imdb_id) lifecycle_imdb_id,cl.lifecycle_state,
          q.score,q.band,q.confidence,q.status,q.formula_version,q.source_fingerprint,q.enriched_at,q.evaluated_at,q.updated_at,
          (q.status='evaluated' AND q.formula_version=$1 AND q.source_fingerprint IS NOT DISTINCT FROM p.fingerprint) AS valid
        FROM plex_items p
        JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
        LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
        LEFT JOIN LATERAL(SELECT external_id FROM plex_external_ids WHERE rating_key=p.rating_key AND provider='imdb' LIMIT 1) mx ON p.item_type='movie'
        LEFT JOIN series_reference sr ON p.item_type='episode' AND sr.show_rating_key=p.grandparent_rating_key
        LEFT JOIN catalog_lifecycle cl ON cl.imdb_id=COALESCE(mx.external_id,sr.imdb_id)
        WHERE p.active AND p.item_type IN('movie','episode')
      ), eligible AS (
        SELECT * FROM physical WHERE lifecycle_state = ANY($2::text[])
      )
      SELECT
        (SELECT count(*) FROM physical)::int AS physical_total,
        count(*)::int AS total,
        count(*) FILTER(WHERE item_type='movie')::int AS movies,
        count(*) FILTER(WHERE item_type='episode')::int AS episodes,
        count(*) FILTER(WHERE valid)::int AS evaluated,
        count(*) FILTER(WHERE valid AND enriched_at IS NOT NULL)::int AS enriched,
        count(*) FILTER(WHERE valid AND confidence='high')::int AS high,
        count(*) FILTER(WHERE NOT valid AND rating_key IS NOT NULL AND (status='stale' OR formula_version IS DISTINCT FROM $1 OR source_fingerprint IS DISTINCT FROM fingerprint))::int AS stale,
        count(*) FILTER(WHERE status='error' AND source_fingerprint IS NOT DISTINCT FROM fingerprint)::int AS errors,
        count(*) FILTER(WHERE NOT valid)::int AS pending,
        max(updated_at) FILTER(WHERE valid) AS latest_valid,
        count(*) FILTER(WHERE valid AND band='excellent')::int AS excellent,
        count(*) FILTER(WHERE valid AND band='very_good')::int AS very_good,
        count(*) FILTER(WHERE valid AND band='correct')::int AS correct,
        count(*) FILTER(WHERE valid AND band='improvable')::int AS improvable,
        count(*) FILTER(WHERE valid AND band='deficient')::int AS deficient
      FROM eligible`,[QUALITY_VERSION,ALLOWED_LIFECYCLE]),
    sql.query(`
      WITH eligible AS (
        SELECT p.rating_key,p.item_type,p.fingerprint,p.plex_title,p.plex_year,p.parent_index,p.item_index,
          m.resolution,m.video_codec,q.score,q.band,q.confidence,q.status,q.formula_version,q.source_fingerprint,q.evaluated_at,q.updated_at,
          cl.lifecycle_state
        FROM plex_items p
        JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
        LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
        LEFT JOIN LATERAL(SELECT external_id FROM plex_external_ids WHERE rating_key=p.rating_key AND provider='imdb' LIMIT 1) mx ON p.item_type='movie'
        LEFT JOIN series_reference sr ON p.item_type='episode' AND sr.show_rating_key=p.grandparent_rating_key
        LEFT JOIN catalog_lifecycle cl ON cl.imdb_id=COALESCE(mx.external_id,sr.imdb_id)
        WHERE p.active AND p.item_type IN('movie','episode') AND cl.lifecycle_state = ANY($2::text[])
      )
      SELECT rating_key,item_type,score,band,confidence,status,evaluated_at,plex_title,plex_year,parent_index,item_index,resolution,video_codec
      FROM eligible
      WHERE status='evaluated' AND formula_version=$1 AND source_fingerprint IS NOT DISTINCT FROM fingerprint
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 8`,[QUALITY_VERSION,ALLOWED_LIFECYCLE]),
    sql`SELECT id,job_type,status,started_at,finished_at,processed_count,error_count,summary,round(extract(epoch from (COALESCE(finished_at,now())-started_at))::numeric,1) duration_seconds FROM pipeline_runs WHERE job_type LIKE 'pikoquality_%' ORDER BY created_at DESC LIMIT 6`,
    sql`SELECT count(*)::int count,max(updated_at) last_aggregate FROM piko_quality_aggregates`
  ]);

  const x=summary[0]||{};
  const counts={
    total:Number(x.total||0),movies:Number(x.movies||0),episodes:Number(x.episodes||0),evaluated:Number(x.evaluated||0),
    enriched:Number(x.enriched||0),high:Number(x.high||0),stale:Number(x.stale||0),errors:Number(x.errors||0),
    pending_a:Number(x.pending||0),pending_b:Math.max(0,Number(x.evaluated||0)-Number(x.enriched||0)),
    blocked_by_lifecycle:Math.max(0,Number(x.physical_total||0)-Number(x.total||0))
  };
  const distribution={excellent:Number(x.excellent||0),very_good:Number(x.very_good||0),correct:Number(x.correct||0),improvable:Number(x.improvable||0),deficient:Number(x.deficient||0)};
  const aggregateCount=Number(agg[0]?.count||0);
  const aggregatePending=counts.pending_a===0&&counts.pending_b===0&&counts.errors===0&&(aggregateCount===0||(x.latest_valid&&(!agg[0]?.last_aggregate||new Date(x.latest_valid)>new Date(agg[0].last_aggregate))));
  const recommendation=counts.pending_a>0
    ?{phase:'score',label:'PikoQuality pendiente',description:`${counts.pending_a.toLocaleString('es-ES')} archivos necesitan cálculo o actualización.`}
    :counts.errors>0
      ?{phase:'errors',label:'Revisar errores',description:`${counts.errors.toLocaleString('es-ES')} archivos tienen un error técnico pendiente.`}
      :aggregatePending
        ?{phase:'aggregate',label:'Actualizar agregados',description:'Hay temporadas o series pendientes de reagregación.'}
        :{phase:'done',label:'PikoQuality al día',description:'No necesitas hacer nada.'};

  return{...counts,formulaVersion:QUALITY_VERSION,progressA:pct(counts.evaluated,counts.total),progressB:pct(counts.enriched,counts.total),distribution,recent,runs,aggregateCount,aggregatePending,recommendation};
}

export async function getPikoQualityPendingPage({page=1,pageSize=25,query='',resolution='',codec='',status='',sort='priority'}={}){
  await ensureQualitySchema();
  const sql=db();
  const safePage=Math.max(1,Number(page)||1);
  const safeSize=Math.min(100,Math.max(10,Number(pageSize)||25));
  const offset=(safePage-1)*safeSize;
  const params=[];
  const where=[`cl.lifecycle_state='TECH_PENDING'`,`m.type='Película'`];
  const add=(value,clause)=>{params.push(value);where.push(clause(params.length));};
  const q=String(query||'').trim();
  if(q)add(`%${q}%`,i=>`(m.title_es ILIKE $${i} OR p.plex_title ILIKE $${i} OR cl.imdb_id ILIKE $${i})`);
  if(resolution)add(String(resolution),i=>`pm.resolution=$${i}`);
  if(codec)add(String(codec).toLowerCase(),i=>`lower(pm.video_codec)=$${i}`);
  if(status==='stale')where.push(`q.rating_key IS NOT NULL AND (q.status='stale' OR q.formula_version IS DISTINCT FROM '${QUALITY_VERSION.replaceAll("'","''")}' OR q.source_fingerprint IS DISTINCT FROM p.fingerprint)`);
  else if(status==='error')where.push(`q.status='error' AND q.source_fingerprint IS NOT DISTINCT FROM p.fingerprint`);
  else if(status==='pending')where.push(`q.rating_key IS NULL OR q.status IS NULL OR q.status NOT IN ('stale','error')`);
  const order={year:`m.year DESC NULLS LAST,m.title_es,cl.imdb_id`,title:`m.title_es ASC NULLS LAST,m.year DESC,cl.imdb_id`,priority:`CASE WHEN q.status='error' THEN 0 WHEN q.status='stale' OR q.formula_version IS DISTINCT FROM '${QUALITY_VERSION.replaceAll("'","''")}' OR q.source_fingerprint IS DISTINCT FROM p.fingerprint THEN 1 ELSE 2 END,m.year DESC NULLS LAST,m.title_es,cl.imdb_id`}[sort]||`m.year DESC NULLS LAST,m.title_es,cl.imdb_id`;
  const base=`FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN plex_catalog_status pcs USING(imdb_id) LEFT JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active LEFT JOIN LATERAL(SELECT resolution,video_codec,bitrate,audio_codec,audio_channels FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1) pm ON true LEFT JOIN LATERAL(SELECT bit_depth FROM plex_streams s WHERE s.rating_key=p.rating_key AND s.stream_type=1 ORDER BY s.bitrate DESC NULLS LAST LIMIT 1) vs ON true LEFT JOIN piko_quality q ON q.rating_key=pcs.rating_key WHERE ${where.join(' AND ')}`;
  const countRows=await sql.query(`SELECT count(*)::int total ${base}`,params);
  const total=Number(countRows[0]?.total||0);
  const pageCount=Math.max(1,Math.ceil(total/safeSize));
  const effectivePage=Math.min(safePage,pageCount);
  const effectiveOffset=(effectivePage-1)*safeSize;
  const rows=await sql.query(`SELECT cl.imdb_id,m.title_es,m.year,pcs.rating_key,p.plex_title,p.plex_year,p.fingerprint,pm.resolution,pm.video_codec,pm.bitrate,pm.audio_codec,pm.audio_channels,vs.bit_depth,q.score,q.status,q.formula_version,q.source_fingerprint ${base} ORDER BY ${order} LIMIT ${safeSize} OFFSET ${effectiveOffset}`,params);
  const facets=await sql.query(`SELECT array_remove(array_agg(DISTINCT pm.resolution ORDER BY pm.resolution),NULL) resolutions,array_remove(array_agg(DISTINCT lower(pm.video_codec) ORDER BY lower(pm.video_codec)),NULL) codecs ${base}`,params);
  return{rows,total,page:effectivePage,pageSize:safeSize,pageCount,resolutions:facets[0]?.resolutions||[],codecs:facets[0]?.codecs||[]};
}
