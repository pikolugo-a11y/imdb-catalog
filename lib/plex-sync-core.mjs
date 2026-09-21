import crypto from 'node:crypto';
import {reconcileSeriesReferencesFromPlexCore} from './series-reference-reconcile-core.mjs';

const CLIENT='pikofilm-fast-sync';
const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'2'});
const ts=v=>v?new Date(Number(v)*1000).toISOString():null;
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fingerprint=i=>crypto.createHash('sha256').update([i.ratingKey,i.type,i.title,i.year,i.updatedAt].join('|')).digest('hex');
const filenameOf=v=>{const s=String(v||'').trim();if(!s)return null;const parts=s.split(/[\\/]/);return parts[parts.length-1]||null};
function attrs(s){const out={};for(const m of String(s||'').matchAll(/([\w:-]+)="([^"]*)"/g))out[m[1]]=m[2].replaceAll('&amp;','&');return out}
export async function discoverPlexUrlCore(token,baseUrl='',{
  fetchImpl=globalThis.fetch,
  signalFactory=ms=>AbortSignal.timeout(ms),
  discoveryTimeoutMs=15000,
  probeTimeoutMs=10000
}={}){
  const fixed=String(baseUrl||'').replace(/\/$/,'');
  if(fixed)return fixed;
  let response;
  try{
    response=await fetchImpl('https://plex.tv/api/resources?includeHttps=1',{
      headers:{'X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT},
      cache:'no-store',
      signal:signalFactory(discoveryTimeoutMs)
    });
  }catch(error){
    if(error&&typeof error==='object'){
      if(!error.source)error.source='plex';
      if(error.retryable==null)error.retryable=true;
      error.processStep='plex_discovery';
    }
    throw error;
  }
  if(!response.ok){
    const error=new Error(`No se pudo descubrir Plex (${response.status})`);
    error.status=response.status;
    error.source='plex';
    error.retryable=response.status===429||response.status>=500;
    error.processStep='plex_discovery';
    throw error;
  }
  const xml=await response.text();
  const devices=[...xml.matchAll(/<Device\b([^>]*)>([\s\S]*?)<\/Device>/g)];
  const ranked=[];
  for(const d of devices){
    const a=attrs(d[1]);
    if(!String(a.provides||'').includes('server'))continue;
    const connections=[...d[2].matchAll(/<Connection\b([^>]*)\/?\s*>/g)].map(x=>attrs(x[1])).filter(x=>x.uri);
    ranked.push(
      ...connections.filter(x=>x.local==='0'&&x.relay!=='1'&&String(x.uri).startsWith('https://')).map(x=>({...x,priority:1})),
      ...connections.filter(x=>x.local==='0'&&x.relay!=='1'&&!String(x.uri).startsWith('https://')).map(x=>({...x,priority:2})),
      ...connections.filter(x=>x.relay==='1').map(x=>({...x,priority:3}))
    );
  }
  const seen=new Set();
  const candidates=ranked.sort((a,b)=>a.priority-b.priority).filter(x=>{
    const uri=String(x.uri||'').replace(/\/$/,'');
    if(!uri||seen.has(uri))return false;
    seen.add(uri);
    x.uri=uri;
    return true;
  });
  let lastError=null;
  for(const candidate of candidates){
    try{
      const probe=await fetchImpl(candidate.uri+'/library/sections',{
        headers:headers(token),
        cache:'no-store',
        signal:signalFactory(probeTimeoutMs)
      });
      if(probe.ok)return candidate.uri;
      lastError=Object.assign(new Error(`Plex rechazó una conexión publicada (${probe.status})`),{
        status:probe.status,
        source:'plex',
        retryable:probe.status===429||probe.status>=500,
        processStep:'plex_connection_probe'
      });
    }catch(error){
      lastError=error;
      if(lastError&&typeof lastError==='object'){
        if(!lastError.source)lastError.source='plex';
        if(lastError.retryable==null)lastError.retryable=true;
        lastError.processStep='plex_connection_probe';
      }
    }
  }
  const error=new Error(`Plex publicó ${candidates.length} conexión${candidates.length===1?'':'es'} remota${candidates.length===1?'':'s'}, pero ninguna respondió desde Railway`,lastError?{cause:lastError}:undefined);
  error.source='plex';
  error.retryable=true;
  error.processStep='plex_connection_probe';
  error.attemptedConnections=candidates.length;
  throw error;
}
async function pget(base,token,path){const r=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(120000)});if(!r.ok){const e=new Error(`Plex ${path} respondió ${r.status}`);e.status=r.status;throw e}return r.json()}
function list(meta){const c=meta?.MediaContainer||{};return c.Metadata||c.Video||c.Directory||[]}
function gids(item){const rows=[];for(const g of item?.Guid||[]){const id=String(g.id||'');const m=id.match(/^(imdb|tmdb|tvdb):\/\/(.+)$/);if(m)rows.push({provider:m[1],external_id:m[2]})}return rows}
function medias(item){return (item?.Media||[]).map((m,mi)=>({media_index:mi,plex_media_id:String(m.id||''),duration_ms:num(m.duration),bitrate:num(m.bitrate),width:num(m.width),height:num(m.height),resolution:m.videoResolution||null,aspect_ratio:num(m.aspectRatio),container:m.container||null,video_codec:m.videoCodec||null,video_profile:m.videoProfile||null,video_frame_rate:m.videoFrameRate||null,video_dynamic_range:m.videoDynamicRange||null,audio_codec:m.audioCodec||null,audio_profile:m.audioProfile||null,audio_channels:num(m.audioChannels),optimized_for_streaming:m.optimizedForStreaming===true||m.optimizedForStreaming===1,parts:(m.Part||[]).map((p,pi)=>({part_index:pi,plex_part_id:String(p.id||''),file_path:filenameOf(p.file),file_size_bytes:num(p.size),duration_ms:num(p.duration),container:p.container||null,accessible:p.accessible==null?null:Boolean(p.accessible),exists_on_server:p.exists==null?null:Boolean(p.exists)}))}))}
async function upsertSectionMediaAndFiles(sql,items){const mediaRows=items.flatMap(i=>medias(i).map(m=>({rating_key:String(i.ratingKey),media_index:m.media_index,plex_media_id:m.plex_media_id,duration_ms:m.duration_ms,bitrate:m.bitrate,width:m.width,height:m.height,resolution:m.resolution,aspect_ratio:m.aspect_ratio,container:m.container,video_codec:m.video_codec,video_profile:m.video_profile,video_frame_rate:m.video_frame_rate,video_dynamic_range:m.video_dynamic_range,audio_codec:m.audio_codec,audio_profile:m.audio_profile,audio_channels:m.audio_channels,optimized_for_streaming:m.optimized_for_streaming})));if(mediaRows.length)await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(mediaRows)}::jsonb) AS t(rating_key text,media_index int,plex_media_id text,duration_ms bigint,bitrate int,width int,height int,resolution text,aspect_ratio float8,container text,video_codec text,video_profile text,video_frame_rate text,video_dynamic_range text,audio_codec text,audio_profile text,audio_channels int,optimized_for_streaming bool)) INSERT INTO plex_media SELECT * FROM x ON CONFLICT(rating_key,media_index) DO UPDATE SET plex_media_id=EXCLUDED.plex_media_id,duration_ms=EXCLUDED.duration_ms,bitrate=EXCLUDED.bitrate,width=EXCLUDED.width,height=EXCLUDED.height,resolution=EXCLUDED.resolution,aspect_ratio=EXCLUDED.aspect_ratio,container=EXCLUDED.container,video_codec=EXCLUDED.video_codec,video_profile=EXCLUDED.video_profile,video_frame_rate=EXCLUDED.video_frame_rate,video_dynamic_range=EXCLUDED.video_dynamic_range,audio_codec=EXCLUDED.audio_codec,audio_profile=EXCLUDED.audio_profile,audio_channels=EXCLUDED.audio_channels,optimized_for_streaming=EXCLUDED.optimized_for_streaming`;
const rows=items.flatMap(i=>medias(i).flatMap(m=>m.parts.filter(p=>p.file_path).map(p=>({rating_key:String(i.ratingKey),media_index:m.media_index,part_index:p.part_index,plex_part_id:p.plex_part_id,file_path:p.file_path,file_size_bytes:p.file_size_bytes,duration_ms:p.duration_ms,container:p.container,accessible:p.accessible,exists_on_server:p.exists_on_server}))));if(!rows.length)return 0;await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS t(rating_key text,media_index int,part_index int,plex_part_id text,file_path text,file_size_bytes bigint,duration_ms bigint,container text,accessible bool,exists_on_server bool)) INSERT INTO plex_files(rating_key,media_index,part_index,plex_part_id,file_path,file_size_bytes,duration_ms,container,accessible,exists_on_server) SELECT rating_key,media_index,part_index,plex_part_id,file_path,file_size_bytes,duration_ms,container,accessible,exists_on_server FROM x ON CONFLICT(rating_key,media_index,part_index) DO UPDATE SET plex_part_id=EXCLUDED.plex_part_id,file_path=EXCLUDED.file_path,file_size_bytes=COALESCE(EXCLUDED.file_size_bytes,plex_files.file_size_bytes),duration_ms=COALESCE(EXCLUDED.duration_ms,plex_files.duration_ms),container=COALESCE(EXCLUDED.container,plex_files.container),accessible=COALESCE(EXCLUDED.accessible,plex_files.accessible),exists_on_server=COALESCE(EXCLUDED.exists_on_server,plex_files.exists_on_server)`;return rows.length;}
async function syncSection(sql,base,token,section,{shouldStop=async()=>false}={}){const sectionId=Number(section.key),kind=section.type==='show'?'show':'movie',started=new Date();const[run]=await sql`INSERT INTO plex_sync_runs(sync_mode,library_section_id,status,notes) VALUES('incremental',${sectionId},'running',${kind+':'+section.title}) RETURNING id`;try{if(await shouldStop())throw Object.assign(new Error('Plex sync pausado por kill switch'),{code:'PAUSED'});const body=await pget(base,token,`/library/sections/${section.key}/all?includeGuids=1&includeMedia=1&X-Plex-Container-Start=0&X-Plex-Container-Size=20000`),items=list(body).filter(x=>x.type===kind);const existing=await sql`SELECT rating_key,plex_updated_at,plex_title,plex_year FROM plex_items WHERE library_section_id=${sectionId} AND item_type=${kind}`;const old=new Map(existing.map(x=>[String(x.rating_key),x]));let newCount=0,changedCount=0,unchangedCount=0;const baseRows=items.map(i=>{const ratingKey=String(i.ratingKey),prev=old.get(ratingKey),updated=ts(i.updatedAt),changed=!prev||String(prev.plex_title||'')!==String(i.title||'')||Number(prev.plex_year||0)!==Number(i.year||0)||(prev.plex_updated_at?new Date(prev.plex_updated_at).toISOString():null)!==updated;if(!prev)newCount++;else if(changed)changedCount++;else unchangedCount++;return{rating_key:ratingKey,library_section_id:sectionId,plex_guid:i.guid||null,plex_key:i.key||null,plex_title:i.title||null,plex_year:num(i.year),added_at:ts(i.addedAt),plex_updated_at:updated,last_viewed_at:ts(i.lastViewedAt),view_count:num(i.viewCount)||0,watched:Number(i.viewCount||0)>0,item_type:kind,parent_rating_key:i.parentRatingKey?String(i.parentRatingKey):null,grandparent_rating_key:i.grandparentRatingKey?String(i.grandparentRatingKey):null,parent_index:num(i.parentIndex),item_index:num(i.index),fingerprint:fingerprint(i),changed};});const payload=JSON.stringify(baseRows);await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS t(rating_key text,library_section_id int,plex_guid text,plex_key text,plex_title text,plex_year int,added_at timestamptz,plex_updated_at timestamptz,last_viewed_at timestamptz,view_count int,watched bool,item_type text,parent_rating_key text,grandparent_rating_key text,parent_index int,item_index int,fingerprint text,changed bool)) INSERT INTO plex_items(rating_key,library_section_id,plex_guid,plex_key,plex_title,plex_year,added_at,plex_updated_at,last_viewed_at,view_count,watched,active,missing_since,first_seen_at,last_seen_at,synced_at,fingerprint,item_type,parent_rating_key,grandparent_rating_key,parent_index,item_index) SELECT rating_key,library_section_id,plex_guid,plex_key,plex_title,plex_year,added_at,plex_updated_at,last_viewed_at,view_count,watched,true,NULL,now(),now(),now(),fingerprint,item_type,parent_rating_key,grandparent_rating_key,parent_index,item_index FROM x ON CONFLICT(rating_key) DO UPDATE SET library_section_id=EXCLUDED.library_section_id,plex_guid=EXCLUDED.plex_guid,plex_key=EXCLUDED.plex_key,plex_title=EXCLUDED.plex_title,plex_year=EXCLUDED.plex_year,added_at=EXCLUDED.added_at,plex_updated_at=EXCLUDED.plex_updated_at,last_viewed_at=EXCLUDED.last_viewed_at,view_count=EXCLUDED.view_count,watched=EXCLUDED.watched,active=true,missing_since=NULL,last_seen_at=now(),synced_at=now(),fingerprint=EXCLUDED.fingerprint,item_type=EXCLUDED.item_type,parent_rating_key=EXCLUDED.parent_rating_key,grandparent_rating_key=EXCLUDED.grandparent_rating_key,parent_index=EXCLUDED.parent_index,item_index=EXCLUDED.item_index`;const seen=JSON.stringify(baseRows.map(x=>({rating_key:x.rating_key})));const missing=await sql`WITH s AS (SELECT rating_key FROM jsonb_to_recordset(${seen}::jsonb) AS t(rating_key text)) UPDATE plex_items p SET active=false,missing_since=COALESCE(missing_since,now()),synced_at=now() WHERE p.library_section_id=${sectionId} AND p.item_type=${kind} AND p.active AND NOT EXISTS(SELECT 1 FROM s WHERE s.rating_key=p.rating_key) RETURNING p.rating_key`;const filenameCount=await upsertSectionMediaAndFiles(sql,items);const changed=baseRows.filter(x=>x.changed);const enriched=[];for(let pos=0;pos<changed.length;pos+=8){if(await shouldStop())throw Object.assign(new Error('Plex sync pausado por kill switch'),{code:'PAUSED'});const chunk=changed.slice(pos,pos+8);const got=await Promise.all(chunk.map(async b=>{const body=await pget(base,token,`/library/metadata/${b.rating_key}?includeGuids=1`);const d=list(body)[0]||{};return{rating_key:b.rating_key,guids:gids(d),media:medias(d)}}));enriched.push(...got)}if(enriched.length){const keys=enriched.map(x=>x.rating_key);await sql`DELETE FROM plex_external_ids WHERE rating_key=ANY(${keys})`;const ids=JSON.stringify(enriched.flatMap(x=>x.guids.map(g=>({rating_key:x.rating_key,...g}))));if(ids!=='[]')await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${ids}::jsonb) AS t(rating_key text,provider text,external_id text)) INSERT INTO plex_external_ids(rating_key,provider,external_id) SELECT rating_key,provider,external_id FROM x ON CONFLICT DO NOTHING`;await sql`DELETE FROM plex_media WHERE rating_key=ANY(${keys})`;const mm=JSON.stringify(enriched.flatMap(x=>x.media.map(m=>({rating_key:x.rating_key,...m,parts:undefined}))));if(mm!=='[]')await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${mm}::jsonb) AS t(rating_key text,media_index int,plex_media_id text,duration_ms bigint,bitrate int,width int,height int,resolution text,aspect_ratio float8,container text,video_codec text,video_profile text,video_frame_rate text,video_dynamic_range text,audio_codec text,audio_profile text,audio_channels int,optimized_for_streaming bool)) INSERT INTO plex_media SELECT * FROM x`;const ff=JSON.stringify(enriched.flatMap(x=>x.media.flatMap(m=>m.parts.map(p=>({rating_key:x.rating_key,media_index:m.media_index,...p})))));if(ff!=='[]')await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${ff}::jsonb) AS t(rating_key text,media_index int,part_index int,plex_part_id text,file_path text,file_size_bytes bigint,duration_ms bigint,container text,accessible bool,exists_on_server bool)) INSERT INTO plex_files SELECT * FROM x`;}await sql`UPDATE plex_sync_runs SET finished_at=now(),library_count=${items.length},new_count=${newCount},changed_count=${changedCount},unchanged_count=${unchangedCount},missing_count=${missing.length},status='success',notes=${`${kind}:${section.title}; parsed=${items.length}; details=${changed.length}; filenames=${filenameCount}; elapsedMs=${Date.now()-started.getTime()}`} WHERE id=${run.id}`;return{section_key:String(section.key),section:section.title,type:kind,total:items.length,new:newCount,changed:changedCount,unchanged:unchangedCount,missing:missing.length,details:changed.length,filenames:filenameCount};}catch(e){await sql`UPDATE plex_sync_runs SET finished_at=now(),error_count=1,status='error',notes=${String(e?.message||e).slice(0,500)} WHERE id=${run.id}`;throw e}}
async function rebuildCatalogStatus(sql){await sql`
WITH plex_matches AS (
  SELECT m.imdb_id,p.rating_key,p.active,p.synced_at,p.last_seen_at,1::int match_priority
  FROM movies m
  JOIN plex_external_ids e ON e.provider='imdb' AND e.external_id=m.imdb_id
  JOIN plex_items p ON p.rating_key=e.rating_key
  WHERE COALESCE(m.source_status->>'identity_mode','normal')<>'tmdb_only'
    AND ((m.type='Película' AND p.item_type='movie') OR (m.type IN('Serie','Miniserie') AND p.item_type='show'))
  UNION ALL
  SELECT m.imdb_id,p.rating_key,p.active,p.synced_at,p.last_seen_at,1::int match_priority
  FROM movies m
  JOIN plex_external_ids e ON e.provider='tmdb' AND e.external_id=m.tmdb_id::text
  JOIN plex_items p ON p.rating_key=e.rating_key
  WHERE COALESCE(m.source_status->>'identity_mode','normal')='tmdb_only' AND m.tmdb_id IS NOT NULL
    AND m.type IN('Serie','Miniserie') AND p.item_type='show'
  UNION ALL
  SELECT m.imdb_id,p.rating_key,p.active,p.synced_at,p.last_seen_at,2::int match_priority
  FROM movies m
  JOIN plex_external_ids e ON e.provider='imdb' AND e.external_id=m.imdb_id
  JOIN plex_items p ON p.rating_key=e.rating_key
  WHERE COALESCE(m.source_status->>'identity_mode','normal')='tmdb_only'
    AND m.type IN('Serie','Miniserie') AND p.item_type='show'
),
best_match AS (
  SELECT DISTINCT ON (imdb_id) imdb_id,rating_key,active,synced_at,last_seen_at
  FROM plex_matches
  ORDER BY imdb_id,active DESC,match_priority,last_seen_at DESC NULLS LAST,rating_key
)
INSERT INTO plex_catalog_status(imdb_id,status,rating_key,resolution,last_confirmed_at,source_updated_at,updated_at)
SELECT m.imdb_id,
  CASE WHEN p.rating_key IS NOT NULL AND p.active THEN 'in_plex' ELSE 'missing' END,
  p.rating_key,
  media.resolution,
  CASE WHEN p.rating_key IS NOT NULL AND p.active THEN now() ELSE pcs.last_confirmed_at END,
  p.synced_at,
  now()
FROM movies m
LEFT JOIN best_match p ON p.imdb_id=m.imdb_id
LEFT JOIN LATERAL (
  SELECT pm.resolution
  FROM plex_media pm
  WHERE pm.rating_key=p.rating_key
  ORDER BY (COALESCE(pm.width,0)*COALESCE(pm.height,0)) DESC NULLS LAST,pm.media_index
  LIMIT 1
) media ON true
LEFT JOIN plex_catalog_status pcs ON pcs.imdb_id=m.imdb_id
ON CONFLICT(imdb_id) DO UPDATE SET
  status=EXCLUDED.status,
  rating_key=EXCLUDED.rating_key,
  resolution=EXCLUDED.resolution,
  last_confirmed_at=EXCLUDED.last_confirmed_at,
  source_updated_at=EXCLUDED.source_updated_at,
  updated_at=now()`;}
export async function probePlexCore({token,baseUrl=''}){if(!token)throw Object.assign(new Error('PLEX_TOKEN no está configurado'),{permanent:true,status:401});const base=await discoverPlexUrlCore(token,baseUrl),root=await pget(base,token,'/library/sections'),sections=list(root).filter(s=>s.type==='movie'||s.type==='show').map(s=>({key:String(s.key),title:s.title||null,type:s.type||null}));if(!sections.length)throw Object.assign(new Error('No se encontraron bibliotecas de películas/series en Plex'),{permanent:true});return{source:'plex',probe:true,sections,section_count:sections.length};}
export async function syncPlexFastCore({sql,token,baseUrl='',completedSectionKeys=[],onCheckpoint=async()=>{},shouldStop=async()=>false}){if(!token)throw Object.assign(new Error('PLEX_TOKEN no está configurado'),{permanent:true,status:401});const base=await discoverPlexUrlCore(token,baseUrl),root=await pget(base,token,'/library/sections'),sections=list(root).filter(s=>s.type==='movie'||s.type==='show');if(!sections.length)throw new Error('No se encontraron bibliotecas de películas/series en Plex');const completed=new Set((completedSectionKeys||[]).map(String)),results=[];for(const s of sections){if(completed.has(String(s.key)))continue;if(await shouldStop())throw Object.assign(new Error('Plex sync pausado por kill switch'),{code:'PAUSED'});const result=await syncSection(sql,base,token,s,{shouldStop});results.push(result);completed.add(String(s.key));await onCheckpoint({completed_sections:[...completed],last_section:result,partial_results:results});}if(await shouldStop())throw Object.assign(new Error('Plex sync pausado por kill switch'),{code:'PAUSED'});const seriesIdentityChanges=await reconcileSeriesReferencesFromPlexCore(sql);await rebuildCatalogStatus(sql);return{source:'plex',sync:true,completed_sections:[...completed],results,total:results.reduce((a,x)=>a+x.total,0),new:results.reduce((a,x)=>a+x.new,0),changed:results.reduce((a,x)=>a+x.changed,0),missing:results.reduce((a,x)=>a+x.missing,0),filenames:results.reduce((a,x)=>a+(x.filenames||0),0),seriesIdentityChanges};}
