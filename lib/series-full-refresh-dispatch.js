import 'server-only';
import {db} from './db';
import {audit,errorInfo,startRun,finishRun} from './runlog';

const URL='https://api.github.com/repos/pikolugo-a11y/imdb-catalog/actions/workflows/series-full-refresh.yml/dispatches';

export async function dispatchFullSeriesRefresh(source='web'){
  const sql=db();
  const [running]=await sql`SELECT id,started_at,processed_count,summary FROM pipeline_runs WHERE job_type='series_v2_refresh' AND status='running' AND updated_at>now()-interval '2 hours' ORDER BY created_at DESC LIMIT 1`;
  if(running)return{ok:true,alreadyRunning:true,runId:running.id,total:Number(running.summary?.total_series||0),processed:Number(running.processed_count||0)};
  const [count]=await sql`SELECT count(*)::int total FROM series_reference r JOIN plex_items p ON p.rating_key=r.show_rating_key AND p.active AND p.item_type='show' LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id WHERE r.tmdb_id IS NOT NULL AND ex.imdb_id IS NULL`;
  const total=Number(count?.total||0),run=await startRun('series_v2_refresh',source,{stage:'queued',mode:'full',total_series:total,progress_pct:0});
  const token=process.env.GITHUB_ACTIONS_TOKEN;
  if(!token){await finishRun(run.id,'failed',{errors:1,summary:{stage:'dispatch_failed',error:{message:'Falta GITHUB_ACTIONS_TOKEN'}}});await audit('quality','dashboard','series','refresh_dispatch_failed',{run_id:run.id,error:'Falta GITHUB_ACTIONS_TOKEN'});return{ok:false,message:'Falta GITHUB_ACTIONS_TOKEN'}}
  try{
    const r=await fetch(URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PikoFilm/3.0'},body:JSON.stringify({ref:'main',inputs:{run_id:String(run.id)}}),cache:'no-store'});
    if(!r.ok)throw new Error(`GitHub workflow dispatch HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
    await audit('quality','dashboard','series','refresh_dispatched',{run_id:run.id,total_series:total});
    return{ok:true,runId:run.id,total,alreadyRunning:false};
  }catch(e){await finishRun(run.id,'failed',{errors:1,summary:{stage:'dispatch_failed',error:errorInfo(e)}});await audit('quality','dashboard','series','refresh_dispatch_failed',{run_id:run.id,error:errorInfo(e)});return{ok:false,message:e?.message||'No se pudo lanzar la actualización completa'}}
}
