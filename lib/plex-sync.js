import 'server-only';
import {db} from './db';
import {syncPlexFastCore} from './plex-sync-core.mjs';

const providers=['imdb','tmdb','tvdb'];
const mapIds=rows=>{const out=new Map();for(const r of rows){const k=String(r.rating_key);if(!out.has(k))out.set(k,{});out.get(k)[r.provider]=r.external_id}return out};
const same=(a,b)=>providers.every(p=>String(a?.[p]||'')===String(b?.[p]||''));

export async function syncPlexFast(){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado en Vercel');
  const baseUrl=process.env.PLEX_URL||process.env.PLEX_BASE_URL||'';
  const sql=db(),started=Date.now();
  const beforeRows=await sql`SELECT x.rating_key,x.provider,x.external_id FROM plex_external_ids x JOIN plex_items p ON p.rating_key=x.rating_key WHERE p.active AND p.item_type IN('movie','show') AND x.provider IN('imdb','tmdb','tvdb')`;
  const before=mapIds(beforeRows);
  await sql`UPDATE plex_items p SET plex_updated_at=NULL WHERE p.active AND EXISTS (SELECT 1 FROM plex_sync_runs r WHERE r.library_section_id=p.library_section_id AND r.status='error' AND r.finished_at>COALESCE((SELECT max(ok.finished_at) FROM plex_sync_runs ok WHERE ok.library_section_id=r.library_section_id AND ok.status='success'),'-infinity'::timestamptz))`;
  await sql`UPDATE plex_items p SET plex_updated_at=NULL WHERE p.active AND p.item_type IN('movie','show') AND NOT EXISTS(SELECT 1 FROM plex_external_ids x WHERE x.rating_key=p.rating_key AND x.provider='imdb')`;
  const result=await syncPlexFastCore({sql,token,baseUrl});
  const afterRows=await sql`SELECT x.rating_key,x.provider,x.external_id FROM plex_external_ids x JOIN plex_items p ON p.rating_key=x.rating_key WHERE p.active AND p.item_type IN('movie','show') AND x.provider IN('imdb','tmdb','tvdb')`;
  const after=mapIds(afterRows),changed=[];
  for(const [ratingKey,newIds] of after){const oldIds=before.get(ratingKey);if(oldIds&&oldIds.imdb&&newIds.imdb&&!same(oldIds,newIds))changed.push({rating_key:ratingKey,before:oldIds,after:newIds})}

  // Primera validación controlada: máximo UNA identidad corregida por ejecución.
  const selected=changed[0]||null,deferred=changed.slice(1);
  for(const c of deferred){await sql`DELETE FROM plex_external_ids WHERE rating_key=${c.rating_key} AND provider=ANY(${providers})`;for(const p of providers){if(c.before?.[p])await sql`INSERT INTO plex_external_ids(rating_key,provider,external_id) VALUES(${c.rating_key},${p},${c.before[p]}) ON CONFLICT DO NOTHING`}}

  let identityChange=null;
  if(selected){
    const[item]=await sql`SELECT rating_key,plex_title,plex_year,item_type FROM plex_items WHERE rating_key=${selected.rating_key}`;
    const oldImdb=selected.before.imdb||null,newImdb=selected.after.imdb||null;
    const trace={mode:'identity_change_probe_1',rating_key:selected.rating_key,title:item?.plex_title||null,type:item?.item_type||null,year:item?.plex_year||null,before:selected.before,after:selected.after,detected_at:new Date().toISOString(),deferred_identity_changes:deferred.length,actions:[]};
    trace.actions.push({step:'plex_identity_changed',ok:true});
    if(oldImdb&&oldImdb!==newImdb){await sql`UPDATE plex_catalog_status SET status='missing',rating_key=NULL,updated_at=now() WHERE imdb_id=${oldImdb} AND rating_key=${selected.rating_key}`;trace.actions.push({step:'old_identity_unlinked',imdb_id:oldImdb,ok:true})}
    if(newImdb){
      const[existing]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${newImdb} LIMIT 1`;
      if(existing){await sql`INSERT INTO catalog_lifecycle(imdb_id,lifecycle_state,previous_state,blocking_reason,state_changed_at,computed_at) VALUES(${newImdb},'IDENTITY_PENDING',NULL,'Plex: identidad corregida; reprocesado completo solicitado',now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET previous_state=catalog_lifecycle.lifecycle_state,lifecycle_state='IDENTITY_PENDING',blocking_reason='Plex: identidad corregida; reprocesado completo solicitado',state_changed_at=now(),computed_at=now()`;trace.actions.push({step:'lifecycle_reset',imdb_id:newImdb,destination:'IDENTITY_PENDING',existing_catalog_title:true,ok:true})}
      else trace.actions.push({step:'route_to_news',imdb_id:newImdb,destination:'NOVEDADES',existing_catalog_title:false,ok:true});
    }
    identityChange=trace;
    // Log persistente y legible: queda asociado a la ejecución incremental más reciente
    // de la biblioteca afectada, además de devolverse al caller.
    const log=`IDENTITY_CHANGE_PROBE ${JSON.stringify(trace)}`;
    await sql`UPDATE plex_sync_runs SET notes=LEFT(COALESCE(notes,'')||E'\n'||${log},12000) WHERE id=(SELECT r.id FROM plex_sync_runs r JOIN plex_items p ON p.library_section_id=r.library_section_id WHERE p.rating_key=${selected.rating_key} ORDER BY r.id DESC LIMIT 1)`;
  }
  const probe={limit:1,detected:changed.length,processed:identityChange?1:0,deferred:deferred.length,change:identityChange,elapsed_ms:Date.now()-started};
  if(!identityChange){const log=`IDENTITY_CHANGE_PROBE ${JSON.stringify(probe)}`;await sql`UPDATE plex_sync_runs SET notes=LEFT(COALESCE(notes,'')||E'\n'||${log},12000) WHERE id=(SELECT max(id) FROM plex_sync_runs)`}
  return{...result,identityChangeProbe:probe};
}
