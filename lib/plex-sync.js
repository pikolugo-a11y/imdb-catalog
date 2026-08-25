import 'server-only';
import {db} from './db';
import {syncPlexFastCore,discoverPlexUrlCore} from './plex-sync-core.mjs';

const providers=['imdb','tmdb','tvdb'];
const mapIds=rows=>{const out=new Map();for(const r of rows){const k=String(r.rating_key);if(!out.has(k))out.set(k,{});out.get(k)[r.provider]=r.external_id}return out};
const DIAGNOSTIC_RATING_KEY='94028';
const plexHeaders=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':'pikofilm-fast-sync-diagnostic','X-Plex-Product':'PikoFilm','X-Plex-Version':'2'});
const plexTs=v=>v?new Date(Number(v)*1000).toISOString():null;

async function persistDiagnostic(sql,payload){
  try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('plex_diagnostic','plex_rating_key',${DIAGNOSTIC_RATING_KEY},'forced_live_read',${JSON.stringify(payload)}::jsonb,now())`}catch(e){console.error('[PLEX_DIAGNOSTIC_PERSIST_ERROR]',e)}
}

async function diagnosticProbe(sql,token,baseUrl){
  const [stored]=await sql`SELECT p.rating_key,p.library_section_id,p.plex_title,p.plex_year,p.plex_updated_at,p.item_type,p.active,p.added_at,p.last_seen_at,(SELECT x.external_id FROM plex_external_ids x WHERE x.rating_key=p.rating_key AND x.provider='imdb' LIMIT 1) AS imdb,(SELECT jsonb_object_agg(x.provider,x.external_id) FROM plex_external_ids x WHERE x.rating_key=p.rating_key) AS all_stored_external_ids FROM plex_items p WHERE p.rating_key=${DIAGNOSTIC_RATING_KEY} LIMIT 1`;
  const base=await discoverPlexUrlCore(token,baseUrl);
  const started=Date.now();
  const requestPath=`/library/metadata/${DIAGNOSTIC_RATING_KEY}?includeGuids=1`;
  const response=await fetch(`${base}${requestPath}`,{headers:plexHeaders(token),cache:'no-store',signal:AbortSignal.timeout(15000)});
  const responseHeaders={content_type:response.headers.get('content-type'),content_length:response.headers.get('content-length'),server:response.headers.get('server'),date:response.headers.get('date')};
  if(!response.ok)throw new Error(`Diagnóstico Plex ${DIAGNOSTIC_RATING_KEY} respondió ${response.status}`);
  const body=await response.json();
  const container=body?.MediaContainer||{};
  const item=(container.Metadata||container.Video||[])[0]||{};
  const rawGuidObjects=Array.isArray(item.Guid)?item.Guid:[];
  const rawGuids=rawGuidObjects.map(g=>String(g?.id||'')).filter(Boolean);
  const liveImdb=rawGuids.map(x=>x.match(/^imdb:\/\/(.+)$/)?.[1]).find(Boolean)||null;
  const liveTmdb=rawGuids.map(x=>x.match(/^tmdb:\/\/(.+)$/)?.[1]).find(Boolean)||null;
  const liveTvdb=rawGuids.map(x=>x.match(/^tvdb:\/\/(.+)$/)?.[1]).find(Boolean)||null;
  const liveUpdatedAt=plexTs(item.updatedAt),storedUpdatedAt=stored?.plex_updated_at?new Date(stored.plex_updated_at).toISOString():null;
  const reasons={title_changed:Boolean(stored&&String(stored.plex_title||'')!==String(item.title||'')),year_changed:Boolean(stored&&Number(stored.plex_year||0)!==Number(item.year||0)),updated_at_changed:Boolean(stored&&storedUpdatedAt!==liveUpdatedAt)};
  const wouldSelectNormally=!stored||reasons.title_changed||reasons.year_changed||reasons.updated_at_changed;
  const probe={
    mode:'READ_ONLY_FORCED_DIAGNOSTIC_EXHAUSTIVE',rating_key:DIAGNOSTIC_RATING_KEY,read_only:true,captured_at:new Date().toISOString(),fetch_ms:Date.now()-started,
    request:{path:requestPath,base_host:new URL(base).host,method:'GET',include_guids:true},response:{status:response.status,status_text:response.statusText,headers:responseHeaders},
    neon_before:stored||null,
    plex_live_extracted:{imdb:liveImdb,tmdb:liveTmdb,tvdb:liveTvdb,title:item.title??null,original_title:item.originalTitle??null,year:item.year??null,type:item.type??null,rating_key:item.ratingKey??null,key:item.key??null,guid:item.guid??null,updated_at:liveUpdatedAt,added_at:plexTs(item.addedAt),originally_available_at:item.originallyAvailableAt??null,raw_guids:rawGuids,raw_guid_objects:rawGuidObjects},
    plex_live_raw_item:item,
    plex_container_summary:{size:container.size??null,total_size:container.totalSize??null,allow_sync:container.allowSync??null,identifier:container.identifier??null,media_tag_prefix:container.mediaTagPrefix??null,media_tag_version:container.mediaTagVersion??null},
    normal_detector:{would_select:wouldSelectNormally,reasons,stored_updated_at:storedUpdatedAt,live_updated_at:liveUpdatedAt},
    identity_observation:stored?.imdb===liveImdb?'SAME_IMDB':stored?.imdb&&liveImdb?'IMDB_CHANGED':stored?.imdb&&!liveImdb?'IMDB_REMOVED':!stored?.imdb&&liveImdb?'IMDB_ADDED':'NO_IMDB'
  };
  console.log('[PLEX_DIAGNOSTIC_94028_FULL]',JSON.stringify(probe));
  await persistDiagnostic(sql,probe);
  return probe;
}

export async function syncPlexFast(){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado en Vercel');
  const baseUrl=process.env.PLEX_URL||process.env.PLEX_BASE_URL||'';
  const sql=db(),started=Date.now();
  let diagnostic94028=null;
  try{diagnostic94028=await diagnosticProbe(sql,token,baseUrl)}catch(e){diagnostic94028={mode:'READ_ONLY_FORCED_DIAGNOSTIC_EXHAUSTIVE',rating_key:DIAGNOSTIC_RATING_KEY,error:String(e?.message||e),error_name:e?.name||'Error',captured_at:new Date().toISOString(),read_only:true};console.error('[PLEX_DIAGNOSTIC_94028_FULL]',e);await persistDiagnostic(sql,diagnostic94028)}
  const beforeRows=await sql`SELECT x.rating_key,x.provider,x.external_id FROM plex_external_ids x JOIN plex_items p ON p.rating_key=x.rating_key WHERE p.active AND p.item_type IN('movie','show') AND x.provider IN('imdb','tmdb','tvdb')`;
  const before=mapIds(beforeRows);
  await sql`UPDATE plex_items p SET plex_updated_at=NULL WHERE p.active AND EXISTS (SELECT 1 FROM plex_sync_runs r WHERE r.library_section_id=p.library_section_id AND r.status='error' AND r.finished_at>COALESCE((SELECT max(ok.finished_at) FROM plex_sync_runs ok WHERE ok.library_section_id=r.library_section_id AND ok.status='success'),'-infinity'::timestamptz))`;
  await sql`UPDATE plex_items p SET plex_updated_at=NULL WHERE p.active AND p.item_type IN('movie','show') AND NOT EXISTS(SELECT 1 FROM plex_external_ids x WHERE x.rating_key=p.rating_key AND x.provider='imdb')`;
  const result=await syncPlexFastCore({sql,token,baseUrl});
  const afterRows=await sql`SELECT x.rating_key,x.provider,x.external_id FROM plex_external_ids x JOIN plex_items p ON p.rating_key=x.rating_key WHERE p.active AND p.item_type IN('movie','show') AND x.provider IN('imdb','tmdb','tvdb')`;
  const after=mapIds(afterRows),changed=[];
  for(const [ratingKey,newIds] of after){const oldIds=before.get(ratingKey),oldImdb=oldIds?.imdb||null,newImdb=newIds?.imdb||null;if(oldImdb&&newImdb&&oldImdb!==newImdb)changed.push({rating_key:ratingKey,before:oldIds,after:newIds})}
  const selected=changed[0]||null,deferred=changed.slice(1);
  for(const c of deferred){await sql`DELETE FROM plex_external_ids WHERE rating_key=${c.rating_key} AND provider='imdb'`;if(c.before?.imdb)await sql`INSERT INTO plex_external_ids(rating_key,provider,external_id) VALUES(${c.rating_key},'imdb',${c.before.imdb}) ON CONFLICT DO NOTHING`;await sql`UPDATE plex_items SET plex_updated_at=NULL WHERE rating_key=${c.rating_key}`}
  let identityChange=null;
  if(selected){
    const[item]=await sql`SELECT rating_key,plex_title,plex_year,item_type FROM plex_items WHERE rating_key=${selected.rating_key}`;
    const oldImdb=selected.before.imdb||null,newImdb=selected.after.imdb||null;
    const trace={mode:'imdb_identity_change_probe_1',rating_key:selected.rating_key,title:item?.plex_title||null,type:item?.item_type||null,year:item?.plex_year||null,imdb_before:oldImdb,imdb_after:newImdb,auxiliary_ids_before:{tmdb:selected.before?.tmdb||null,tvdb:selected.before?.tvdb||null},auxiliary_ids_after:{tmdb:selected.after?.tmdb||null,tvdb:selected.after?.tvdb||null},trigger:'IMDB_CHANGED',detected_at:new Date().toISOString(),deferred_imdb_changes:deferred.length,actions:[]};
    trace.actions.push({step:'imdb_identity_changed',ok:true});
    await sql`UPDATE plex_catalog_status SET status='missing',rating_key=NULL,updated_at=now() WHERE imdb_id=${oldImdb} AND rating_key=${selected.rating_key}`;
    trace.actions.push({step:'old_identity_unlinked',imdb_id:oldImdb,ok:true});
    const[existing]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${newImdb} LIMIT 1`;
    if(existing){await sql`INSERT INTO catalog_lifecycle(imdb_id,lifecycle_state,previous_state,blocking_reason,state_changed_at,computed_at) VALUES(${newImdb},'IDENTITY_PENDING',NULL,'Plex: IMDb corregido; reprocesado completo solicitado',now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET previous_state=catalog_lifecycle.lifecycle_state,lifecycle_state='IDENTITY_PENDING',blocking_reason='Plex: IMDb corregido; reprocesado completo solicitado',state_changed_at=now(),computed_at=now()`;trace.actions.push({step:'lifecycle_reset',imdb_id:newImdb,destination:'IDENTITY_PENDING',existing_catalog_title:true,ok:true})}else{trace.actions.push({step:'route_to_news',imdb_id:newImdb,destination:'NOVEDADES',existing_catalog_title:false,ok:true})}
    identityChange=trace;const log=`IMDB_IDENTITY_CHANGE_PROBE ${JSON.stringify(trace)}`;await sql`UPDATE plex_sync_runs SET notes=LEFT(COALESCE(notes,'')||E'\n'||${log},12000) WHERE id=(SELECT r.id FROM plex_sync_runs r JOIN plex_items p ON p.library_section_id=r.library_section_id WHERE p.rating_key=${selected.rating_key} ORDER BY r.id DESC LIMIT 1)`;
  }
  const probe={limit:1,trigger:'IMDB_ONLY',detected:changed.length,processed:identityChange?1:0,deferred:deferred.length,change:identityChange,elapsed_ms:Date.now()-started};
  if(!identityChange){const log=`IMDB_IDENTITY_CHANGE_PROBE ${JSON.stringify(probe)}`;await sql`UPDATE plex_sync_runs SET notes=LEFT(COALESCE(notes,'')||E'\n'||${log},12000) WHERE id=(SELECT max(id) FROM plex_sync_runs)`}
  return{...result,identityChangeProbe:probe,diagnostic94028};
}
