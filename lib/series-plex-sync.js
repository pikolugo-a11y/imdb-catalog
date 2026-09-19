import 'server-only';
import crypto from 'node:crypto';
import {db} from './db';
import {audit} from './runlog';
import {discoverPlexUrlCore} from './plex-sync-core.mjs';
import {rebuildSeriesDiagnostics} from './series-diagnostics-core.mjs';
import {recomputeLifecycleForIds} from './lifecycle';
import {executeObservedProcess} from './process-runtime';
import {normalizePlexEpisode,planEpisodeInventoryDiff} from './series-plex-episode-diff.mjs';
import {fetchPlexJsonWithRetry} from './plex-request-error.mjs';

const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':'pikofilm-series-sync','X-Plex-Product':'PikoFilm','X-Plex-Version':'3'});
const list=b=>b?.MediaContainer?.Metadata||b?.MediaContainer?.Directory||b?.MediaContainer?.Video||[];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const filenameOf=v=>{const s=String(v||'').trim();if(!s)return null;const parts=s.split(/[\\/]/);return parts[parts.length-1]||null};
const EPISODE_PAGE_SIZE=5000;
const EPISODE_PAGE_CONCURRENCY=Math.max(1,Math.min(Number(process.env.PLEX_EPISODE_PAGE_CONCURRENCY)||3,6));
const PLEX_REQUEST_TIMEOUTS=[45000,60000,90000];
async function get(base,token,path,trace=null){return fetchPlexJsonWithRetry({url:base+path,path,headers:headers(token),trace,timeouts:PLEX_REQUEST_TIMEOUTS})}
const fingerprint=s=>crypto.createHash('sha256').update([s.ratingKey,s.type,s.title,s.year,s.updatedAt].join('|')).digest('hex');
function medias(item){return(item?.Media||[]).map((m,mi)=>({media_index:mi,plex_media_id:String(m.id||''),duration_ms:num(m.duration),bitrate:num(m.bitrate),width:num(m.width),height:num(m.height),resolution:m.videoResolution||null,aspect_ratio:num(m.aspectRatio),container:m.container||null,video_codec:m.videoCodec||null,video_profile:m.videoProfile||null,video_frame_rate:m.videoFrameRate||null,video_dynamic_range:m.videoDynamicRange||null,audio_codec:m.audioCodec||null,audio_profile:m.audioProfile||null,audio_channels:num(m.audioChannels),optimized_for_streaming:m.optimizedForStreaming===true||m.optimizedForStreaming===1,parts:(m.Part||[]).map((p,pi)=>({part_index:pi,plex_part_id:String(p.id||''),file_path:filenameOf(p.file),file_size_bytes:num(p.size),duration_ms:num(p.duration),container:p.container||null,accessible:p.accessible==null?null:Boolean(p.accessible),exists_on_server:p.exists==null?null:Boolean(p.exists)}))}))}
async function heartbeat(trace,context=null){if(typeof trace?.heartbeat==='function')await trace.heartbeat(context)}
async function loadEpisodePage(base,token,section,start,trace){const body=await get(base,token,`/library/sections/${section.key}/all?type=4&includeGuids=0&includeMedia=0&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${EPISODE_PAGE_SIZE}`,trace),container=body?.MediaContainer||{},raw=list(body).filter(x=>x.type==='episode'),normalized=raw.map(e=>normalizePlexEpisode(e,{sectionId:Number(section.key),fingerprint:fingerprint(e)}));if(normalized.some(x=>!x))throw Object.assign(new Error(`Plex devolvió un episodio sin identidad completa en ${section.title||section.key}`),{processStep:'episode_inventory'});const total=Number(container.totalSize??container.TotalSize);return{normalized,received:raw.length,total:Number.isFinite(total)&&total>=0?total:null}}

async function loadSectionEpisodeInventory(base,token,section,trace){
  await heartbeat(trace,{step:'episode_inventory',section:String(section.key),start:0});
  const first=await loadEpisodePage(base,token,section,0,trace),rows=[...first.normalized],expectedTotal=first.total;
  if(expectedTotal!=null){
    if(rows.length===expectedTotal)return rows;
    if(first.received===0)throw Object.assign(new Error(`Inventario de episodios incompleto en ${section.title||section.key}: ${rows.length}/${expectedTotal}`),{processStep:'episode_inventory'});
    const stride=first.received,starts=[];for(let start=stride;start<expectedTotal;start+=stride)starts.push(start);
    if(starts.length+1>200)throw Object.assign(new Error(`Inventario de episodios excede el límite de paginación en ${section.title||section.key}`),{processStep:'episode_inventory'});
    for(let pos=0;pos<starts.length;pos+=EPISODE_PAGE_CONCURRENCY){const chunk=starts.slice(pos,pos+EPISODE_PAGE_CONCURRENCY);await heartbeat(trace,{step:'episode_inventory',section:String(section.key),pages_done:pos+1,pages_total:starts.length+1});const pages=await Promise.all(chunk.map(start=>loadEpisodePage(base,token,section,start,trace)));for(const page of pages)rows.push(...page.normalized)}
    if(rows.length!==expectedTotal)throw Object.assign(new Error(`Inventario de episodios incompleto en ${section.title||section.key}: ${rows.length}/${expectedTotal}`),{processStep:'episode_inventory'});
    return rows;
  }
  let start=first.received,pages=1,received=first.received;
  while(pages<200&&received===EPISODE_PAGE_SIZE){await heartbeat(trace,{step:'episode_inventory',section:String(section.key),pages_done:pages});const page=await loadEpisodePage(base,token,section,start,trace);rows.push(...page.normalized);received=page.received;start+=received;pages++;if(received===0)break}
  if(pages>=200)throw Object.assign(new Error(`Inventario de episodios excede el límite de paginación en ${section.title||section.key}`),{processStep:'episode_inventory'});
  return rows;
}

async function refreshChangedEpisodeMedia({base,token,sql,episodeKeys,removedKeys,trace}){
  const detailed=[];
  for(let pos=0;pos<episodeKeys.length;pos+=8){
    await heartbeat(trace,{step:'refresh_physical_media',processed:pos,total:episodeKeys.length});
    const chunk=episodeKeys.slice(pos,pos+8),batch=await Promise.all(chunk.map(async episodeKey=>{const d=list(await get(base,token,`/library/metadata/${episodeKey}?includeMedia=1`,trace))[0]||{};return{rating_key:episodeKey,media:medias(d)}}));
    detailed.push(...batch);
  }
  const affected=[...new Set([...episodeKeys,...removedKeys])];
  if(affected.length){await sql`DELETE FROM plex_media WHERE rating_key=ANY(${affected})`;await sql`DELETE FROM plex_files WHERE rating_key=ANY(${affected})`}
  const mediaRows=detailed.flatMap(x=>x.media.map(m=>({rating_key:x.rating_key,media_index:m.media_index,plex_media_id:m.plex_media_id,duration_ms:m.duration_ms,bitrate:m.bitrate,width:m.width,height:m.height,resolution:m.resolution,aspect_ratio:m.aspect_ratio,container:m.container,video_codec:m.video_codec,video_profile:m.video_profile,video_frame_rate:m.video_frame_rate,video_dynamic_range:m.video_dynamic_range,audio_codec:m.audio_codec,audio_profile:m.audio_profile,audio_channels:m.audio_channels,optimized_for_streaming:m.optimized_for_streaming}))),fileRows=detailed.flatMap(x=>x.media.flatMap(m=>m.parts.filter(p=>p.file_path).map(p=>({rating_key:x.rating_key,media_index:m.media_index,part_index:p.part_index,plex_part_id:p.plex_part_id,file_path:p.file_path,file_size_bytes:p.file_size_bytes,duration_ms:p.duration_ms,container:p.container,accessible:p.accessible,exists_on_server:p.exists_on_server}))));
  if(mediaRows.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(mediaRows)}::jsonb) AS t(rating_key text,media_index int,plex_media_id text,duration_ms bigint,bitrate int,width int,height int,resolution text,aspect_ratio float8,container text,video_codec text,video_profile text,video_frame_rate text,video_dynamic_range text,audio_codec text,audio_profile text,audio_channels int,optimized_for_streaming bool)) INSERT INTO plex_media SELECT * FROM x`;
  if(fileRows.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(fileRows)}::jsonb) AS t(rating_key text,media_index int,part_index int,plex_part_id text,file_path text,file_size_bytes bigint,duration_ms bigint,container text,accessible bool,exists_on_server bool)) INSERT INTO plex_files SELECT * FROM x`;
  return{detailed:detailed.length,mediaRows:mediaRows.length,fileRows:fileRows.length};
}

async function applyEpisodeInventoryDiff({base,token,sql,episodeSections,changedShowKeys,trace}){
  if(!episodeSections.length)return{examined:0,created:0,changed:0,missing:0,seriesAffected:0,mediaDetailed:0,mediaRows:0,fileRows:0,reconciled:0};
  const sectionIds=episodeSections.map(x=>Number(x.section)),incoming=episodeSections.flatMap(x=>x.episodes),existing=await sql`SELECT p.rating_key,p.library_section_id,p.plex_title,p.plex_year,p.plex_updated_at,p.parent_rating_key,p.grandparent_rating_key,p.parent_index,p.item_index,p.fingerprint,p.active,EXISTS(SELECT 1 FROM plex_media m WHERE m.rating_key=p.rating_key) has_media FROM plex_items p WHERE p.item_type='episode' AND p.library_section_id=ANY(${sectionIds})`;
  const diff=planEpisodeInventoryDiff({incoming,existing,successfulSectionIds:sectionIds});
  for(let pos=0;pos<diff.upserts.length;pos+=500){
    const payload=diff.upserts.slice(pos,pos+500);
    await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(rating_key text,library_section_id int,plex_title text,plex_year int,plex_updated_at timestamptz,parent_rating_key text,grandparent_rating_key text,parent_index int,item_index int,fingerprint text)) INSERT INTO plex_items(rating_key,library_section_id,plex_title,plex_year,plex_updated_at,parent_rating_key,grandparent_rating_key,parent_index,item_index,fingerprint,item_type,active,first_seen_at,last_seen_at,synced_at) SELECT rating_key,library_section_id,plex_title,plex_year,plex_updated_at,parent_rating_key,grandparent_rating_key,parent_index,item_index,fingerprint,'episode',true,now(),now(),now() FROM x ON CONFLICT(rating_key) DO UPDATE SET library_section_id=EXCLUDED.library_section_id,plex_title=EXCLUDED.plex_title,plex_year=EXCLUDED.plex_year,plex_updated_at=EXCLUDED.plex_updated_at,parent_rating_key=EXCLUDED.parent_rating_key,grandparent_rating_key=EXCLUDED.grandparent_rating_key,parent_index=EXCLUDED.parent_index,item_index=EXCLUDED.item_index,fingerprint=EXCLUDED.fingerprint,active=true,missing_since=NULL,last_seen_at=now(),synced_at=now()`;
  }
  const removedKeys=diff.missing.map(x=>String(x.rating_key));
  if(removedKeys.length)await sql`UPDATE plex_items SET active=false,missing_since=COALESCE(missing_since,now()),synced_at=now() WHERE item_type='episode' AND active AND rating_key=ANY(${removedKeys})`;
  const detailKeys=diff.upserts.map(x=>String(x.rating_key));
  const physical=await refreshChangedEpisodeMedia({base,token,sql,episodeKeys:detailKeys,removedKeys,trace});
  const activeAffected=diff.affectedShowKeys.length?await sql`SELECT DISTINCT r.show_rating_key,r.imdb_id FROM series_reference r JOIN plex_items p ON p.rating_key=r.show_rating_key AND p.item_type='show' AND p.active WHERE r.show_rating_key=ANY(${diff.affectedShowKeys})`:[];
  for(const row of activeAffected){await heartbeat(trace,{step:'rebuild_diagnostics',show_rating_key:String(row.show_rating_key)});await rebuildSeriesDiagnostics(sql,String(row.show_rating_key))}
  const imdbIds=[...new Set(activeAffected.map(x=>x.imdb_id).filter(Boolean).map(String))];if(imdbIds.length)await recomputeLifecycleForIds(imdbIds);
  const scannedShowKeys=[...new Set(episodeSections.flatMap(x=>x.showKeys||[]).map(String))],resolvableChanged=changedShowKeys.filter(x=>scannedShowKeys.includes(String(x)));
  if(resolvableChanged.length)await sql`UPDATE series_reference SET plex_invalidated_at=NULL,plex_invalid_reason=NULL WHERE show_rating_key=ANY(${resolvableChanged}) AND plex_invalid_reason='show_fingerprint_changed' AND plex_detail_refreshed_at IS NOT NULL`;
  const refreshedKeys=activeAffected.map(x=>String(x.show_rating_key));if(refreshedKeys.length)await sql`UPDATE series_reference SET plex_detail_refreshed_at=now() WHERE show_rating_key=ANY(${refreshedKeys}) AND plex_detail_refreshed_at IS NOT NULL AND plex_invalidated_at IS NULL`;
  return{examined:incoming.length,created:diff.created.length,changed:diff.changed.length,missing:diff.missing.length,seriesAffected:diff.affectedShowKeys.length,mediaDetailed:physical.detailed,mediaRows:physical.mediaRows,fileRows:physical.fileRows,reconciled:activeAffected.length};
}

export async function syncPlexSeriesFastCore({trace=null}={}){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado');
  const sql=db(),started=Date.now();
  await trace?.event?.({eventType:'step_started',step:'discover_plex',message:'Localizando servidor Plex'});
  await heartbeat(trace,{step:'discover_plex'});trace?.externalCall?.(1);const base=await discoverPlexUrlCore(token,process.env.PLEX_URL||process.env.PLEX_BASE_URL||'');
  const sections=list(await get(base,token,'/library/sections',trace)).filter(s=>s.type==='show');
  await trace?.event?.({eventType:'step_completed',step:'discover_plex',message:`${sections.length} bibliotecas de series encontradas`,data:{libraries:sections.length}});
  let examined=0,changed=0,created=0,missing=0;const successful=[],failed=[],episodeSections=[],episodeFailed=[],changedShowKeys=[];
  for(const section of sections){
    const sectionKey=String(section.key),sectionTitle=section.title||null;await heartbeat(trace,{step:'sync_library',section:sectionKey});await trace?.event?.({eventType:'step_started',step:'sync_library',entityType:'series_library',entityId:sectionKey,message:`Sincronizando biblioteca ${sectionTitle||sectionKey}`});
    let showKeys=[];
    try{
      const shows=list(await get(base,token,`/library/sections/${section.key}/all?includeGuids=0&X-Plex-Container-Start=0&X-Plex-Container-Size=20000`,trace)).filter(x=>x.type==='show');examined+=shows.length;
      showKeys=shows.map(x=>String(x.ratingKey));const existing=showKeys.length?await sql`SELECT rating_key,fingerprint FROM plex_items WHERE rating_key=ANY(${showKeys})`:[],old=new Map(existing.map(x=>[String(x.rating_key),x]));
      const rows=shows.map(s=>({rating_key:String(s.ratingKey),library_section_id:Number(section.key),plex_title:s.title||null,plex_year:Number(s.year)||null,plex_updated_at:s.updatedAt?new Date(Number(s.updatedAt)*1000).toISOString():null,fingerprint:fingerprint(s),changed:!old.has(String(s.ratingKey))||old.get(String(s.ratingKey)).fingerprint!==fingerprint(s)}));
      const newRows=rows.filter(x=>!old.has(x.rating_key)),changedRows=rows.filter(x=>old.has(x.rating_key)&&x.changed);created+=newRows.length;changed+=changedRows.length;changedShowKeys.push(...changedRows.map(x=>x.rating_key));
      if(rows.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS t(rating_key text,library_section_id int,plex_title text,plex_year int,plex_updated_at timestamptz,fingerprint text,changed bool)) INSERT INTO plex_items(rating_key,library_section_id,plex_title,plex_year,plex_updated_at,fingerprint,item_type,active,first_seen_at,last_seen_at,synced_at) SELECT rating_key,library_section_id,plex_title,plex_year,plex_updated_at,fingerprint,'show',true,now(),now(),now() FROM x ON CONFLICT(rating_key) DO UPDATE SET library_section_id=EXCLUDED.library_section_id,plex_title=EXCLUDED.plex_title,plex_year=EXCLUDED.plex_year,plex_updated_at=EXCLUDED.plex_updated_at,fingerprint=EXCLUDED.fingerprint,active=true,missing_since=NULL,last_seen_at=now(),synced_at=now()`;
      if(changedRows.length)await sql`UPDATE series_reference SET plex_invalidated_at=now(),plex_invalid_reason='show_fingerprint_changed' WHERE show_rating_key=ANY(${changedRows.map(x=>x.rating_key)})`;
      successful.push({section:Number(section.key),keys:showKeys});await trace?.event?.({eventType:'step_completed',step:'sync_library',entityType:'series_library',entityId:sectionKey,message:`Biblioteca sincronizada: ${shows.length} series`,data:{examined:shows.length,created:newRows.length,changed:changedRows.length}});
    }catch(e){await audit('quality','series',sectionKey,'plex_series_fast_section_failed',{error:e?.message||String(e),retryable:Boolean(e?.retryable)});if(e?.retryable){e.processStep=e.processStep||'sync_library';throw e}failed.push({section:sectionKey,title:sectionTitle,error:e?.message||String(e)});await trace?.event?.({eventType:'error',step:'sync_library',entityType:'series_library',entityId:sectionKey,message:e?.message||'Error sincronizando biblioteca',data:{source:e?.source||'plex',retryable:false}});continue}
    try{
      await trace?.event?.({eventType:'step_started',step:'sync_episode_inventory',entityType:'series_library',entityId:sectionKey,message:`Comparando inventario de episodios de ${sectionTitle||sectionKey}`});
      const episodes=await loadSectionEpisodeInventory(base,token,section,trace);
      if(showKeys.length&&episodes.length===0)throw Object.assign(new Error(`Plex devolvió 0 episodios para una biblioteca con ${showKeys.length} series; se omiten bajas de capítulos por seguridad`),{processStep:'episode_inventory'});
      episodeSections.push({section:Number(section.key),episodes,showKeys});await trace?.event?.({eventType:'step_completed',step:'sync_episode_inventory',entityType:'series_library',entityId:sectionKey,message:`Inventario ligero: ${episodes.length} episodios`,data:{episodes:episodes.length,page_concurrency:EPISODE_PAGE_CONCURRENCY}});
    }catch(e){await audit('quality','series',sectionKey,'plex_series_fast_episode_inventory_failed',{error:e?.message||String(e),retryable:Boolean(e?.retryable)});if(e?.retryable){e.processStep=e.processStep||'sync_episode_inventory';throw e}episodeFailed.push({section:sectionKey,title:sectionTitle,error:e?.message||String(e)});await trace?.event?.({eventType:'error',step:'sync_episode_inventory',entityType:'series_library',entityId:sectionKey,message:e?.message||'Error leyendo inventario de episodios',data:{source:e?.source||'plex',retryable:false}})}
  }
  for(const s of successful){const gone=await sql`UPDATE plex_items SET active=false,missing_since=COALESCE(missing_since,now()),synced_at=now() WHERE library_section_id=${s.section} AND item_type='show' AND active AND NOT(rating_key=ANY(${s.keys.length?s.keys:['__none__']})) RETURNING rating_key`;missing+=gone.length}
  await heartbeat(trace,{step:'apply_episode_diff'});await trace?.event?.({eventType:'step_started',step:'apply_episode_diff',message:'Aplicando sólo diferencias de episodios'});
  const episode=await applyEpisodeInventoryDiff({base,token,sql,episodeSections,changedShowKeys:[...new Set(changedShowKeys)],trace});
  await trace?.event?.({eventType:'step_completed',step:'apply_episode_diff',message:`Diferencias de episodios: ${episode.created} nuevos · ${episode.changed} corregidos · ${episode.missing} eliminados`,data:episode});
  const partial=failed.length>0||episodeFailed.length>0,result={examined,changed,created,missing,libraries:sections.length,librariesSucceeded:successful.length,librariesFailed:failed.length,episodeExamined:episode.examined,episodeCreated:episode.created,episodeChanged:episode.changed,episodeMissing:episode.missing,episodeSeriesAffected:episode.seriesAffected,episodeMediaDetailed:episode.mediaDetailed,episodeMediaRows:episode.mediaRows,episodeFileRows:episode.fileRows,episodeReconciled:episode.reconciled,episodeLibrariesSucceeded:episodeSections.length,episodeLibrariesFailed:episodeFailed.length,durationMs:Date.now()-started,partial,failedLibraries:failed.slice(0,20),failedEpisodeLibraries:episodeFailed.slice(0,20)};
  await audit('quality','series','global','plex_series_fast_completed',result);return result;
}

export async function syncPlexSeriesFast(){
  const bucket=Math.floor(Date.now()/5000),requestKey=`PROC-SER-001:manual:${bucket}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-001',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId:'global',correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/series',operation:'sync_plex_series_fast'}},async trace=>{
    const result=await syncPlexSeriesFastCore({trace});
    const episodeDelta=result.episodeCreated+result.episodeChanged+result.episodeMissing;
    return{technicalStatus:result.partial?'partial':'succeeded',functionalResult:result.changed||result.created||result.missing||episodeDelta?'updated':'no_change',metrics:{examined:result.examined,changed:result.changed,created:result.created,missing:result.missing,libraries:result.libraries,libraries_succeeded:result.librariesSucceeded,libraries_failed:result.librariesFailed,episodes_examined:result.episodeExamined,episodes_created:result.episodeCreated,episodes_changed:result.episodeChanged,episodes_missing:result.episodeMissing,episode_series_affected:result.episodeSeriesAffected,episode_media_detailed:result.episodeMediaDetailed,episode_libraries_failed:result.episodeLibrariesFailed},after:{partial:result.partial,failed_libraries:result.failedLibraries,failed_episode_libraries:result.failedEpisodeLibraries},message:result.partial?'Sincronización Plex de Series completada parcialmente':'Sincronización Plex de Series completada',...result};
  });
  if(observed.reused)return{examined:0,changed:0,created:0,missing:0,libraries:0,librariesSucceeded:0,librariesFailed:0,episodeExamined:0,episodeCreated:0,episodeChanged:0,episodeMissing:0,episodeSeriesAffected:0,episodeMediaDetailed:0,episodeMediaRows:0,episodeFileRows:0,episodeReconciled:0,episodeLibrariesSucceeded:0,episodeLibrariesFailed:0,durationMs:0,partial:false,reused:true,runId:observed.runId};
  return{...observed.result,reused:false,runId:observed.runId};
}

export async function syncPlexSeriesDetailCore(ratingKey,{trace=null}={}){
  const key=String(ratingKey||'').trim();if(!key)throw new Error('Serie Plex inválida');const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado');const sql=db(),started=Date.now();
  const [show]=await sql`SELECT p.rating_key,p.library_section_id,p.plex_title,x.external_id imdb_id FROM plex_items p LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' WHERE p.rating_key=${key} AND p.active AND p.item_type='show' LIMIT 1`;if(!show)throw Object.assign(new Error('Serie no encontrada en Plex local'),{processStep:'load_series'});
  await audit('quality','series',show.imdb_id||key,'plex_detail_started',{rating_key:key});
  try{
    await trace?.event?.({eventType:'step_started',step:'discover_plex',message:'Localizando servidor Plex'});await heartbeat(trace,{step:'discover_plex'});trace?.externalCall?.(1);const base=await discoverPlexUrlCore(token,process.env.PLEX_URL||process.env.PLEX_BASE_URL||'');await trace?.event?.({eventType:'step_completed',step:'discover_plex',message:'Servidor Plex localizado'});
    await trace?.event?.({eventType:'step_started',step:'load_episode_inventory',message:'Leyendo temporadas y episodios de Plex'});
    const seasons=list(await get(base,token,`/library/metadata/${key}/children`,trace)).filter(x=>x.type==='season'&&Number(x.index)>0),episodes=[];
    for(const season of seasons){await heartbeat(trace,{step:'load_episode_inventory',season:Number(season.index)});const arr=list(await get(base,token,`/library/metadata/${season.ratingKey}/children`,trace)).filter(x=>x.type==='episode');for(const e of arr){const librarySectionId=Number(e.librarySectionID)||Number(season.librarySectionID)||Number(show.library_section_id);if(!librarySectionId)throw Object.assign(new Error(`Plex no devolvió library_section_id para el episodio ${e.ratingKey||'desconocido'}`),{processStep:'load_episode_inventory'});episodes.push({rating_key:String(e.ratingKey),library_section_id:librarySectionId,plex_title:e.title||null,plex_year:Number(e.year)||null,plex_updated_at:e.updatedAt?new Date(Number(e.updatedAt)*1000).toISOString():null,parent_rating_key:String(season.ratingKey),grandparent_rating_key:key,parent_index:Number(e.parentIndex??season.index)||0,item_index:Number(e.index)||0,fingerprint:fingerprint(e)})}}
    await trace?.event?.({eventType:'step_completed',step:'load_episode_inventory',message:`${episodes.length} episodios encontrados`,data:{seasons:seasons.length,episodes:episodes.length}});
    const existing=await sql`SELECT rating_key FROM plex_items WHERE grandparent_rating_key=${key} AND item_type='episode'`,old=new Set(existing.map(x=>String(x.rating_key)));
    if(episodes.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(episodes)}::jsonb) AS t(rating_key text,library_section_id int,plex_title text,plex_year int,plex_updated_at timestamptz,parent_rating_key text,grandparent_rating_key text,parent_index int,item_index int,fingerprint text)) INSERT INTO plex_items(rating_key,library_section_id,plex_title,plex_year,plex_updated_at,parent_rating_key,grandparent_rating_key,parent_index,item_index,fingerprint,item_type,active,first_seen_at,last_seen_at,synced_at) SELECT rating_key,library_section_id,plex_title,plex_year,plex_updated_at,parent_rating_key,grandparent_rating_key,parent_index,item_index,fingerprint,'episode',true,now(),now(),now() FROM x ON CONFLICT(rating_key) DO UPDATE SET library_section_id=EXCLUDED.library_section_id,plex_title=EXCLUDED.plex_title,plex_year=EXCLUDED.plex_year,plex_updated_at=EXCLUDED.plex_updated_at,parent_rating_key=EXCLUDED.parent_rating_key,grandparent_rating_key=EXCLUDED.grandparent_rating_key,parent_index=EXCLUDED.parent_index,item_index=EXCLUDED.item_index,fingerprint=EXCLUDED.fingerprint,active=true,missing_since=NULL,last_seen_at=now(),synced_at=now()`;
    const seen=episodes.map(x=>x.rating_key),removed=[...old].filter(x=>!seen.includes(x));await sql`UPDATE plex_items SET active=false,missing_since=COALESCE(missing_since,now()),synced_at=now() WHERE grandparent_rating_key=${key} AND item_type='episode' AND active AND NOT(rating_key=ANY(${seen.length?seen:['__none__']}))`;
    await trace?.event?.({eventType:'step_started',step:'refresh_physical_media',message:'Actualizando media y archivos físicos de episodios'});
    const detailed=[];for(let pos=0;pos<seen.length;pos+=8){await heartbeat(trace,{step:'refresh_physical_media',processed:pos,total:seen.length});const chunk=seen.slice(pos,pos+8),rows=await Promise.all(chunk.map(async episodeKey=>{const d=list(await get(base,token,`/library/metadata/${episodeKey}?includeMedia=1`,trace))[0]||{};return{rating_key:episodeKey,media:medias(d)}}));detailed.push(...rows)}
    const affected=[...new Set([...seen,...removed])];if(affected.length){await sql`DELETE FROM plex_media WHERE rating_key=ANY(${affected})`;await sql`DELETE FROM plex_files WHERE rating_key=ANY(${affected})`}
    const mediaRows=detailed.flatMap(x=>x.media.map(m=>({rating_key:x.rating_key,media_index:m.media_index,plex_media_id:m.plex_media_id,duration_ms:m.duration_ms,bitrate:m.bitrate,width:m.width,height:m.height,resolution:m.resolution,aspect_ratio:m.aspect_ratio,container:m.container,video_codec:m.video_codec,video_profile:m.video_profile,video_frame_rate:m.video_frame_rate,video_dynamic_range:m.video_dynamic_range,audio_codec:m.audio_codec,audio_profile:m.audio_profile,audio_channels:m.audio_channels,optimized_for_streaming:m.optimized_for_streaming}))),fileRows=detailed.flatMap(x=>x.media.flatMap(m=>m.parts.filter(p=>p.file_path).map(p=>({rating_key:x.rating_key,media_index:m.media_index,part_index:p.part_index,plex_part_id:p.plex_part_id,file_path:p.file_path,file_size_bytes:p.file_size_bytes,duration_ms:p.duration_ms,container:p.container,accessible:p.accessible,exists_on_server:p.exists_on_server}))));
    if(mediaRows.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(mediaRows)}::jsonb) AS t(rating_key text,media_index int,plex_media_id text,duration_ms bigint,bitrate int,width int,height int,resolution text,aspect_ratio float8,container text,video_codec text,video_profile text,video_frame_rate text,video_dynamic_range text,audio_codec text,audio_profile text,audio_channels int,optimized_for_streaming bool)) INSERT INTO plex_media SELECT * FROM x`;
    if(fileRows.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(fileRows)}::jsonb) AS t(rating_key text,media_index int,part_index int,plex_part_id text,file_path text,file_size_bytes bigint,duration_ms bigint,container text,accessible bool,exists_on_server bool)) INSERT INTO plex_files SELECT * FROM x`;
    await trace?.event?.({eventType:'step_completed',step:'refresh_physical_media',message:`Media física actualizada para ${detailed.length} episodios`,data:{media_rows:mediaRows.length,file_rows:fileRows.length,removed_episode_keys:removed.length}});
    await sql`UPDATE series_reference SET plex_detail_refreshed_at=now(),plex_invalidated_at=NULL,plex_invalid_reason=NULL WHERE show_rating_key=${key}`;
    await trace?.event?.({eventType:'step_started',step:'rebuild_diagnostics',message:'Reconstruyendo diagnóstico de la serie'});const diagnostics=await rebuildSeriesDiagnostics(sql,key);await trace?.event?.({eventType:'step_completed',step:'rebuild_diagnostics',message:'Diagnóstico reconstruido',data:{official:diagnostics.official,matched:diagnostics.matched,combined:diagnostics.combined}});
    const lifecycle=show.imdb_id?(await recomputeLifecycleForIds([show.imdb_id])).get(show.imdb_id):null,result={ratingKey:key,imdbId:show.imdb_id||null,episodes:episodes.length,seasons:seasons.length,added:episodes.filter(x=>!old.has(x.rating_key)).length,removed:removed.length,mediaRows:mediaRows.length,fileRows:fileRows.length,durationMs:Date.now()-started,diagnostics,lifecycle};await audit('quality','series',show.imdb_id||key,'plex_detail_completed',result);return result;
  }catch(e){await audit('quality','series',show.imdb_id||key,'plex_detail_failed',{rating_key:key,error:e?.message||String(e),durationMs:Date.now()-started});throw e}
}

export async function syncPlexSeriesDetail(ratingKey){
  const key=String(ratingKey||'').trim(),bucket=Math.floor(Date.now()/5000),requestKey=`PROC-SER-002:manual:${key}:${bucket}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-002',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId:key,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${key}`,operation:'sync_plex_series_detail'}},async trace=>{const result=await syncPlexSeriesDetailCore(key,{trace});return{technicalStatus:'succeeded',functionalResult:result.added||result.removed?'updated':'no_change',metrics:{seasons:result.seasons,episodes:result.episodes,added:result.added,removed:result.removed,media_rows:result.mediaRows,file_rows:result.fileRows,diagnostics_matched:result.diagnostics?.matched||0,diagnostics_combined:result.diagnostics?.combined||0},after:{imdb_id:result.imdbId,lifecycle:result.lifecycle||null},message:'Detalle Plex de la serie actualizado',...result}});
  if(observed.reused)return{ratingKey:key,episodes:0,seasons:0,added:0,removed:0,mediaRows:0,fileRows:0,reused:true,runId:observed.runId};return{...observed.result,reused:false,runId:observed.runId};
}
