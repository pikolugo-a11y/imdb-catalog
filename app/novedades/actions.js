'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {enrichTitle} from '@/lib/enrich-title';
import {DEFAULT_NEWS_SETTINGS,getNewsSettings} from '@/lib/news-v1';
import {audit,startRun,finishRun,errorInfo} from '@/lib/runlog';

function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function num(formData,key,fallback,min=0,max=1e9){const n=Number(formData.get(key));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function refreshNews(){revalidatePath('/novedades');revalidatePath('/novedades/criterios');revalidatePath('/catalogo');revalidatePath('/catalogo/excluidas');revalidatePath('/admin');revalidatePath('/')}

export async function requestNewsDiscoveryAction(){
  const sql=db();
  const [existing]=await sql`SELECT id,status FROM admin_job_requests WHERE job_type='imdb_discovery' AND status IN('pending','running') ORDER BY requested_at DESC LIMIT 1`;
  if(!existing){await sql`INSERT INTO admin_job_requests(job_type,payload,status,requested_at) VALUES('imdb_discovery','{}'::jsonb,'pending',now())`;await audit('news','discovery','manual','queue')}
  refreshNews();
  redirect('/novedades?notice=queued');
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
    ON CONFLICT(imdb_id) DO UPDATE SET
      eligibility_status='eligible',last_seen_at=now(),became_eligible_at=COALESCE(catalog_candidates.became_eligible_at,now()),last_evaluated_at=now(),
      source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||${JSON.stringify({manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1'})}::jsonb,
      updated_at=now()`;
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
  const run=await startRun('single_title','news',{stage:'adapter',imdb_id:imdbId});
  try{
    await sql`INSERT INTO movies(imdb_id,type,title,title_es,year,origin,source_status,synced_at,inclusion_origin) VALUES(${imdbId},${type},${title},${title},${candidate.year||null},'imdb_discovery','{"staging":true}'::jsonb,now(),${isManual?'imdb_manual':'imdb_discovery'})`;
    const result=await enrichTitle(imdbId);
    await sql`UPDATE movies SET inclusion_origin=${isManual?'imdb_manual':'imdb_discovery'},origin='imdb_discovery',source_status=source_status-'staging' WHERE imdb_id=${imdbId}`;
    await sql`UPDATE catalog_candidates SET eligibility_status='catalogued',processed_at=now(),updated_at=now() WHERE imdb_id=${imdbId}`;
    await finishRun(run.id,'success',{processed:1,added:1,summary:{stage:'done',imdb_id:imdbId,title:result.title,origin:isManual?'manual':'discovery'}});
    await audit('news','candidate',imdbId,'catalogue',{origin:isManual?'manual':'discovery'});refreshNews();redirect(`/catalogo/${imdbId}?notice=news_added`)
  }catch(e){
    await sql`DELETE FROM movies WHERE imdb_id=${imdbId} AND source_status->>'staging'='true'`;
    await sql`UPDATE catalog_candidates SET eligibility_status='eligible',updated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({lastEnrichmentError:new Date().toISOString()})}::jsonb WHERE imdb_id=${imdbId}`;
    await finishRun(run.id,'failed',{processed:1,errors:1,summary:{stage:'failed',imdb_id:imdbId,error:errorInfo(e)}});refreshNews();redirect(`/novedades?notice=enrich_error&imdb=${encodeURIComponent(imdbId)}`)
  }
}

export async function saveNewsSettingsAction(formData){
  const current=await getNewsSettings(),sql=db();
  const excluded=String(formData.get('excludedCountries')||'Q668,IN').split(',').map(x=>x.trim()).filter(Boolean);
  const value={
    version:Number(current.version||DEFAULT_NEWS_SETTINGS.version)+1,
    movie:{
      general:{minRating:num(formData,'movieGeneralRating',current.movie.general.minRating,0,10),minVotes:Math.round(num(formData,'movieGeneralVotes',current.movie.general.minVotes,0))},
      spain:{minRating:num(formData,'movieSpainRating',current.movie.spain.minRating,0,10),minVotes:Math.round(num(formData,'movieSpainVotes',current.movie.spain.minVotes,0))}
    },
    series:{
      general:{minRating:num(formData,'seriesGeneralRating',current.series.general.minRating,0,10),minVotes:Math.round(num(formData,'seriesGeneralVotes',current.series.general.minVotes,0))},
      spain:{minRating:num(formData,'seriesSpainRating',current.series.spain.minRating,0,10),minVotes:Math.round(num(formData,'seriesSpainVotes',current.series.spain.minVotes,0))}
    },
    excludedCountries:excluded.length?excluded:['Q668','IN'],excludeAdult:true
  };
  await sql`INSERT INTO app_settings(key,value,description,updated_at) VALUES('imdb_discovery_v1',${JSON.stringify(value)}::jsonb,'Criterios configurables de Novedades IMDb',now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_at=now()`;
  await audit('news','settings','imdb_discovery_v1','update',{version:value.version});refreshNews();
  if(String(formData.get('runNow')||'')==='1'){
    const [existing]=await sql`SELECT id FROM admin_job_requests WHERE job_type='imdb_discovery' AND status IN('pending','running') LIMIT 1`;
    if(!existing)await sql`INSERT INTO admin_job_requests(job_type,payload,status,requested_at) VALUES('imdb_discovery',${JSON.stringify({settingsVersion:value.version})}::jsonb,'pending',now())`;
    redirect('/novedades?notice=settings_saved_queued')
  }
  redirect('/novedades/criterios?notice=saved')
}
