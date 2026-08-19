import 'server-only';
import {db} from './db';
import {ensureQualitySchema,QUALITY_VERSION} from './pikoquality';

const pct=(n,d)=>d?Math.round((Number(n||0)*1000)/Number(d))/10:0;

export async function getPikoQualityState(){
  await ensureQualitySchema();
  const sql=db();
  const [counts]=await sql`
    WITH physical AS (
      SELECT p.rating_key,p.item_type,p.fingerprint
      FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
      WHERE p.active AND p.item_type IN('movie','episode')
    )
    SELECT count(*)::int total,
      count(*) FILTER(WHERE physical.item_type='movie')::int movies,
      count(*) FILTER(WHERE physical.item_type='episode')::int episodes,
      count(*) FILTER(WHERE q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=physical.fingerprint)::int evaluated,
      count(*) FILTER(WHERE q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=physical.fingerprint AND q.enriched_at IS NOT NULL)::int enriched,
      count(*) FILTER(WHERE q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=physical.fingerprint AND q.confidence='high')::int high,
      count(*) FILTER(WHERE q.status='stale' AND q.source_fingerprint=physical.fingerprint)::int stale,
      count(*) FILTER(WHERE q.status='error' AND q.source_fingerprint=physical.fingerprint)::int errors,
      count(*) FILTER(WHERE q.rating_key IS NULL OR (q.status<>'stale' AND q.status<>'error' AND (q.formula_version<>${QUALITY_VERSION} OR q.source_fingerprint IS DISTINCT FROM physical.fingerprint)) OR ((q.status='stale' OR q.status='error') AND q.source_fingerprint IS DISTINCT FROM physical.fingerprint))::int pending_a,
      count(*) FILTER(WHERE q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=physical.fingerprint AND q.enriched_at IS NULL)::int pending_b
    FROM physical LEFT JOIN piko_quality q ON q.rating_key=physical.rating_key`;
  const distribution=await sql`SELECT q.band,count(*)::int count FROM piko_quality q JOIN plex_items p ON p.rating_key=q.rating_key WHERE p.active AND q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=p.fingerprint GROUP BY q.band`;
  const recent=await sql`SELECT q.rating_key,q.item_type,q.score,q.band,q.confidence,q.status,q.evaluated_at,p.plex_title,p.plex_year,p.parent_index,p.item_index,m.resolution,m.video_codec FROM piko_quality q JOIN plex_items p ON p.rating_key=q.rating_key LEFT JOIN plex_media m ON m.rating_key=q.rating_key AND m.media_index=0 WHERE p.active ORDER BY q.updated_at DESC LIMIT 8`;
  const runs=await sql`SELECT id,job_type,status,started_at,finished_at,processed_count,error_count,summary,round(extract(epoch from (COALESCE(finished_at,now())-started_at))::numeric,1) duration_seconds FROM pipeline_runs WHERE job_type LIKE 'pikoquality_%' ORDER BY created_at DESC LIMIT 6`;
  const [agg]=await sql`SELECT count(*)::int count,max(updated_at) last_aggregate FROM piko_quality_aggregates`;
  const [latestQ]=await sql`SELECT max(updated_at) latest FROM piko_quality WHERE status='evaluated'`;
  const aggregatePending=counts.pending_a===0&&counts.pending_b===0&&counts.errors===0&&(Number(agg.count||0)===0||(latestQ?.latest&&(!agg.last_aggregate||new Date(latestQ.latest)>new Date(agg.last_aggregate))));
  let recommendation={phase:'done',label:'PikoQuality al día',description:'No necesitas hacer nada.'};
  if(counts.pending_a>0)recommendation={phase:'a',label:'Continuar carga inicial A',description:`${counts.pending_a.toLocaleString('es-ES')} elementos necesitan score base o actualización.`};
  else if(counts.pending_b>0)recommendation={phase:'b',label:'Continuar enriquecimiento B',description:`${counts.pending_b.toLocaleString('es-ES')} elementos necesitan streams detallados desde Plex.`};
  else if(counts.errors>0)recommendation={phase:'retry_b',label:'Reintentar errores B',description:`${counts.errors.toLocaleString('es-ES')} elementos tuvieron un error temporal al consultar Plex.`};
  else if(aggregatePending)recommendation={phase:'aggregate',label:'Actualizar temporadas y series',description:'Recalcula los agregados de temporadas y series con los scores definitivos.'};
  const map=Object.fromEntries(distribution.map(x=>[x.band,x.count]));
  return{...counts,formulaVersion:QUALITY_VERSION,progressA:pct(counts.evaluated,counts.total),progressB:pct(counts.enriched,counts.total),distribution:{excellent:map.excellent||0,very_good:map.very_good||0,correct:map.correct||0,improvable:map.improvable||0,deficient:map.deficient||0},recent,runs,aggregateCount:agg.count||0,aggregatePending,recommendation};
}
