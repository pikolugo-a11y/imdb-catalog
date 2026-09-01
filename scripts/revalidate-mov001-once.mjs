import {db} from '../lib/db.js';
import {executeObservedProcess} from '../lib/process-runtime.js';
import {executeMov001Canonical,getMov001Snapshot} from '../lib/mov001-canonical.mjs';

const imdbId=process.argv[2];
if(!/^tt\d+$/.test(String(imdbId||''))) throw new Error('IMDb ID inválido');
const sql=db();
const before=await getMov001Snapshot(sql,imdbId);
const requestKey=`PROC-MOV-001:maintenance:${imdbId}:${Date.now()}`;
const observed=await executeObservedProcess({processCode:'PROC-MOV-001',runKind:'individual',triggerSource:'github_actions_maintenance',executor:'github_actions',entityType:'movie',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'maintenance',operation:'revalidate_mov001_after_fingerprint_fix'}},async trace=>executeMov001Canonical(sql,imdbId,{trace}));
const after=await getMov001Snapshot(sql,imdbId);
console.log(JSON.stringify({imdbId,runId:observed.runId,reused:observed.reused,before,after,result:observed.result},null,2));
