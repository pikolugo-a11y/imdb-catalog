import 'server-only';
import crypto from 'node:crypto';
import {db} from './db';
import {reconcileSeriesReferencesFromPlex} from './series-reference-reconcile';

const CLIENT='pikofilm-fast-sync';
const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'2'});
const ts=v=>v?new Date(Number(v)*1000).toISOString():null;
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fingerprint=i=>crypto.createHash('sha256').update([i.ratingKey,i.type,i.title,i.year,i.updatedAt].join('|')).digest('hex');

function attrs(s){const out={};for(const m of s.matchAll(/([\w:-]+)="([^"]*)"/g))out[m[1]]=m[2].replaceAll('&amp;','&');return out}
async function discoverPlexUrl(token){
  if(process.env.PLEX_URL||process.env.PLEX_BASE_URL)return String(process.env.PLEX_URL||process.env.PLEX_BASE_URL).replace(/\/$/,'');
  const r=await fetch('https://plex.tv/api/resources?includeHttps=1',{headers:{'X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT},cache:'no-store'});
  if(!r.ok)throw new Error(`No se pudo descubrir Plex (${r.status})`);
  const xml=await r.text(),devices=[...xml.matchAll(/<Device\b([^>]*)>([\s\S]*?)<\/Device>/g)];
  for(const d of devices){const a=attrs(d[1]);if(!String(a.provides||'').includes('server'))continue;const cons=[...d[2].matchAll(/<Connection\b([^>]*)\/?\s*>/g)].map(x=>attrs(x[1]));const best=cons.find(x=>x.local==='0'&&x.relay!=='1'&&String(x.uri||'').startsWith('https://'))||cons.find(x=>x.local==='0'&&x.relay!=='1')||cons.find(x=>x.relay==='1')||cons[0];if(best?.uri)return best.uri.replace(/\/$/,'')}
  throw new Error('Plex no publica una conexión remota accesible. Configura PLEX_URL en Vercel.');
}
async function pget(base,token,path){const r=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Plex ${path} respondió ${r.status}`);return r.json()}
function list(meta){const c=meta?.MediaContainer||{};return c.Metadata||c.Video||c.Directory||[]}
function gids(item){const rows=[];for(const g of item?.Guid||[]){const id=String(g.id||'');const m=id.match(/^(imdb|tmdb|tvdb):\/\/(.+)$/);if(m)rows.push({provider:m[1],external_id:m[2]})}return rows}
function medias(item){return (item?.Media||[]).map((m,mi)=>({media_index:mi,plex_media_id:String(m.id||''),duration_ms:num(m.duration),bitrate:num(m.bitrate),width:num(m.width),height:num(m.height),resolution:m.videoResolution||null,aspect_ratio:num(m.aspectRatio),container:m.container||null,video_codec:m.videoCodec||null,video_profile:m.videoProfile||null,video_frame_rate:m.videoFrameRate||null,video_dynamic_range:m.videoDynamicRange||null,audio_codec:m.audioCodec||null,audio_profile:m.audioProfile||null,audio_channels:num(m.audioChannels),optimized_for_streaming:m.optimizedForStreaming===true||m.optimizedForStreaming===1,parts:(m.Part||[]).map((p,pi)=>({part_index:pi,plex_part_id:String(p.id||''),file_path:p.file||null,file_size_bytes:num(p.size),duration_ms:num(p.duration),container:p.container||null,accessible:p.accessible==null?null:Boolean(p.accessible),exists_on_server:p.exists==null?null:Boolean(p.exists)}))}))}

async function syncSection(sql,base,token,section){
  const sectionId=Number(section.key),kind=section.type==='show'?'show':'movie',started=new Date();
  const [run]=await sql`INSERT INTO plex_sync_runs(sync_mode,library_section_id,status,notes) VALUES('incremental',${sectionId},'running',${kind+':'+section.title}) RETURNING id`;
  try{
    const body=await pget(base,token,`/library/sections/${section.key}/all?includeGuids=1&X-Plex-Container-Start=0&X-Plex-Container-Size=20000`),items=list(body).filter(x=>x.type===kind);
    const existing=await sql`SELECT rating_key,plex_updated_at,plex_title,plex_year FROM plex_items WHERE library_section_id=${sectionId} AND item_type=${kind}`;
    const old=new Map(existing.map(x=>[String(x.rating_key),x]));let newCount=0,changedCount=0,unchangedCount=0;
    const baseRows=items.map(i=>{const ratingKey=String(i.ratingKey),prev=old.get(ratingKey),updated=ts(i.updatedAt),changed=!prev||String(prev.plex_title||'')!==String(i.title||'')||Number(prev.plex_year||0)!==Number(i.year||0)||(prev.plex_updated_at?new Date(prev.plex_updated_at).toISOString():null)!==updated;if(!prev)newCount++;else if(changed)changedCount++;else unchangedCount++;return{rating_key:ratingKey,library_section_id:sectionId,plex_guid:i.guid||null,plex_key:i.key||null,plex_title:i.title||null,plex_year:num(i.year),added_at:ts(i.addedAt),plex_updated_at:updated,last_viewed_at:ts(i.lastViewedAt),view_count:num(i.viewCount)||0,watched:Number(i.viewCount||0)>0,item_type:kind,parent_rating_key:i.parentRatingKey?String(i.parentRatingKey):null,grandparent_rating_key:i.grandparentRatingKey?String(i.grandparentRatingKey):null,parent_index:num(i.parentIndex),item_index:num(i.index),fingerprint:fingerprint(i),changed};});
    const payload=JSON.stringify(baseRows);
    await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS t(rating_key text,library_section_id int,plex_guid text,plex_key text,plex_title text,plex_year int,added_at timestamptz,plex_updated_at timestamptz,last_viewed_at timestamptz,view_count int,watched bool,item_type text,parent_rating_key text,grandparent_rating_key text,parent_index int,item_index int,fingerprint text,changed bool)) INSERT INTO plex_items(rating_key,library_section_id,plex_guid,plex_key,plex_title,plex_year,added_at,plex_updated_at,last_viewed_at,view_count,watched,active,missing_since,first_seen_at,last_seen_at,synced_at,fingerprint,item_type,parent_rating_key,grandparent_rating_key,parent_index,item_index) SELECT rating_key,library_section_id,plex_guid,plex_key,plex_title,plex_year,added_at,plex_updated_at,last_viewed_at,view_count,watched,true,NULL,now(),now(),now(),fingerprint,item_type,parent_rating_key,grandparent_rating_key,parent_index,item_index FROM x ON CONFLICT(rating_key) DO UPDATE SET library_section_id=EXCLUDED.library_section_id,plex_guid=EXCLUDED.plex_guid,plex_key=EXCLUDED.plex_key,plex_title=EXCLUDED.plex_title,plex_year=EXCLUDED.plex_year,added_at=EXCLUDED.added_at,plex_updated_at=EXCLUDED.plex_updated_at,last_viewed_at=EXCLUDED.last_viewed_at,view_count=EXCLUDED.view_count,watched=EXCLUDED.watched,active=true,missing_since=NULL,last_seen_at=now(),synced_at=now(),fingerprint=EXCLUDED.fingerprint,item_type=EXCLUDED.item_type,parent_rating_key=EXCLUDED.parent_rating_key,grandparent_rating_key=EXCLUDED.grandparent_rating_key,parent_index=EXCLUDED.parent_index,item_index=EXCLUDED.item_index`;
    const seen=JSON.stringify(baseRows.map(x=>({rating_key:x.rating_key})));
    const missing=await sql`WITH s AS (SELECT rating_key FROM jsonb_to_recordset(${seen}::jsonb) AS t(rating_key text)) UPDATE plex_items p SET active=false,missing_since=COALESCE(missing_since,now()),synced_at=now() WHERE p.library_section_id=${sectionId} AND p.item_type=${kind} AND p.active AND NOT EXISTS(SELECT 1 FROM s WHERE s.rating_key=p.rating_key) RETURNING p.rating_key`;
    const changed=baseRows.filter(x=>x.changed);const enriched=[];
    for(let pos=0;pos<changed.length;pos+=8){const chunk=changed.slice(pos,pos+8);const got=await Promise.all(chunk.map(async b=>{const body=await pget(base,token,`/library/metadata/${b.rating_key}?includeGuids=1`);const d=list(body)[0]||{};return{rating_key:b.rating_key,guids:gids(d),media:medias(d)}}));enriched.push(...got)}
    if(enriched.length){const keys=enriched.map(x=>x.rating_key);await sql`DELETE FROM plex_external_ids WHERE rating_key=ANY(${keys})`;const ids=JSON.stringify(enriched.flatMap(x=>x.guids.map(g=>({rating_key:x.rating_key,...g}))));if(ids!=='[]')await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${ids}::jsonb) AS t(rating_key text,provider text,external_id text)) INSERT INTO plex_external_ids(rating_key,provider,external_id) SELECT rating_key,provider,external_id FROM x ON CONFLICT DO NOTHING`;
      await sql`DELETE FROM plex_media WHERE rating_key=ANY(${keys})`;
      const mm=JSON.stringify(enriched.flatMap(x=>x.media.map(m=>({rating_key:x.rating_key,...m,parts:undefined}))));if(mm!=='[]')await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${mm}::jsonb) AS t(rating_key text,media_index int,plex_media_id text,duration_ms bigint,bitrate int,width int,height int,resolution text,aspect_ratio float8,container text,video_codec text,video_profile text,video_frame_rate text,video_dynamic_range text,audio_codec text,audio_profile text,audio_channels int,optimized_for_streaming bool)) INSERT INTO plex_media SELECT * FROM x`;
      const ff=JSON.stringify(enriched.flatMap(x=>x.media.flatMap(m=>m.parts.map(p=>({rating_key:x.rating_key,media_index:m.media_index,...p})))));if(ff!=='[]')await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${ff}::jsonb) AS t(rating_key text,media_index int,part_index int,plex_part_id text,file_path text,file_size_bytes bigint,duration_ms bigint,container text,accessible bool,exists_on_server bool)) INSERT INTO plex_files SELECT * FROM x`;
    }
    await sql`UPDATE plex_sync_runs SET finished_at=now(),library_count=${items.length},new_count=${newCount},changed_count=${changedCount},unchanged_count=${unchangedCount},missing_count=${missing.length},status='success',notes=${`${kind}:${section.title}; parsed=${items.length}; details=${changed.length}; elapsedMs=${Date.now()-started.getTime()}`} WHERE id=${run.id}`;
    return{section:section.title,type:kind,total:items.length,new:newCount,changed:changedCount,unchanged:unchangedCount,missing:missing.length,details:changed.length};
  }catch(e){await sql`UPDATE plex_sync_runs SET finished_at=now(),error_count=1,status='error',notes=${String(e?.message||e).slice(0,500)} WHERE id=${run.id}`;throw e}
}

async function rebuildCatalogStatus(sql){
  await sql`INSERT INTO plex_catalog_status(imdb_id,status,rating_key,resolution,last_confirmed_at,source_updated_at,updated_at) SELECT m.imdb_id,CASE WHEN p.rating_key IS NOT NULL AND p.in_plex THEN 'in_plex' ELSE 'missing' END,p.rating_key,p.resolution,CASE WHEN p.rating_key IS NOT NULL AND p.in_plex THEN now() ELSE pcs.last_confirmed_at END,p.synced_at,now() FROM movies m LEFT JOIN plex_library p ON p.imdb_id=m.imdb_id LEFT JOIN plex_catalog_status pcs ON pcs.imdb_id=m.imdb_id ON CONFLICT(imdb_id) DO UPDATE SET status=EXCLUDED.status,rating_key=EXCLUDED.rating_key,resolution=EXCLUDED.resolution,last_confirmed_at=EXCLUDED.last_confirmed_at,source_updated_at=EXCLUDED.source_updated_at,updated_at=now()`;
}

export async function syncPlexFast(){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado en Vercel');
  const sql=db(),base=await discoverPlexUrl(token),root=await pget(base,token,'/library/sections'),sections=list(root).filter(s=>s.type==='movie'||s.type==='show');
  if(!sections.length)throw new Error('No se encontraron bibliotecas de películas/series en Plex');
  const results=[];
  for(const s of sections)results.push(await syncSection(sql,base,token,s));
  const seriesIdentityChanges=await reconcileSeriesReferencesFromPlex(sql);
  await rebuildCatalogStatus(sql);
  return{ok:true,results,total:results.reduce((a,x)=>a+x.total,0),new:results.reduce((a,x)=>a+x.new,0),changed:results.reduce((a,x)=>a+x.changed,0),missing:results.reduce((a,x)=>a+x.missing,0),seriesIdentityChanges};
}
