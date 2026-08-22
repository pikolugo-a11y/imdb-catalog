import 'server-only';
import {db} from './db';
import {ensureQualitySchema,QUALITY_VERSION} from './pikoquality';

const pct=(n,d)=>d?Math.round((Number(n||0)*1000)/Number(d))/10:0;

export async function getPikoQualityState(){
  await ensureQualitySchema();
  const sql=db();
  const physical=await sql`
    SELECT p.rating_key,p.item_type,p.fingerprint,p.plex_title,p.plex_year,p.parent_index,p.item_index,m.resolution,m.video_codec,
      COALESCE(mx.external_id,sr.imdb_id) lifecycle_imdb_id,cl.lifecycle_state,
      q.score,q.band,q.confidence,q.status,q.formula_version,q.source_fingerprint,q.enriched_at,q.evaluated_at,q.updated_at
    FROM plex_items p
    JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
    LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
    LEFT JOIN LATERAL(SELECT external_id FROM plex_external_ids WHERE rating_key=p.rating_key AND provider='imdb' LIMIT 1) mx ON p.item_type='movie'
    LEFT JOIN series_reference sr ON p.item_type='episode' AND sr.show_rating_key=p.grandparent_rating_key
    LEFT JOIN catalog_lifecycle cl ON cl.imdb_id=COALESCE(mx.external_id,sr.imdb_id)
    WHERE p.active AND p.item_type IN('movie','episode')`;
  const allowed=new Set(['TECH_PENDING','TECH_REVIEW','COMPLETE']);
  const rows=physical.filter(r=>allowed.has(r.lifecycle_state));
  const valid=q=>q.status==='evaluated'&&q.formula_version===QUALITY_VERSION&&q.source_fingerprint===q.fingerprint;
  const counts={total:rows.length,movies:rows.filter(r=>r.item_type==='movie').length,episodes:rows.filter(r=>r.item_type==='episode').length,evaluated:rows.filter(valid).length,enriched:rows.filter(r=>valid(r)&&r.enriched_at).length,high:rows.filter(r=>valid(r)&&r.confidence==='high').length,stale:rows.filter(r=>r.status==='stale'&&r.source_fingerprint===r.fingerprint).length,errors:rows.filter(r=>r.status==='error'&&r.source_fingerprint===r.fingerprint).length,pending_a:rows.filter(r=>!r.rating_key||!r.status||((r.status!=='stale'&&r.status!=='error')&&(r.formula_version!==QUALITY_VERSION||r.source_fingerprint!==r.fingerprint))||((r.status==='stale'||r.status==='error')&&r.source_fingerprint!==r.fingerprint)).length,pending_b:rows.filter(r=>valid(r)&&!r.enriched_at).length,blocked_by_lifecycle:physical.length-rows.length};
  const distribution={excellent:0,very_good:0,correct:0,improvable:0,deficient:0};for(const r of rows)if(valid(r)&&Object.hasOwn(distribution,r.band))distribution[r.band]++;
  const recent=rows.filter(r=>r.updated_at).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,8).map(r=>({rating_key:r.rating_key,item_type:r.item_type,score:r.score,band:r.band,confidence:r.confidence,status:r.status,evaluated_at:r.evaluated_at,plex_title:r.plex_title,plex_year:r.plex_year,parent_index:r.parent_index,item_index:r.item_index,resolution:r.resolution,video_codec:r.video_codec}));
  const runs=await sql`SELECT id,job_type,status,started_at,finished_at,processed_count,error_count,summary,round(extract(epoch from (COALESCE(finished_at,now())-started_at))::numeric,1) duration_seconds FROM pipeline_runs WHERE job_type LIKE 'pikoquality_%' ORDER BY created_at DESC LIMIT 6`;
  const [agg]=await sql`SELECT count(*)::int count,max(updated_at) last_aggregate FROM piko_quality_aggregates`;
  const latest=rows.filter(valid).map(r=>r.updated_at).filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0]||null;
  const aggregatePending=counts.pending_a===0&&counts.pending_b===0&&counts.errors===0&&(Number(agg.count||0)===0||(latest&&(!agg.last_aggregate||new Date(latest)>new Date(agg.last_aggregate))));
  let recommendation={phase:'done',label:'PikoQuality al día',description:'No necesitas hacer nada.'};
  if(counts.pending_a>0)recommendation={phase:'a',label:'Continuar carga inicial A',description:`${counts.pending_a.toLocaleString('es-ES')} elementos elegibles necesitan score base o actualización.`};
  else if(counts.pending_b>0)recommendation={phase:'b',label:'Continuar enriquecimiento B',description:`${counts.pending_b.toLocaleString('es-ES')} elementos elegibles necesitan streams detallados desde Plex.`};
  else if(counts.errors>0)recommendation={phase:'retry_b',label:'Reintentar errores B',description:`${counts.errors.toLocaleString('es-ES')} elementos elegibles tuvieron un error temporal al consultar Plex.`};
  else if(aggregatePending)recommendation={phase:'aggregate',label:'Actualizar temporadas y series',description:'Recalcula los agregados de temporadas y series con los scores definitivos.'};
  return{...counts,formulaVersion:QUALITY_VERSION,progressA:pct(counts.evaluated,counts.total),progressB:pct(counts.enriched,counts.total),distribution,recent,runs,aggregateCount:agg.count||0,aggregatePending,recommendation};
}
