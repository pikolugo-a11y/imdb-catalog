import 'server-only';
import {db} from './db';
import {recomputeLifecycleForIds} from './lifecycle';
import {executeId001Canonical} from './id001-canonical.mjs';
import {createApiGate} from './batch-api-governance.mjs';

export async function resolveIdentityUnitary(imdbId,trace={}){
  const sql=db();
  return executeId001Canonical(sql,imdbId,{trace,lane:'manual',apiGate:createApiGate(sql),recomputeLifecycle:async id=>{
    const lifecycle=(await recomputeLifecycleForIds([id])).get(id);
    return lifecycle||null;
  }});
}
