import {NextResponse} from 'next/server';
import {captureDashboardSnapshot} from '@/lib/dashboard-v2';
import {appendDatabaseStorageSnapshot} from '@/lib/database-storage';
import {startSeriesBatch} from '@/lib/series-batch';
import {startData002Batch} from '@/lib/data002-batch';
import {startPeopleBatch} from '@/lib/people-batch';
import {startMov001Batch} from '@/lib/mov001-batch';
import {processC6Batch} from '@/lib/pikoquality-c6-batch';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
export const dynamic='force-dynamic';

const brief=value=>value&&typeof value==='object'?{empty:Boolean(value.empty),reused:Boolean(value.reused),eligibleCount:Number(value.eligibleCount||0),appended:Number(value.appended||0),runId:value.run?.run_id||null}:value;
async function safe(name,fn){try{return{name,ok:true,result:brief(await fn())}}catch(error){console.error(`quality scheduler ${name}`,error);return{name,ok:false,error:String(error?.message||error)}}}
async function runC6Maintenance(){
  const sql=db();const[active]=await sql`SELECT run_id FROM process_runs WHERE process_code='PROC-PQ-001' AND technical_status IN('queued','running') ORDER BY requested_at DESC LIMIT 1`;
  if(active)return{skipped:true,reason:'active_manual_or_batch',runId:String(active.run_id)};
  const key=`PROC-PQ-001:quality_scheduler:${new Date().toISOString().slice(0,10)}`;
  const observed=await executeObservedProcess({processCode:'PROC-PQ-001',runKind:'system',triggerSource:'quality_scheduler',executor:'vercel_cron',entityType:'pikoquality',entityId:'formula_maintenance',correlationKey:key,idempotencyKey:key,context:{mode:'progressive',limit:200,automatic:true}},async()=>{
    const r=await processC6Batch(200);
    return{technicalStatus:'succeeded',functionalResult:r.processed?'updated':'no_change',metrics:{processed:r.processed,remaining:r.remaining,formula_version:r.version,items_per_second:r.itemsPerSecond},after:{remaining:r.remaining,aggregates:r.aggregates||null},message:r.processed?`PikoQuality progresivo: ${r.processed} recalculados`:'PikoQuality sin deuda pendiente',...r};
  });
  return observed.result||{reused:true,runId:observed.runId};
}
async function enqueueQualityMaintenance(){
  // No se consulta Plex aquí. SER-002 sólo continúa invalidaciones ya detectadas por un sync Plex manual.
  const jobs=await Promise.all([
    safe('movies',()=>startMov001Batch({limit:100,triggerSource:'quality_scheduler'})),
    safe('series_plex_continuation',()=>startSeriesBatch('PROC-SER-002',{limit:50,triggerSource:'quality_scheduler'})),
    safe('series_tmdb',()=>startSeriesBatch('PROC-SER-003',{limit:50,triggerSource:'quality_scheduler'})),
    safe('series_es',()=>startSeriesBatch('PROC-SER-004',{limit:50,triggerSource:'quality_scheduler'})),
    safe('ratings',()=>startData002Batch({limit:200,concurrency:2,triggerSource:'quality_scheduler'})),
    safe('people',()=>startPeopleBatch({limit:25,concurrency:2,triggerSource:'quality_scheduler'})),
    safe('pikoquality',()=>runC6Maintenance())
  ]);
  return{jobs,errors:jobs.filter(x=>!x.ok).length};
}

export async function GET(request){
  const secret=process.env.CRON_SECRET;
  if(secret&&request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  const maintenance=await enqueueQualityMaintenance();
  try{
    const metrics=await captureDashboardSnapshot();
    const storage=await appendDatabaseStorageSnapshot();
    return NextResponse.json({ok:true,date:new Date().toISOString().slice(0,10),metrics:{...metrics,...storage},qualityMaintenance:maintenance});
  }catch(error){
    console.error('dashboard snapshot cron',error);
    return NextResponse.json({ok:false,error:'snapshot_failed',qualityMaintenance:maintenance},{status:500});
  }
}
