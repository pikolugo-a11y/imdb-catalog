'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {enrichTitle} from '@/lib/enrich-title';
import {DEFAULT_NEWS_SETTINGS,getNewsSettings} from '@/lib/news-v1';
import {audit,startRun,finishRun,errorInfo} from '@/lib/runlog';

const WEEK_MS=7*24*60*60*1000;
const DISPATCH_URL='https://api.github.com/repos/pikolugo-a11y/imdb-catalog/actions/workflows/imdb-discovery.yml/dispatches';
function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function num(formData,key,fallback,min=0,max=1e9){const n=Number(formData.get(key));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function refreshNews(){revalidatePath('/novedades');revalidatePath('/novedades/criterios');revalidatePath('/catalogo');revalidatePath('/catalogo/excluidas');revalidatePath('/calidad');revalidatePath('/calidad/identidad');revalidatePath('/admin');revalidatePath('/')}

export async function requestNewsDiscoveryAction(){
  const sql=db(),token=process.env.GITHUB_ACTIONS_TOKEN;
  if(!token){redirect('/novedades?notice=dispatch_not_configured')}
  const [lastSuccess]=await sql`SELECT finished_at,started_at FROM pipeline_runs WHERE job_type='imdb_discovery' AND status='success' ORDER BY COALESCE(finished_at,started_at) DESC LIMIT 1`;
  const lastAt=lastSuccess?.finished_at||lastSuccess?.started_at||null,nextAllowedAt=lastAt?new Date(new Date(lastAt).getTime()+WEEK_MS):null,cooldownActive=Boolean(nextAllowedAt&&nextAllowedAt>new Date());
  let forceOnce=false,overrideConsumed=false;
  if(cooldownActive){
    const [override]=await sql`UPDATE app_settings SET value=jsonb_set(COALESCE(value,'{}'::jsonb),'{used}','true'::jsonb,true),updated_at=now() WHERE key='imdb_discovery_test_override' AND value->>'enabled'='true' AND COALESCE(value->>'used','false')='false' RETURNING value`;
    if(!override)redirect(`/novedades?notice=discovery_blocked&next=${encodeURIComponent(nextAllowedAt.toISOString())}`);
    forceOnce=true;overrideConsumed=true;
  }
  try{
    const r=await fetch(DISPATCH_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PikoFilm/2.0'},body:JSON.stringify({ref:'main',inputs:{force_once:forceOnce?'true':'false'}}),cache:'no-store'});
    if(!r.ok){const detail=(await r.text()).slice(0,400);throw new Error(`GitHub workflow dispatch HTTP ${r.status}: ${detail}`)}
    await audit('news','discovery','manual','workflow_dispatch',{forceOnce,nextAllowedAt:nextAllowedAt?.toISOString()||null});refreshNews();redirect(`/novedades?notice=discovery_dispatched${forceOnce?'_override':''}`)
  }catch(e){
    if(overrideConsumed)await sql`UPDATE app_settings SET value=jsonb_set(COALESCE(value,'{}'::jsonb),'{used}','false'::jsonb,true),updated_at=now() WHERE key='imdb_discovery_test_override'`;
    await audit('news','discovery','manual','workflow_dispatch_failed',{forceOnce,error:e?.message||String(e)});refreshNews();redirect('/novedades?notice=dispatch_failed')
  }
}

export async function addManualCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();
  const [movie]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
  if(movie)redirect(`/novedades?notice=exists&imdb=${encodeURIComponent(imdbId)}`);
  const [excluded]=await sql`SELECT imdb_id FROM catalog_exclusions WHERE imdb_id=${imdbId} LIMIT 1`;
  if(excluded)redirect(`/novedades?notice=excluded&imdb=${encodeURIComponent(imdbId)}`);
  await sql`
    INSERT INTO catalog_candidates(imdb_id,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
    VALUES(${imdbId},'eligible',now(),now(),now(),now(),${JSON.stringify({manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1',title:imdbId})}::jsonb,now(),now())
    ON CONFLICT(imdb_id) DO UPDATE SET eligibility_status='eligible',last_seen_at=now(),became_eligible_at=COALESCE(catalog_candidates.became_eligible_at,now()),last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||${JSON.stringify({manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1'})}::jsonb,updated_at=now()`;
  await audit('news','candidate',imdbId,'manual_add');refreshNews();redirect(`/novedades?notice=manual_added&imdb=${encodeURIComponent(imdbId)}`)
}

export async function restoreAndAddManualAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();
  await sql`DELETE FROM catalog_exclusions WHERE imdb_id=${imdbId}`;
  await sql`
    INSERT INTO catalog_candidates(imdb_id,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
    VALUES(${imdbId},'eligible',now(),now(),now(),now(),${JSON.stringify({manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1',title:imdbId})}::jsonb,now(),now())
    ON CONFLICT(imdb_id) DO UPDATE SET eligibility_status='eligible',last_seen_at=now(),became_eligible_at=COALESCE(catalog_candidates.became_eligible_at,now()),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||${JSON.stringify({manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1'})}::jsonb,updated_at=now()`;
  await audit('news','candidate',imdbId,'restore_manual');refreshNews();redirect(`/novedades?notice=restored&imdb=${encodeURIComponent(imdbId)}`)
}

export async function excludeNewsCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();
  await sql`INSERT INTO catalog_exclusions(imdb_id,reason,excluded_at,excluded_by) VALUES(${imdbId},'Excluida desde Novedades',now(),'pikofilm-ui') ON CONFLICT(imdb_id) DO UPDATE SET reason='Excluida desde Novedades',excluded_at=now(),excluded_by='pikofilm-ui'`;
  await audit('news','candidate',imdbId,'exclude');refreshNews();redirect('/novedades?notice=excluded_now')
}

export async function removeManualCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();
  await sql`UPDATE catalog_candidates SET eligibility_status='not_eligible',source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||'{"manualActive":false}'::jsonb,updated_at=now() WHERE imdb_id=${imdbId} AND source_snapshot->>'manual'='true'`;
  await audit('news','candidate',imdbId,'manual_remove');refreshNews();redirect('/novedades?notice=manual_removed')
}

export async function enrichNewsCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db();
  const [existing]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
  if(existing)redirect(`/catalogo/${imdbId}`);
  const [candidate]=await sql`SELECT * FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
  if(!candidate)throw new Error('Candidato no encontrado');
  const snap=candidate.source_snapshot||{},isManual=snap.manual===true||snap.manual==='true',type=candidate.candidate_type==='movie'?'Película':'Serie',title=snap.title||snap.originalTitle||imdbId;
  const hasMinimumIdentity=title!==imdbId&&Boolean(candidate.candidate_type)&&['movie','tvSeries','tvMiniSeries'].includes(candidate.candidate_type);
  const run=await startRun('single_title','news',{stage:'adapter',imdb_id:imdbId});
  try{
    await sql`INSERT INTO movies(imdb_id,type,title,title_es,year,origin,source_status,synced_at,inclusion_origin) VALUES(${imdbId},${type},${title},${title},${candidate.year||null},'imdb_discovery','{"staging":true}'::jsonb,now(),${isManual?'imdb_manual':'imdb_discovery'})`;
    const result=await enrichTitle(imdbId);
    await sql`UPDATE movies SET inclusion_origin=${isManual?'imdb_manual':'imdb_discovery'},origin='imdb_discovery',source_status=COALESCE(source_status,'{}'::jsonb)-'staging' WHERE imdb_id=${imdbId}`;
    await sql`UPDATE catalog_candidates SET eligibility_status='catalogued',processed_at=now(),updated_at=now() WHERE imdb_id=${imdbId}`;
    await finishRun(run.id,'success',{processed:1,added:1,summary:{stage:'done',imdb_id:imdbId,title:result.title,origin:isManual?'manual':'discovery',enrichment:'complete'}});
    await audit('news','candidate',imdbId,'catalogue',{origin:isManual?'manual':'discovery',enrichment:'complete'});
  }catch(e){
    const err=errorInfo(e);
    if(hasMinimumIdentity){
      const partial={partial:true,enrichment_status:'pending',last_enrichment_error:err?.message||String(e),last_enrichment_at:new Date().toISOString()};
      await sql`UPDATE movies SET inclusion_origin=${isManual?'imdb_manual':'imdb_discovery'},origin='imdb_discovery',source_status=(COALESCE(source_status,'{}'::jsonb)-'staging')||${JSON.stringify(partial)}::jsonb WHERE imdb_id=${imdbId}`;
      await sql`UPDATE catalog_candidates SET eligibility_status='catalogued',processed_at=now(),updated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({lastEnrichmentError:partial.last_enrichment_at,enrichmentPartial:true})}::jsonb WHERE imdb_id=${imdbId}`;
      await finishRun(run.id,'success',{processed:1,added:1,errors:1,summary:{stage:'partial',imdb_id:imdbId,title,origin:isManual?'manual':'discovery',enrichment:'partial',pending_error:err}});
      await audit('news','candidate',imdbId,'catalogue_partial',{origin:isManual?'manual':'discovery',error:err?.message||String(e)});
      refreshNews();redirect(`/catalogo/${imdbId}?notice=news_added_partial`)
    }
    await sql`DELETE FROM movies WHERE imdb_id=${imdbId} AND source_status->>'staging'='true'`;
    await sql`UPDATE catalog_candidates SET eligibility_status='eligible',updated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({lastEnrichmentError:new Date().toISOString()})}::jsonb WHERE imdb_id=${imdbId}`;
    await finishRun(run.id,'failed',{processed:1,errors:1,summary:{stage:'failed_identity',imdb_id:imdbId,error:err}});refreshNews();redirect(`/novedades?notice=enrich_error&imdb=${encodeURIComponent(imdbId)}`)
  }
  refreshNews();redirect(`/catalogo/${imdbId}?notice=news_added`)
}

export async function saveNewsSettingsAction(formData){
  const current=await getNewsSettings(),sql=db();
  const excluded=String(formData.get('excludedCountries')||'Q668,IN').split(',').map(x=>x.trim()).filter(Boolean);
  const value={version:Number(current.version||DEFAULT_NEWS_SETTINGS.version)+1,movie:{general:{minRating:num(formData,'movieGeneralRating',current.movie.general.minRating,0,10),minVotes:Math.round(num(formData,'movieGeneralVotes',current.movie.general.minVotes,0))},spain:{minRating:num(formData,'movieSpainRating',current.movie.spain.minRating,0,10),minVotes:Math.round(num(formData,'movieSpainVotes',current.movie.spain.minVotes,0))}},series:{general:{minRating:num(formData,'seriesGeneralRating',current.series.general.minRating,0,10),minVotes:Math.round(num(formData,'seriesGeneralVotes',current.series.general.minVotes,0))},spain:{minRating:num(formData,'seriesSpainRating',current.series.spain.minRating,0,10),minVotes:Math.round(num(formData,'seriesSpainVotes',current.series.spain.minVotes,0))}},excludedCountries:excluded.length?excluded:['Q668','IN'],excludeAdult:true};
  await sql`INSERT INTO app_settings(key,value,description,updated_at) VALUES('imdb_discovery_v1',${JSON.stringify(value)}::jsonb,'Criterios configurables de Novedades IMDb',now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_at=now()`;
  await audit('news','settings','imdb_discovery_v1','update',{version:value.version});refreshNews();redirect('/novedades/criterios?notice=saved')
}
