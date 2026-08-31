import 'server-only';
import crypto from 'node:crypto';
import {db} from './db';
import {audit} from './runlog';
import {discoverPlexUrlCore} from './plex-sync-core.mjs';
import {rebuildSeriesDiagnostics} from './series-diagnostics-core.mjs';
import {recomputeLifecycleForIds} from './lifecycle';
import {executeObservedProcess} from './process-runtime';

const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':'pikofilm-series-sync','X-Plex-Product':'PikoFilm','X-Plex-Version':'3'});
const list=b=>b?.MediaContainer?.Metadata||b?.MediaContainer?.Directory||b?.MediaContainer?.Video||[];
async function get(base,token,path,trace=null){trace?.externalCall?.(1);const r=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(45000)});if(!r.ok){const e=new Error(`Plex ${path} respondió ${r.status}`);e.source='plex';e.retryable=r.status===429||r.status>=500;throw e}return r.json()}
const fingerprint=s=>crypto.createHash('sha256').update([s.ratingKey,s.type,s.title,s.year,s.updatedAt].join('|')).digest('hex');

export async function syncPlexSeriesFastCore({trace=null}={}){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado');
  const sql=db(),started=Date.now();
  await trace?.event?.({eventType:'step_started',step:'discover_plex',message:'Localizando servidor Plex'});
  trace?.externalCall?.(1);const base=await discoverPlexUrlCore(token,process.env.PLEX_URL||process.env.PLEX_BASE_URL||'');
  const sections=list(await get(base,token,'/library/sections',trace)).filter(s=>s.type==='show');
  await trace?.event?.({eventType:'step_completed',step:'discover_plex',message:`${sections.length} bibliotecas de series encontradas`,data:{libraries:sections.length}});
  let examined=0,changed=0,created=0,missing=0;const successful=[];const failed=[];
  for(const section of sections){
    const sectionKey=String(section.key),sectionTitle=section.title||null;await trace?.event?.({eventType:'step_started',step:'sync_library',entityType:'series_library',entityId:sectionKey,message:`Sincronizando biblioteca ${sectionTitle||sectionKey}`});
    try{
      const shows=list(await get(base,token,`/library/sections/${section.key}/all?includeGuids=0&X-Plex-Container-Start=0&X-Plex-Container-Size=20000`,trace)).filter(x=>x.type==='show');examined+=shows.length;
      const keys=shows.map(x=>String(x.ratingKey)),existing=keys.length?await sql`SELECT rating_key,fingerprint FROM plex_items WHERE rating_key=ANY(${keys})`:[],old=new Map(existing.map(x=>[String(x.rating_key),x]));
      const rows=shows.map(s=>({rating_key:String(s.ratingKey),library_section_id:Number(section.key),plex_title:s.title||null,plex_year:Number(s.year)||null,plex_updated_at:s.updatedAt?new Date(Number(s.updatedAt)*1000).toISOString():null,fingerprint:fingerprint(s),changed:!old.has(String(s.ratingKey))||old.get(String(s.ratingKey)).fingerprint!==fingerprint(s)}));
      const newRows=rows.filter(x=>!old.has(x.rating_key)),changedRows=rows.filter(x=>old.has(x.rating_key)&&x.changed);created+=newRows.length;changed+=changedRows.length;
      if(rows.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS t(rating_key text,library_section_id int,plex_title text,plex_year int,plex_updated_at timestamptz,fingerprint text,changed bool)) INSERT INTO plex_items(rating_key,library_section_id,plex_title,plex_year,plex_updated_at,fingerprint,item_type,active,first_seen_at,last_seen_at,synced_at) SELECT rating_key,library_section_id,plex_title,plex_year,plex_updated_at,fingerprint,'show',true,now(),now(),now() FROM x ON CONFLICT(rating_key) DO UPDATE SET library_section_id=EXCLUDED.library_section_id,plex_title=EXCLUDED.plex_title,plex_year=EXCLUDED.plex_year,plex_updated_at=EXCLUDED.plex_updated_at,fingerprint=EXCLUDED.fingerprint,active=true,missing_since=NULL,last_seen_at=now(),synced_at=now()`;
      if(changedRows.length)await sql`UPDATE series_reference SET plex_invalidated_at=now(),plex_invalid_reason='show_fingerprint_changed' WHERE show_rating_key=ANY(${changedRows.map(x=>x.rating_key)})`;
      successful.push({section:Number(section.key),keys});await trace?.event?.({eventType:'step_completed',step:'sync_library',entityType:'series_library',entityId:sectionKey,message:`Biblioteca sincronizada: ${shows.length} series`,data:{examined:shows.length,created:newRows.length,changed:changedRows.length}});
    }catch(e){failed.push({section:sectionKey,title:sectionTitle,error:e?.message||String(e)});await audit('quality','series',sectionKey,'plex_series_fast_section_failed',{error:e?.message||String(e)});await trace?.event?.({eventType:'error',step:'sync_library',entityType:'series_library',entityId:sectionKey,message:e?.message||'Error sincronizando biblioteca',data:{source:e?.source||'plex',retryable:Boolean(e?.retryable)}});}
  }
  for(const s of successful){const gone=await sql`UPDATE plex_items SET active=false,missing_since=COALESCE(missing_since,now()),synced_at=now() WHERE library_section_id=${s.section} AND item_type='show' AND active AND NOT(rating_key=ANY(${s.keys.length?s.keys:['__none__']})) RETURNING rating_key`;missing+=gone.length;}
  const result={examined,changed,created,missing,libraries:sections.length,librariesSucceeded:successful.length,librariesFailed:failed.length,durationMs:Date.now()-started,partial:failed.length>0,failedLibraries:failed.slice(0,20)};
  await audit('quality','series','global','plex_series_fast_completed',result);return result;
}

export async function syncPlexSeriesFast(){
  const bucket=Math.floor(Date.now()/5000),requestKey=`PROC-SER-001:manual:${bucket}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-001',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId:'global',correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/series',operation:'sync_plex_series_fast'}},async trace=>{
    const result=await syncPlexSeriesFastCore({trace});
    return{technicalStatus:result.partial?'partial':'succeeded',functionalResult:result.changed||result.created||result.missing?'updated':'no_change',metrics:{examined:result.examined,changed:result.changed,created:result.created,missing:result.missing,libraries:result.libraries,libraries_succeeded:result.librariesSucceeded,libraries_failed:result.librariesFailed},after:{partial:result.partial,failed_libraries:result.failedLibraries},message:result.partial?'Sincronización Plex de Series completada parcialmente':'Sincronización Plex de Series completada',...result};
  });
  if(observed.reused)return{examined:0,changed:0,created:0,missing:0,libraries:0,librariesSucceeded:0,librariesFailed:0,durationMs:0,partial:false,reused:true,runId:observed.runId};
  return{...observed.result,reused:false,runId:observed.runId};
}

export async function syncPlexSeriesDetail(ratingKey){
  const key=String(ratingKey||'').trim();if(!key)throw new Error('Serie Plex inválida');const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado');const sql=db(),base=await discoverPlexUrlCore(token,process.env.PLEX_URL||process.env.PLEX_BASE_URL||''),started=Date.now();
  const [show]=await sql`SELECT p.rating_key,p.library_section_id,p.plex_title,x.external_id imdb_id FROM plex_items p LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' WHERE p.rating_key=${key} AND p.active AND p.item_type='show' LIMIT 1`;if(!show)throw new Error('Serie no encontrada en Plex local');
  await audit('quality','series',show.imdb_id||key,'plex_detail_started',{rating_key:key});
  try{const seasons=list(await get(base,token,`/library/metadata/${key}/children`)).filter(x=>x.type==='season'&&Number(x.index)>0);const episodes=[];for(const season of seasons){const arr=list(await get(base,token,`/library/metadata/${season.ratingKey}/children`)).filter(x=>x.type==='episode');for(const e of arr){const librarySectionId=Number(e.librarySectionID)||Number(season.librarySectionID)||Number(show.library_section_id);if(!librarySectionId)throw new Error(`Plex no devolvió library_section_id para el episodio ${e.ratingKey||'desconocido'}`);episodes.push({rating_key:String(e.ratingKey),library_section_id:librarySectionId,plex_title:e.title||null,plex_year:Number(e.year)||null,plex_updated_at:e.updatedAt?new Date(Number(e.updatedAt)*1000).toISOString():null,parent_rating_key:String(season.ratingKey),grandparent_rating_key:key,parent_index:Number(e.parentIndex??season.index)||0,item_index:Number(e.index)||0});}}
    const existing=await sql`SELECT rating_key FROM plex_items WHERE grandparent_rating_key=${key} AND item_type='episode'`;const old=new Set(existing.map(x=>String(x.rating_key)));if(episodes.length)await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(episodes)}::jsonb) AS t(rating_key text,library_section_id int,plex_title text,plex_year int,plex_updated_at timestamptz,parent_rating_key text,grandparent_rating_key text,parent_index int,item_index int)) INSERT INTO plex_items(rating_key,library_section_id,plex_title,plex_year,plex_updated_at,parent_rating_key,grandparent_rating_key,parent_index,item_index,item_type,active,first_seen_at,last_seen_at,synced_at) SELECT rating_key,library_section_id,plex_title,plex_year,plex_updated_at,parent_rating_key,grandparent_rating_key,parent_index,item_index,'episode',true,now(),now(),now() FROM x ON CONFLICT(rating_key) DO UPDATE SET library_section_id=EXCLUDED.library_section_id,plex_title=EXCLUDED.plex_title,plex_updated_at=EXCLUDED.plex_updated_at,parent_rating_key=EXCLUDED.parent_rating_key,grandparent_rating_key=EXCLUDED.grandparent_rating_key,parent_index=EXCLUDED.parent_index,item_index=EXCLUDED.item_index,active=true,missing_since=NULL,last_seen_at=now(),synced_at=now()`;const seen=episodes.map(x=>x.rating_key);await sql`UPDATE plex_items SET active=false,missing_since=COALESCE(missing_since,now()),synced_at=now() WHERE grandparent_rating_key=${key} AND item_type='episode' AND active AND NOT(rating_key=ANY(${seen.length?seen:['__none__']}))`;await sql`UPDATE series_reference SET plex_detail_refreshed_at=now(),plex_invalidated_at=NULL,plex_invalid_reason=NULL WHERE show_rating_key=${key}`;const diagnostics=await rebuildSeriesDiagnostics(sql,key);const lifecycle=show.imdb_id?(await recomputeLifecycleForIds([show.imdb_id])).get(show.imdb_id):null;const result={ratingKey:key,episodes:episodes.length,seasons:seasons.length,added:episodes.filter(x=>!old.has(x.rating_key)).length,removed:[...old].filter(x=>!seen.includes(x)).length,durationMs:Date.now()-started,diagnostics,lifecycle};await audit('quality','series',show.imdb_id||key,'plex_detail_completed',result);return result;}catch(e){await audit('quality','series',show.imdb_id||key,'plex_detail_failed',{rating_key:key,error:e?.message||String(e),durationMs:Date.now()-started});throw e;}
}
