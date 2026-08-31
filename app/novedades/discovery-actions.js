'use server';
import crypto from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';

const WEEK_MS=7*24*60*60*1000;
const DISPATCH_URL='https://api.github.com/repos/pikolugo-a11y/imdb-catalog/actions/workflows/imdb-discovery.yml/dispatches';
const refresh=()=>{revalidatePath('/novedades');revalidatePath('/admin')};

export async function requestNewsDiscoveryAction(){
  const sql=db(),token=process.env.GITHUB_ACTIONS_TOKEN;
  if(!token)redirect('/novedades?notice=dispatch_not_configured');
  const[active]=await sql`SELECT run_id,technical_status FROM process_runs WHERE process_code='PROC-NOV-001' AND technical_status IN('queued','running') ORDER BY requested_at DESC LIMIT 1`;
  if(active)redirect('/novedades?notice=discovery_running');
  const[last]=await sql`SELECT finished_at FROM process_runs WHERE process_code='PROC-NOV-001' AND technical_status='succeeded' AND COALESCE(functional_result,'')<>'blocked' AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
  const nextAllowedAt=last?.finished_at?new Date(new Date(last.finished_at).getTime()+WEEK_MS):null;
  if(nextAllowedAt&&nextAllowedAt>new Date())redirect(`/novedades?notice=discovery_blocked&next=${encodeURIComponent(nextAllowedAt.toISOString())}`);
  const runId=crypto.randomUUID(),correlationKey=`PROC-NOV-001:${runId}`;
  await sql`INSERT INTO process_runs(run_id,process_code,run_kind,trigger_source,executor,technical_status,entity_type,entity_id,correlation_key,idempotency_key,requested_at,context,created_at,updated_at) VALUES(${runId}::uuid,'PROC-NOV-001','system','novedades_manual','github_actions','queued','discovery','global',${correlationKey},${runId},now(),${JSON.stringify({surface:'/novedades',operation:'imdb_global_discovery'})}::jsonb,now(),now())`;
  await sql`INSERT INTO process_run_events(run_id,event_type,entity_type,entity_id,message,data) VALUES(${runId}::uuid,'run_requested','discovery','global','Discovery IMDb solicitado desde Novedades',${JSON.stringify({executor:'github_actions'})}::jsonb)`;
  try{
    const r=await fetch(DISPATCH_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PikoFilm/3.0'},body:JSON.stringify({ref:'main',inputs:{run_id:runId}}),cache:'no-store'});
    if(!r.ok)throw new Error(`GitHub workflow dispatch HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
    await sql`INSERT INTO process_run_events(run_id,event_type,step,entity_type,entity_id,message) VALUES(${runId}::uuid,'queued','dispatch','discovery','global','Run enviado a GitHub Actions')`;
  }catch(e){
    const message=e?.message||String(e);
    await sql`INSERT INTO process_run_errors(run_id,process_code,entity_type,entity_id,step,error_class,message,source,retryable) VALUES(${runId}::uuid,'PROC-NOV-001','discovery','global','dispatch',${e?.name||'Error'},${message},'github_api',false)`;
    await sql`UPDATE process_runs SET technical_status='failed',finished_at=now(),duration_ms=GREATEST(0,ROUND(EXTRACT(EPOCH FROM(now()-requested_at))*1000)::bigint),error_count=error_count+1,updated_at=now() WHERE run_id=${runId}::uuid`;
    await sql`INSERT INTO process_run_events(run_id,event_type,step,entity_type,entity_id,message) VALUES(${runId}::uuid,'error','dispatch','discovery','global',${message})`;
    refresh();redirect('/novedades?notice=dispatch_failed');
  }
  refresh();redirect('/novedades?notice=discovery_dispatched');
}
