import 'server-only';
import {db} from './db';
import {executeObservedProcess} from './process-runtime';
import {executeMov001Canonical,getMov001Snapshot} from './mov001-canonical.mjs';

export async function getMovieFileValidationSnapshot(imdbId){return getMov001Snapshot(db(),imdbId)}
export async function validateMovieFileCore(imdbId,{trace=null}={}){return executeMov001Canonical(db(),imdbId,{trace})}

export async function validateMovieFile(imdbId){
 if(!/^tt\d+$/.test(String(imdbId||'')))throw new Error('IMDb ID inválido');
 const requestKey=`PROC-MOV-001:manual:${imdbId}:${Math.floor(Date.now()/5000)}`;
 const observed=await executeObservedProcess({processCode:'PROC-MOV-001',runKind:'individual',triggerSource:'calidad_peliculas_manual',executor:'vercel',entityType:'movie',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/peliculas',operation:'validate_movie_file'}},async trace=>executeMov001Canonical(db(),imdbId,{trace}));
 return observed.reused?{files:0,issues:0,ratingKeys:[],lifecycle:null,reused:true,runId:observed.runId}:{...observed.result,reused:false,runId:observed.runId};
}
