import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';

export async function startPikoRelevanceAssessment(imdbId,{origin='manual'}={}){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id))throw new Error('IMDb ID no válido');
  const sql=db(),bucket=Math.floor(Date.now()/300000),key=`PROC-REL-001:${id}:${bucket}`;
  const active=await sql`SELECT pr.run_id FROM process_runs pr JOIN batch_run_items bi ON bi.batch_run_id=pr.run_id WHERE pr.process_code='PROC-REL-001' AND bi.entity_id=${id} AND bi.status IN('queued','leased','running') ORDER BY pr.requested_at DESC LIMIT 1`;
  if(active[0])return{runId:active[0].run_id,reused:true};
  const started=await startProcessRun({processCode:'PROC-REL-001',runKind:'batch',triggerSource:origin,executor:'railway_batch_api',entityType:'series',entityId:id,correlationKey:key,idempotencyKey:key,context:{operation:'pikorelevancia_v0',formula_version:'0.1.0',origin}}),runId=started.run.run_id;
  if(started.reused)return{runId,reused:true};
  try{
    await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,'PROC-REL-001','api','running',1)`;
    await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) VALUES(${runId}::uuid,'series',${id},0,'queued')`;
    await sql`UPDATE process_runs SET items_total=1,items_pending=1,updated_at=now() WHERE run_id=${runId}::uuid`;
    await addProcessEvent(runId,{eventType:'assessment_queued',entityType:'series',entityId:id,message:'PikoRelevancia enviada al worker API',data:{formula_version:'0.1.0'}});
    return{runId,reused:false};
  }catch(error){
    await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo encolar PikoRelevancia'}).catch(()=>{});
    throw error;
  }
}

export async function getPikoRelevanceAssessment(imdbId){
  const id=String(imdbId||'').trim(),sql=db();
  const[row]=await sql`SELECT imdb_id,formula_version,score,confidence,recommendation,title_snapshot,evidence,factors,source_health,assessed_at,next_review_at FROM series_relevance_assessments WHERE imdb_id=${id} LIMIT 1`;
  return row||null;
}
