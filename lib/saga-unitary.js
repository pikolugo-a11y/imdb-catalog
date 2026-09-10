import 'server-only';
import {db} from './db';
import {executeObservedProcess} from './process-runtime';
import {createApiGate} from './batch-api-governance.mjs';
import {refreshSagaCollectionCanonical} from './saga-refresh-core.mjs';

export async function refreshSagaCollectionUnitary(collectionId,{requestKey}={}){
  const id=String(collectionId||'').trim();
  if(!/^\d+$/.test(id))throw new Error('TMDb collection ID inválido');
  const key=requestKey||`saga-refresh:${id}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({
    processCode:'PROC-SAGA-001',
    runKind:'individual',
    triggerSource:'sagas_manual',
    executor:'vercel',
    entityType:'saga_collection',
    entityId:id,
    correlationKey:key,
    idempotencyKey:`PROC-SAGA-001:${key}`,
    context:{surface:`/sagas/${id}`,operation:'refresh_saga_tmdb'}
  },async trace=>{
    const sql=db();
    return refreshSagaCollectionCanonical(sql,id,{trace,lane:'manual',apiGate:createApiGate(sql)});
  });
  if(observed.reused)return{reused:true,runId:observed.runId,members:0,identity_corrections:0};
  return{...observed.result,...observed.result?.after,reused:false,runId:observed.runId};
}
