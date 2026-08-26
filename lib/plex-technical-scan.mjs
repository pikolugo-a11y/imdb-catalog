import {discoverPlexUrlCore} from './plex-sync-core.mjs';
import {buildProbeFingerprint} from './plex-technical-core.mjs';

const CLIENT='pikofilm-technical-scan';
const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'2'});
const list=body=>body?.MediaContainer?.Metadata||body?.MediaContainer?.Video||body?.MediaContainer?.Directory||[];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const ts=v=>v?new Date(Number(v)*1000).toISOString():null;

async function pget(base,token,path){
  const r=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw new Error(`Plex ${path} respondió ${r.status}`);
  return r.json();
}

async function listSections(base,token){
  const body=await pget(base,token,'/library/sections');
  return list(body).filter(x=>x.type==='movie'||x.type==='show').map(x=>({key:String(x.key),type:x.type,title:x.title||null}));
}

function probeRow(item,section){
  return{
    rating_key:String(item.ratingKey),
    library_section_id:Number(section.key),
    item_type:item.type==='episode'?'episode':'movie',
    plex_key:item.key||null,
    plex_title:item.title||null,
    plex_year:num(item.year),
    parent_rating_key:item.parentRatingKey?String(item.parentRatingKey):null,
    grandparent_rating_key:item.grandparentRatingKey?String(item.grandparentRatingKey):null,
    parent_index:num(item.parentIndex),
    item_index:num(item.index),
    added_at:ts(item.addedAt),
    probe_fingerprint:buildProbeFingerprint(item),
  };
}

async function ensurePhysicalItems(sql,rows){
  if(!rows.length)return 0;
  const payload=JSON.stringify(rows);
  const inserted=await sql`
    WITH x AS (
      SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS t(
        rating_key text,library_section_id int,item_type text,plex_key text,plex_title text,plex_year int,
        parent_rating_key text,grandparent_rating_key text,parent_index int,item_index int,added_at timestamptz,probe_fingerprint text
      )
    )
    INSERT INTO plex_items(
      rating_key,library_section_id,plex_key,plex_title,plex_year,added_at,item_type,
      parent_rating_key,grandparent_rating_key,parent_index,item_index,active,first_seen_at,last_seen_at,synced_at
    )
    SELECT rating_key,library_section_id,plex_key,plex_title,plex_year,added_at,item_type,
      parent_rating_key,grandparent_rating_key,parent_index,item_index,true,now(),now(),now()
    FROM x
    ON CONFLICT(rating_key) DO NOTHING
    RETURNING rating_key
  `;
  return inserted.length;
}

async function upsertProbeChunk(sql,rows){
  if(!rows.length)return{created:0,changed:0};
  await ensurePhysicalItems(sql,rows);
  const payload=JSON.stringify(rows);
  const existing=await sql`
    WITH x AS (SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS t(rating_key text,probe_fingerprint text))
    SELECT s.rating_key,s.probe_fingerprint,s.technical_fingerprint
    FROM plex_technical_state s JOIN x USING(rating_key)
  `;
  const old=new Map(existing.map(r=>[String(r.rating_key),r]));
  const createdKeys=[],changedKeys=[];
  for(const r of rows){
    const prev=old.get(r.rating_key);
    if(!prev)createdKeys.push(r.rating_key);
    else if(prev.probe_fingerprint!==r.probe_fingerprint)changedKeys.push(r.rating_key);
  }
  await sql`
    WITH x AS (
      SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS t(rating_key text,probe_fingerprint text)
    )
    INSERT INTO plex_technical_state(
      rating_key,probe_fingerprint,technical_fingerprint,snapshot_status,snapshot_version,
      needs_refresh,captured_at,source_updated_at,last_probe_at,last_error,updated_at
    )
    SELECT rating_key,probe_fingerprint,NULL,'pending','1',true,NULL,NULL,now(),NULL,now() FROM x
    ON CONFLICT(rating_key) DO UPDATE SET
      probe_fingerprint=EXCLUDED.probe_fingerprint,
      snapshot_status=CASE
        WHEN plex_technical_state.probe_fingerprint IS DISTINCT FROM EXCLUDED.probe_fingerprint
          THEN CASE WHEN plex_technical_state.technical_fingerprint IS NULL THEN 'pending' ELSE 'stale' END
        ELSE plex_technical_state.snapshot_status
      END,
      needs_refresh=CASE
        WHEN plex_technical_state.probe_fingerprint IS DISTINCT FROM EXCLUDED.probe_fingerprint THEN true
        ELSE plex_technical_state.needs_refresh
      END,
      last_probe_at=now(),
      last_error=CASE
        WHEN plex_technical_state.probe_fingerprint IS DISTINCT FROM EXCLUDED.probe_fingerprint THEN NULL
        ELSE plex_technical_state.last_error
      END,
      updated_at=now()
  `;
  if(changedKeys.length){
    await sql`UPDATE piko_quality SET status='stale',updated_at=now() WHERE rating_key=ANY(${changedKeys}) AND status='evaluated'`;
  }
  return{created:createdKeys.length,changed:changedKeys.length};
}

async function scanSectionPaged({sql,base,token,section,pageSize=2000}){
  let start=0,total=0,created=0,changed=0,pages=0;
  const typeParam=section.type==='show'?'&type=4':'';
  for(;;){
    const path=`/library/sections/${encodeURIComponent(section.key)}/all?includeMedia=1${typeParam}&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`;
    const body=await pget(base,token,path);
    const container=body?.MediaContainer||{};
    const expected=Number(container.totalSize||container.size||0);
    const items=list(body).filter(x=>section.type==='movie'?x.type==='movie':x.type==='episode');
    const rows=items.map(item=>probeRow(item,section));
    const result=await upsertProbeChunk(sql,rows);
    total+=rows.length;created+=result.created;changed+=result.changed;pages++;
    start+=items.length;
    if(items.length===0||items.length<pageSize||(expected>0&&start>=expected))break;
  }
  return{total,created,changed,pages};
}

export async function scanPlexTechnicalLibrary({sql,token,baseUrl='',pageSize=2000}){
  if(!token)throw new Error('PLEX_TOKEN no está configurado');
  const base=await discoverPlexUrlCore(token,baseUrl);
  const sections=await listSections(base,token);
  let movies=0,episodes=0,changed=0,created=0,pages=0;
  for(const section of sections){
    const result=await scanSectionPaged({sql,base,token,section,pageSize});
    if(section.type==='movie')movies+=result.total;else episodes+=result.total;
    created+=result.created;changed+=result.changed;pages+=result.pages;
  }
  return{sections:sections.length,movies,episodes,changed,created,pages};
}
