import 'server-only';
import {db} from './db';
import {audit} from './runlog';
import {createApiGate} from './batch-api-governance.mjs';
import {refreshRatingsCanonical} from './ratings-refresh-core.mjs';

export async function refreshRatingsForTitle(imdbId,{signal,trace}={}){
  const sql=db(),started=Date.now();
  await audit('ratings','title',imdbId,'ratings_refresh_started',{provider:'cascade'});
  try{
    const result=await refreshRatingsCanonical(sql,imdbId,{signal,trace,lane:'manual',apiGate:createApiGate(sql)});
    await audit('ratings','title',imdbId,'ratings_refresh_completed',{provider:'cascade',received:result.received,saved:result.saved,available:result.available,verified:result.verified,extras_saved:result.extrasSaved,steps:result.steps,duration_ms:Date.now()-started});
    return result;
  }catch(error){
    await audit('ratings','title',imdbId,'ratings_refresh_failed',{provider:error?.source||'cascade',error:error?.message||String(error),status:error?.status||null,duration_ms:Date.now()-started});
    throw error;
  }
}

export const refreshRatings=refreshRatingsForTitle;
