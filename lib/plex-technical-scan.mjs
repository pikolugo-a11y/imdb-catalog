import {discoverPlexUrlCore} from './plex-sync-core.mjs';
import {buildProbeFingerprint} from './plex-technical-core.mjs';

const CLIENT='pikofilm-technical-scan';
const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'2'});
const list=body=>body?.MediaContainer?.Metadata||body?.MediaContainer?.Video||body?.MediaContainer?.Directory||[];

async function pget(base,token,path){
  const r=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw new Error(`Plex ${path} respondió ${r.status}`);
  return r.json();
}

async function listSections(base,token){
  const body=await pget(base,token,'/library/sections');
  return list(body).filter(x=>x.type==='movie'||x.type==='show').map(x=>({key:String(x.key),type:x.type,title:x.title||null}));
}

async function listMovieItems(base,token,sectionKey){
  const body=await pget(base,token,`/library/sections/${encodeURIComponent(sectionKey)}/all?includeMedia=1&X-Plex-Container-Start=0&X-Plex-Container-Size=20000`);
  return list(body).filter(x=>x.type==='movie');
}

async function listEpisodeItems(base,token,sectionKey){
  const body=await pget(base,token,`/library/sections/${encodeURIComponent(sectionKey)}/all?type=4&includeMedia=1&X-Plex-Container-Start=0&X-Plex-Container-Size=100000`);
  return list(body).filter(x=>x.type==='episode');
}

async function upsertProbe(sql,item){
  const ratingKey=String(item?.ratingKey||'').trim();
  if(!ratingKey)return{seen:false,changed:false};
  const probeFingerprint=buildProbeFingerprint(item);
  const [current]=await sql`SELECT probe_fingerprint,technical_fingerprint,snapshot_status FROM plex_technical_state WHERE rating_key=${ratingKey}`;
  if(!current){
    await sql`INSERT INTO plex_technical_state(rating_key,probe_fingerprint,technical_fingerprint,snapshot_status,snapshot_version,needs_refresh,captured_at,source_updated_at,last_probe_at,last_error,updated_at)
      VALUES(${ratingKey},${probeFingerprint},NULL,'pending','1',true,NULL,NULL,now(),NULL,now())`;
    return{seen:true,changed:true,new:true};
  }
  const changed=current.probe_fingerprint!==probeFingerprint;
  if(changed){
    await sql`UPDATE plex_technical_state SET probe_fingerprint=${probeFingerprint},snapshot_status=CASE WHEN technical_fingerprint IS NULL THEN 'pending' ELSE 'stale' END,needs_refresh=true,last_probe_at=now(),last_error=NULL,updated_at=now() WHERE rating_key=${ratingKey}`;
    await sql`UPDATE piko_quality SET status='stale',updated_at=now() WHERE rating_key=${ratingKey} AND status='evaluated'`;
  }else{
    await sql`UPDATE plex_technical_state SET last_probe_at=now(),updated_at=now() WHERE rating_key=${ratingKey}`;
  }
  return{seen:true,changed,new:false};
}

export async function scanPlexTechnicalLibrary({sql,token,baseUrl=''}){
  if(!token)throw new Error('PLEX_TOKEN no está configurado');
  const base=await discoverPlexUrlCore(token,baseUrl);
  const sections=await listSections(base,token);
  let movies=0,episodes=0,changed=0,created=0;
  for(const section of sections){
    const items=section.type==='movie'?await listMovieItems(base,token,section.key):await listEpisodeItems(base,token,section.key);
    for(const item of items){
      const r=await upsertProbe(sql,item);
      if(section.type==='movie')movies++;else episodes++;
      if(r.changed)changed++;
      if(r.new)created++;
    }
  }
  return{sections:sections.length,movies,episodes,changed,created};
}
