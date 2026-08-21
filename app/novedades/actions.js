'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {enrichTitle} from '@/lib/enrich-title';
import {DEFAULT_NEWS_SETTINGS,getNewsSettings} from '@/lib/news-v1';
import {resolveManualNewsCandidate} from '@/lib/news-manual-resolver';
import {audit,startRun,finishRun,errorInfo} from '@/lib/runlog';

const WEEK_MS=7*24*60*60*1000;
const DISPATCH_URL='https://api.github.com/repos/pikolugo-a11y/imdb-catalog/actions/workflows/imdb-discovery.yml/dispatches';
const MANUAL_DISPATCH_URL='https://api.github.com/repos/pikolugo-a11y/imdb-catalog/actions/workflows/imdb-manual-candidate.yml/dispatches';
function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function num(formData,key,fallback,min=0,max=1e9){const n=Number(formData.get(key));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function refreshNews(){revalidatePath('/novedades');revalidatePath('/novedades/criterios');revalidatePath('/catalogo');revalidatePath('/catalogo/excluidas');revalidatePath('/calidad');revalidatePath('/calidad/identidad');revalidatePath('/calidad/validacion-identidad');revalidatePath('/calidad/datos');revalidatePath('/plex');revalidatePath('/admin');revalidatePath('/')}
async function dispatchManualAuthoritative(imdbId,{retry=false}={}){
  const sql=db();
  const [row]=await sql`SELECT source_snapshot FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
  const prior=row?.source_snapshot||{},attempt=Number(prior.authoritativeAttempts||0)+1,requestedAt=new Date().toISOString();
  await sql`UPDATE catalog_candidates SET source_snapshot=(COALESCE(source_snapshot,'{}'::jsonb)-'manualAuthoritativeError'-'manualAuthoritativeFailedAt')||${JSON.stringify({authoritativeStatus:'pending',authoritativeRequestedAt:requestedAt,authoritativeAttempts:attempt})}::jsonb,updated_at=now() WHERE imdb_id=${imdbId}`;
  await audit('news','candidate',imdbId,retry?'manual_authoritative_retry_requested':'manual_authoritative_requested',{attempt,requestedAt});
  const token=process.env.GITHUB_ACTIONS_TOKEN;
  if(!token){const error='Falta GITHUB_ACTIONS_TOKEN';await sql`UPDATE catalog_candidates SET source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({authoritativeStatus:'failed',manualAuthoritativeFailedAt:new Date().toISOString(),manualAuthoritativeError:error})}::jsonb,updated_at=now() WHERE imdb_id=${imdbId}`;await audit('news','candidate',imdbId,'manual_authoritative_dispatch_missing_token',{attempt,error});return false}
  try{
    const r=await fetch(MANUAL_DISPATCH_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PikoFilm/3.0'},body:JSON.stringify({ref:'main',inputs:{imdb_id:imdbId}}),cache:'no-store'});
    if(!r.ok)throw new Error(`GitHub workflow dispatch HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
    await audit('news','candidate',imdbId,retry?'manual_authoritative_retry_dispatched':'manual_authoritative_dispatched',{attempt});return true
  }catch(e){const error=e?.message||String(e);await sql`UPDATE catalog_candidates SET source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({authoritativeStatus:'failed',manualAuthoritativeFailedAt:new Date().toISOString(),manualAuthoritativeError:error})}::jsonb,updated_at=now() WHERE imdb_id=${imdbId}`;await audit('news','candidate',imdbId,'manual_authoritative_dispatch_failed',{attempt,error});return false}
}

async function upsertResolvedManual(sql,imdbId,extraSnapshot={}){
  const resolved=await resolveManualNewsCandidate(imdbId);
  const snap={...resolved.source_snapshot,...extraSnapshot,manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1'};
  await sql`
    INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
    VALUES(${imdbId},${resolved.candidate_type},${resolved.year},${resolved.imdb_rating},${resolved.imdb_votes},'eligible',now(),now(),now(),now(),${JSON.stringify(snap)}::jsonb,now(),now())
    ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=COALESCE(EXCLUDED.candidate_type,catalog_candidates.candidate_type),year=COALESCE(EXCLUDED.year,catalog_candidates.year),imdb_rating=COALESCE(EXCLUDED.imdb_rating,catalog_candidates.imdb_rating),imdb_votes=COALESCE(EXCLUDED.imdb_votes,catalog_candidates.imdb_votes),eligibility_status='eligible',last_seen_at=now(),became_eligible_at=COALESCE(catalog_candidates.became_eligible_at,now()),last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,updated_at=now()`;
  return resolved;
}

export async function requestNewsDiscoveryAction(){
  const sql=db(),token=process.env.GITHUB_ACTIONS_TOKEN;
  if(!token)redirect('/novedades?notice=dispatch_not_configured');
  const [lastSuccess]=await sql`SELECT finished_at,started_at FROM pipeline_runs WHERE job_type='imdb_discovery' AND status='success' ORDER BY COALESCE(finished_at,started_at) DESC LIMIT 1`;
  const lastAt=lastSuccess?.finished_at||lastSuccess?.started_at||null,nextAllowedAt=lastAt?new Date(new Date(lastAt).getTime()+WEEK_MS):null,cooldownActive=Boolean(nextAllowedAt&&nextAllowedAt>new Date());
  let forceOnce=false,overrideConsumed=false;
  if(cooldownActive){
    const [override]=await sql`UPDATE app_settings SET value=jsonb_set(COALESCE(value,'{}'::jsonb),'{used}','true'::jsonb,true),updated_at=now() WHERE key='imdb_discovery_test_override' AND value->>'enabled'='true' AND COALESCE(value->>'used','false')='false' RETURNING value`;
    if(!override)redirect(`/novedades?notice=discovery_blocked&next=${encodeURIComponent(nextAllowedAt.toISOString())}`);
    forceOnce=true;overrideConsumed=true;
  }
  let failure=null;
  try{
    const r=await fetch(DISPATCH_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PikoFilm/2.0'},body:JSON.stringify({ref:'main',inputs:{force_once:forceOnce?'true':'false'}}),cache:'no-store'});
    if(!r.ok){const detail=(await r.text()).slice(0,400);throw new Error(`GitHub workflow dispatch HTTP ${r.status}: ${detail}`)}
    await audit('news','discovery','manual','workflow_dispatch',{forceOnce,nextAllowedAt:nextAllowedAt?.toISOString()||null});
  }catch(e){failure=e}
  if(failure){if(overrideConsumed)await sql`UPDATE app_settings SET value=jsonb_set(COALESCE(value,'{}'::jsonb),'{used}','false'::jsonb,true),updated_at=now() WHERE key='imdb_discovery_test_override'`;await audit('news','discovery','manual','workflow_dispatch_failed',{forceOnce,error:failure?.message||String(failure)});refreshNews();redirect('/novedades?notice=dispatch_failed')}
  refreshNews();redirect(`/novedades?notice=discovery_dispatched${forceOnce?'_override':''}`)
}

export async function addManualCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();
  const [movie]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;if(movie)redirect(`/novedades?notice=exists&imdb=${encodeURIComponent(imdbId)}`);
  const [excluded]=await sql`SELECT imdb_id FROM catalog_exclusions WHERE imdb_id=${imdbId} LIMIT 1`;if(excluded)redirect(`/novedades?notice=excluded&imdb=${encodeURIComponent(imdbId)}`);
  try{const resolved=await upsertResolvedManual(sql,imdbId);const dispatched=await dispatchManualAuthoritative(imdbId);await audit('news','candidate',imdbId,'manual_add',{resolved:Boolean(resolved.candidate_type),title:resolved.source_snapshot?.title||null,authoritativeDispatched:dispatched});refreshNews();redirect(`/novedades?notice=manual_added&imdb=${encodeURIComponent(imdbId)}`)}
  catch(e){await audit('news','candidate',imdbId,'manual_resolve_failed',{error:e?.message||String(e)});await sql`INSERT INTO catalog_candidates(imdb_id,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at) VALUES(${imdbId},'eligible',now(),now(),now(),now(),${JSON.stringify({manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1',title:imdbId,manualResolveError:new Date().toISOString()})}::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET eligibility_status='eligible',last_seen_at=now(),last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||${JSON.stringify({manual:true,manualActive:true,matchedRule:'manual',manualResolveError:new Date().toISOString()})}::jsonb,updated_at=now()`;await dispatchManualAuthoritative(imdbId);refreshNews();redirect(`/novedades?notice=manual_resolve_error&imdb=${encodeURIComponent(imdbId)}`)}
}

export async function retryManualCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();
  const [candidate]=await sql`SELECT imdb_id FROM catalog_candidates WHERE imdb_id=${imdbId} AND eligibility_status='eligible' LIMIT 1`;
  if(!candidate)redirect('/novedades?notice=retry_missing');
  const dispatched=await dispatchManualAuthoritative(imdbId,{retry:true});refreshNews();redirect(`/novedades?notice=${dispatched?'retry_dispatched':'retry_failed'}&imdb=${encodeURIComponent(imdbId)}`)
}

export async function restoreAndAddManualAction(formData){const imdbId=imdbIdOf(formData),sql=db();await sql`DELETE FROM catalog_exclusions WHERE imdb_id=${imdbId}`;try{await upsertResolvedManual(sql,imdbId,{restored:true});const dispatched=await dispatchManualAuthoritative(imdbId);await audit('news','candidate',imdbId,'restore_manual',{resolved:true,authoritativeDispatched:dispatched});refreshNews();redirect(`/novedades?notice=restored&imdb=${encodeURIComponent(imdbId)}`)}catch(e){await audit('news','candidate',imdbId,'restore_manual_resolve_failed',{error:e?.message||String(e)});await dispatchManualAuthoritative(imdbId);refreshNews();redirect(`/novedades?notice=manual_resolve_error&imdb=${encodeURIComponent(imdbId)}`)}}
export async function excludeNewsCandidateAction(formData){const imdbId=imdbIdOf(formData),sql=db();await sql`INSERT INTO catalog_exclusions(imdb_id,reason,excluded_at,excluded_by) VALUES(${imdbId},'Excluida desde Novedades',now(),'pikofilm-ui') ON CONFLICT(imdb_id) DO UPDATE SET reason='Excluida desde Novedades',excluded_at=now(),excluded_by='pikofilm-ui'`;await audit('news','candidate',imdbId,'exclude');refreshNews();redirect('/novedades?notice=excluded_now')}
export async function removeManualCandidateAction(formData){const imdbId=imdbIdOf(formData),sql=db();await sql`UPDATE catalog_candidates SET eligibility_status='not_eligible',source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||'{"manualActive":false}'::jsonb,updated_at=now() WHERE imdb_id=${imdbId} AND source_snapshot->>'manual'='true'`;await audit('news','candidate',imdbId,'manual_remove');refreshNews();redirect('/novedades?notice=manual_removed')}

async function linkPlexCandidate(sql,imdbId,snap){
  const ratingKey=String(snap?.plexRatingKey||'').trim();if(!ratingKey)return;
  const [media]=await sql`SELECT resolution FROM plex_media WHERE rating_key=${ratingKey} ORDER BY media_index LIMIT 1`;
  await sql`INSERT INTO plex_catalog_status(imdb_id,status,rating_key,resolution,last_confirmed_at,source_updated_at,updated_at) VALUES(${imdbId},'in_plex',${ratingKey},${media?.resolution||null},now(),now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET status='in_plex',rating_key=EXCLUDED.rating_key,resolution=COALESCE(EXCLUDED.resolution,plex_catalog_status.resolution),last_confirmed_at=now(),source_updated_at=now(),updated_at=now()`;
}

export async function enrichNewsCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();const [existing]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;if(existing)redirect(`/catalogo/${imdbId}`);const [candidate]=await sql`SELECT * FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;if(!candidate)throw new Error('Candidato no encontrado');
  if(candidate.eligibility_status!=='eligible')redirect(`/novedades?notice=enrich_error&imdb=${encodeURIComponent(imdbId)}`);
  const snap=candidate.source_snapshot||{},isManual=snap.manual===true||snap.manual==='true',isPlex=snap.origin==='plex'||snap.matchedRule==='plex',origin=isPlex?'plex':isManual?'manual':'discovery',inclusionOrigin=isPlex?'plex':isManual?'imdb_manual':'imdb_discovery',movieOrigin=isPlex?'plex_news':'imdb_discovery',type=candidate.candidate_type==='movie'?'Película':candidate.candidate_type==='tvMiniSeries'?'Miniserie':'Serie',title=snap.title||snap.originalTitle||imdbId;const hasMinimumIdentity=title!==imdbId&&Boolean(candidate.candidate_type)&&['movie','tvSeries','tvMiniSeries'].includes(candidate.candidate_type);const run=await startRun('single_title','news',{stage:'adapter',imdb_id:imdbId,origin});
  try{await sql`INSERT INTO movies(imdb_id,type,title,title_es,year,origin,source_status,synced_at,inclusion_origin) VALUES(${imdbId},${type},${title},${title},${candidate.year||null},${movieOrigin},${JSON.stringify({staging:true,intake_origin:origin})}::jsonb,now(),${inclusionOrigin})`;const result=await enrichTitle(imdbId);await sql`UPDATE movies SET inclusion_origin=${inclusionOrigin},origin=${movieOrigin},source_status=COALESCE(source_status,'{}'::jsonb)-'staging' WHERE imdb_id=${imdbId}`;if(isPlex)await linkPlexCandidate(sql,imdbId,snap);await sql`UPDATE catalog_candidates SET eligibility_status='catalogued',processed_at=now(),updated_at=now() WHERE imdb_id=${imdbId}`;await finishRun(run.id,'success',{processed:1,added:1,summary:{stage:'done',imdb_id:imdbId,title:result.title,origin,enrichment:'complete'}});await audit('news','candidate',imdbId,'catalogue',{origin,enrichment:'complete',plex_rating_key:isPlex?snap.plexRatingKey||null:null})}
  catch(e){const err=errorInfo(e);if(hasMinimumIdentity){const partial={partial:true,enrichment_status:'pending',intake_origin:origin,last_enrichment_error:err?.message||String(e),last_enrichment_at:new Date().toISOString()};await sql`UPDATE movies SET inclusion_origin=${inclusionOrigin},origin=${movieOrigin},source_status=(COALESCE(source_status,'{}'::jsonb)-'staging')||${JSON.stringify(partial)}::jsonb WHERE imdb_id=${imdbId}`;if(isPlex)await linkPlexCandidate(sql,imdbId,snap);await sql`UPDATE catalog_candidates SET eligibility_status='catalogued',processed_at=now(),updated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({lastEnrichmentError:partial.last_enrichment_at,enrichmentPartial:true})}::jsonb WHERE imdb_id=${imdbId}`;await finishRun(run.id,'success',{processed:1,added:1,errors:1,summary:{stage:'partial',imdb_id:imdbId,title,origin,enrichment:'partial',pending_error:err}});await audit('news','candidate',imdbId,'catalogue_partial',{origin,error:err?.message||String(e)});refreshNews();redirect(`/catalogo/${imdbId}?notice=news_added_partial`)}await sql`DELETE FROM movies WHERE imdb_id=${imdbId} AND source_status->>'staging'='true'`;await sql`UPDATE catalog_candidates SET eligibility_status='eligible',updated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({lastEnrichmentError:new Date().toISOString()})}::jsonb WHERE imdb_id=${imdbId}`;await finishRun(run.id,'failed',{processed:1,errors:1,summary:{stage:'failed_identity',imdb_id:imdbId,origin,error:err}});refreshNews();redirect(`/novedades?notice=enrich_error&imdb=${encodeURIComponent(imdbId)}`)}
  refreshNews();redirect(`/catalogo/${imdbId}?notice=news_added`)
}

export async function saveNewsSettingsAction(formData){const current=await getNewsSettings(),sql=db();const excluded=String(formData.get('excludedCountries')||'Q668,IN').split(',').map(x=>x.trim()).filter(Boolean);const value={version:Number(current.version||DEFAULT_NEWS_SETTINGS.version)+1,movie:{general:{minRating:num(formData,'movieGeneralRating',current.movie.general.minRating,0,10),minVotes:Math.round(num(formData,'movieGeneralVotes',current.movie.general.minVotes,0))},spain:{minRating:num(formData,'movieSpainRating',current.movie.spain.minRating,0,10),minVotes:Math.round(num(formData,'movieSpainVotes',current.movie.spain.minVotes,0))}},series:{general:{minRating:num(formData,'seriesGeneralRating',current.series.general.minRating,0,10),minVotes:Math.round(num(formData,'seriesGeneralVotes',current.series.general.minVotes,0))},spain:{minRating:num(formData,'seriesSpainRating',current.series.spain.minRating,0,10),minVotes:Math.round(num(formData,'seriesSpainVotes',current.series.spain.minVotes,0))}},excludedCountries:excluded.length?excluded:['Q668','IN'],excludeAdult:true};await sql`INSERT INTO app_settings(key,value,description,updated_at) VALUES('imdb_discovery_v1',${JSON.stringify(value)}::jsonb,'Criterios configurables de Novedades IMDb',now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_at=now()`;await audit('news','settings','imdb_discovery_v1','update',{version:value.version});refreshNews();redirect('/novedades/criterios?notice=saved')}
