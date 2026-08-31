import 'server-only';
import crypto from 'node:crypto';
import {db} from './db';
import {getMovieQualitySettings} from './movie-quality-settings';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.[a-z0-9]{2,4}$/,'').replace(/\b(2160p|1080p|720p|576p|480p|4k|uhd|bluray|blu-ray|bdrip|brrip|webrip|web-dl|webdl|hdtv|dvdrip|x264|x265|h264|h265|hevc|av1|aac|dts|ac3|truehd|remux|hdr10|hdr|dolby|atmos|dual|multi|proper|repack)\b/g,' ').replace(/[^a-z0-9ñ]+/g,' ').replace(/\s+/g,' ').trim();
const yearIn=s=>{const m=String(s||'').match(/\b(19\d{2}|20\d{2})\b/);return m?Number(m[1]):null};
const tokens=s=>new Set(norm(s).split(' ').filter(x=>x.length>1));
function similarity(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.size,B.size)}
function severity(r){return r>=85?'critical':r>=65?'high':r>=40?'medium':'low'}
const physicalKey=r=>crypto.createHash('sha256').update([String(r.file_path||'').trim().toLowerCase(),r.file_size_bytes??'',r.duration_ms??'',r.plex_part_id??''].join('|')).digest('hex');
async function upsertFinding(sql,f){await sql`INSERT INTO movie_quality_findings(finding_key,rating_key,imdb_id,finding_type,severity,risk_score,fingerprint,details,status,first_seen_at,last_seen_at) VALUES(${f.key},${f.rating_key},${f.imdb_id},${f.type},${severity(f.risk)},${Math.round(f.risk)},${f.fingerprint},${JSON.stringify(f.details)}::jsonb,'pending',now(),now()) ON CONFLICT(finding_key) DO UPDATE SET severity=EXCLUDED.severity,risk_score=EXCLUDED.risk_score,fingerprint=EXCLUDED.fingerprint,details=EXCLUDED.details,last_seen_at=now(),status=CASE WHEN movie_quality_findings.status='exception' AND movie_quality_findings.fingerprint=EXCLUDED.fingerprint THEN 'exception' WHEN movie_quality_findings.status='waiting_sync' AND movie_quality_findings.fingerprint=EXCLUDED.fingerprint THEN 'waiting_sync' ELSE 'pending' END,resolved_at=CASE WHEN movie_quality_findings.status='exception' AND movie_quality_findings.fingerprint=EXCLUDED.fingerprint THEN movie_quality_findings.resolved_at ELSE NULL END`}

export async function getMovieFileValidationSnapshot(imdbId){
  const sql=db();
  const [row]=await sql`SELECT cl.lifecycle_state,(SELECT count(*)::int FROM movie_file_validation v WHERE v.imdb_id=${imdbId} AND v.status='checked') validations,(SELECT count(*)::int FROM movie_quality_findings f WHERE f.imdb_id=${imdbId} AND f.finding_type IN('duration','filename','duplicate') AND f.status IN('pending','waiting_sync')) open_findings,(SELECT count(DISTINCT lower(COALESCE(pf.file_path,''))||'|'||COALESCE(pf.file_size_bytes::text,'')||'|'||COALESCE(pf.duration_ms::text,'')||'|'||COALESCE(pf.plex_part_id,''))::int FROM plex_items p JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' AND x.external_id=${imdbId} JOIN plex_files pf ON pf.rating_key=p.rating_key WHERE p.active AND p.item_type='movie' AND COALESCE(pf.exists_on_server,true)<>false) physical_files FROM catalog_lifecycle cl WHERE cl.imdb_id=${imdbId}`;
  return row||{lifecycle_state:null,validations:0,open_findings:0,physical_files:0};
}

export async function validateMovieFile(imdbId,{trace=null}={}){
  if(!/^tt\d+$/.test(String(imdbId||'')))throw new Error('IMDb ID inválido');
  const sql=db(),settings=await getMovieQualitySettings();
  const rows=await sql`SELECT p.rating_key,p.fingerprint,p.plex_title,p.plex_year,m.runtime,m.title_es,m.original_title,m.title,pf.media_index,pf.part_index,pf.plex_part_id,pf.file_path,pf.file_size_bytes,COALESCE(pf.duration_ms,pm.duration_ms) duration_ms,pm.resolution FROM plex_items p JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' AND x.external_id=${imdbId} JOIN movies m ON m.imdb_id=x.external_id JOIN plex_files pf ON pf.rating_key=p.rating_key LEFT JOIN plex_media pm ON pm.rating_key=pf.rating_key AND pm.media_index=pf.media_index WHERE p.active AND p.item_type='movie' AND COALESCE(pf.exists_on_server,true)<>false ORDER BY p.rating_key,pf.media_index,pf.part_index`;
  if(!rows.length)throw new Error('No hay archivo físico activo en Plex para esta película');
  const distinct=[...new Map(rows.map(r=>[physicalKey(r),{...r,physical_key:physicalKey(r)}])).values()];
  await audit('movie_file_validation','title',imdbId,'validation_started',{files:distinct.length,rows:rows.length});
  if(trace)await trace.event({eventType:'step_started',step:'inspect_physical_files',message:'Analizando archivos físicos asociados al IMDb',data:{physical_files:distinct.length,plex_rows:rows.length}});
  const seen=[];let issueCount=0;
  for(const r of distinct){
    const findings=[];const plexMin=Number(r.duration_ms||0)/60000,cat=Number(r.runtime||0),suffix=`${r.rating_key}:${r.media_index}:${r.part_index}`;
    if(cat>0&&plexMin>0){const signed=plexMin-cat,diff=Math.abs(signed),pct=diff/cat*100;if(diff>Number(settings.duration.minMinutes)&&pct>Number(settings.duration.minPercent)){const risk=Math.min(100,55+Math.max(0,pct-settings.duration.minPercent)*1.7+(diff>25?10:0));findings.push({key:`duration:${suffix}`,rating_key:r.rating_key,imdb_id:imdbId,type:'duration',risk,fingerprint:r.physical_key,details:{file:r.file_path,plex_minutes:Number(plexMin.toFixed(1)),catalog_minutes:cat,diff_minutes:Number(diff.toFixed(1)),diff_pct:Number(pct.toFixed(1)),direction:signed<0?'shorter':'longer'}})}}
    if(r.file_path){const f=norm(String(r.file_path).split(/[\\/]/).pop()),candidates=[r.plex_title,r.title_es,r.original_title,r.title].map(norm).filter(Boolean),fy=yearIn(r.file_path),year=Number(r.plex_year||0),best=candidates.reduce((v,a)=>Math.max(v,f.includes(a)||a.includes(f)?1:similarity(f,a)),0),yearMismatch=Boolean(fy&&year&&Math.abs(fy-year)>1);if(best<Number(settings.filename.minSimilarity)){const risk=Math.min(95,55+(1-best)*35+(yearMismatch?15:0));findings.push({key:`filename:${suffix}`,rating_key:r.rating_key,imdb_id:imdbId,type:'filename',risk,fingerprint:r.physical_key,details:{file:r.file_path,plex_title:r.plex_title,title_es:r.title_es,original_title:r.original_title,plex_year:r.plex_year,file_year:fy,best_similarity:Number(best.toFixed(2)),year_mismatch:yearMismatch}})}}
    for(const f of findings){await upsertFinding(sql,f);seen.push(f.key);issueCount++}
  }
  const byRating=new Map();for(const r of rows)if(!byRating.has(r.rating_key))byRating.set(r.rating_key,r);
  for(const r of byRating.values())await sql`INSERT INTO movie_file_validation(rating_key,imdb_id,source_fingerprint,status,checked_at) VALUES(${r.rating_key},${imdbId},${r.fingerprint},'checked',now()) ON CONFLICT(rating_key) DO UPDATE SET imdb_id=EXCLUDED.imdb_id,source_fingerprint=EXCLUDED.source_fingerprint,status='checked',checked_at=now()`;
  if(distinct.length>1){const first=distinct[0],key=`duplicate:${imdbId}`,risk=60,versions=distinct.map(r=>({rating_key:r.rating_key,media_index:r.media_index,part_index:r.part_index,part_id:r.plex_part_id,file:r.file_path,size:r.file_size_bytes,duration_ms:r.duration_ms,resolution:r.resolution,physical_fingerprint:r.physical_key}));await upsertFinding(sql,{key,rating_key:first.rating_key,imdb_id:imdbId,type:'duplicate',risk,fingerprint:crypto.createHash('sha256').update(versions.map(v=>v.physical_fingerprint).sort().join('|')).digest('hex'),details:{media_count:distinct.length,physical_file_count:distinct.length,rating_keys:[...new Set(distinct.map(r=>r.rating_key))],versions,recommendation:'Hay varios archivos físicos distintos asociados al mismo IMDb. Revisa si son duplicados reales o montajes distintos.'}});seen.push(key);issueCount++}
  await sql`UPDATE movie_quality_findings SET status='resolved',resolved_at=now(),last_seen_at=now() WHERE imdb_id=${imdbId} AND finding_type IN('duration','filename','duplicate') AND status IN('pending','waiting_sync') AND NOT(finding_key=ANY(${seen.length?seen:['__none__']}))`;
  const lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId),keys=[...byRating.keys()];
  if(trace)await trace.event({eventType:'step_completed',step:'inspect_physical_files',message:issueCount?'Validación física completada con incidencias':'Validación física completada sin incidencias',data:{physical_files:distinct.length,issues:issueCount,rating_keys:keys,lifecycle:lifecycle?.state||null}});
  await audit('movie_file_validation','title',imdbId,'validation_completed',{files:distinct.length,issues:issueCount,lifecycle:lifecycle?.state,rating_keys:keys});
  return{files:distinct.length,plexRows:rows.length,issues:issueCount,ratingKeys:keys,lifecycle};
}
