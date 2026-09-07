import 'server-only';
import {db} from './db';
import {resolveManualNewsCandidate} from './news-manual-resolver';

export const NEWS_ORIGINS=['manual','plex','discovery','saga','person'];
const validOrigin=v=>NEWS_ORIGINS.includes(String(v))?String(v):'discovery';
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const minimumReady=x=>Boolean(/^tt\d+$/.test(String(x.imdb_id||''))&&String(x.title||'').trim()&&String(x.title)!==String(x.imdb_id)&&x.candidate_type);

function evidenceOf({origin,context={},title,year}){return{origin,context,detectedAt:new Date().toISOString(),title:title||null,year:year||null}}

export async function intakeNewsCandidate(input,{sql=db()}={}){
  const imdbId=String(input.imdbId||'').trim();if(!/^tt\d+$/.test(imdbId))throw new Error('IMDb ID inválido');
  const origin=validOrigin(input.origin),title=String(input.title||'').trim().slice(0,300)||null,year=Number(input.year)||null,candidateType=input.candidateType||null,context=input.context||{};
  const[existingMovie]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;if(existingMovie)return{status:'catalogued',imdbId};
  const[excluded]=await sql`SELECT imdb_id FROM catalog_exclusions WHERE imdb_id=${imdbId} LIMIT 1`;if(excluded)return{status:'excluded',imdbId};
  const[current]=await sql`SELECT * FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
  const previous=current?.source_snapshot||{},origins=uniq([...(Array.isArray(previous.origins)?previous.origins:previous.origin?[previous.origin]:[]),origin]);
  const evidence=uniq([...(Array.isArray(previous.intakeEvidence)?previous.intakeEvidence:[]),evidenceOf({origin,context,title,year})]);
  const mergedTitle=title||previous.title||previous.originalTitle||imdbId,mergedType=candidateType||current?.candidate_type||null;
  const ready=minimumReady({imdb_id:imdbId,title:mergedTitle,candidate_type:mergedType});
  const snap={...previous,origin:origins[0]||origin,origins,intakeEvidence:evidence,title:mergedTitle,originalTitle:previous.originalTitle||mergedTitle,discoveryVersion:'novedades-v4',minimums:{imdb:true,title:Boolean(mergedTitle&&mergedTitle!==imdbId),type:Boolean(mergedType)}};
  await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at) VALUES(${imdbId},${mergedType},${year},${ready?'eligible':'processing'},now(),now(),${ready?new Date():null},now(),${JSON.stringify(snap)}::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=COALESCE(catalog_candidates.candidate_type,EXCLUDED.candidate_type),year=COALESCE(catalog_candidates.year,EXCLUDED.year),eligibility_status=CASE WHEN catalog_candidates.eligibility_status='catalogued' THEN 'catalogued' WHEN ${ready} THEN 'eligible' ELSE catalog_candidates.eligibility_status END,became_eligible_at=CASE WHEN ${ready} THEN COALESCE(catalog_candidates.became_eligible_at,now()) ELSE catalog_candidates.became_eligible_at END,last_seen_at=now(),last_evaluated_at=now(),source_snapshot=${JSON.stringify(snap)}::jsonb,updated_at=now()`;
  return{status:ready?'ready':'attention',imdbId,origins,ready};
}

export async function prepareNewsCandidate(imdbId,{trace=null,sql=db()}={}){
  const[c]=await sql`SELECT * FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;if(!c)return{status:'missing',ready:false};
  const resolved=await resolveManualNewsCandidate(imdbId,{trace});
  const old=c.source_snapshot||{},title=resolved.source_snapshot?.title||old.title||old.originalTitle||imdbId,type=resolved.candidate_type||c.candidate_type||null,ready=minimumReady({imdb_id:imdbId,title,candidate_type:type});
  const snap={...old,...resolved.source_snapshot,origin:old.origin||'discovery',origins:Array.isArray(old.origins)?old.origins:[old.origin||'discovery'],intakeEvidence:Array.isArray(old.intakeEvidence)?old.intakeEvidence:[],title,originalTitle:old.originalTitle||title,preparationStatus:ready?'complete':'attention',preparationAttemptedAt:new Date().toISOString(),preparationError:ready?null:(resolved.source_snapshot?.omdbError||'No se pudieron resolver título y tipo'),discoveryVersion:'novedades-v4'};
  await sql`UPDATE catalog_candidates SET candidate_type=COALESCE(${type},candidate_type),year=COALESCE(${resolved.year||null},year),imdb_rating=COALESCE(imdb_rating,${resolved.imdb_rating??null}),imdb_votes=COALESCE(imdb_votes,${resolved.imdb_votes??null}),eligibility_status=${ready?'eligible':'processing'},became_eligible_at=CASE WHEN ${ready} THEN COALESCE(became_eligible_at,now()) ELSE became_eligible_at END,last_evaluated_at=now(),source_snapshot=${JSON.stringify(snap)}::jsonb,updated_at=now() WHERE imdb_id=${imdbId}`;
  return{status:ready?'ready':'attention',ready,title,type,error:snap.preparationError};
}
