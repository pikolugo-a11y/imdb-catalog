const cleanId=v=>String(v||'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchTmdb(imdbId,itemType,{apiToken,apiGate,lane='manual',owner='id001'}={}){
  if(!apiToken)throw Object.assign(new Error('TMDB_API_TOKEN no está configurado'),{processStep:'resolve_tmdb',source:'tmdb',permanent:true,retryable:false});
  let permit=null;
  try{
    if(apiGate)permit=await apiGate.acquire('tmdb',{lane,owner});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    let response;
    try{response=await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&language=es-ES`,{headers:{Authorization:`Bearer ${apiToken}`,Accept:'application/json'},signal:controller.signal})}finally{clearTimeout(timer)}
    if(response.status===429){const retryAfter=Math.max(1,Number(response.headers.get('retry-after'))||60);const e=Object.assign(new Error(`TMDb limitó la petición (429)`),{status:429,retryAfter,source:'tmdb',processStep:'resolve_tmdb',retryable:true});if(apiGate)await apiGate.failure('tmdb',e,{permit,lane});throw e}
    if(!response.ok){const e=Object.assign(new Error(`TMDb respondió HTTP ${response.status}`),{status:response.status,source:'tmdb',processStep:'resolve_tmdb',retryable:response.status>=500});if(apiGate)await apiGate.failure('tmdb',e,{permit,lane});throw e}
    const f=await response.json();
    if(apiGate)await apiGate.success('tmdb',{permit,lane});
    const hit=itemType==='Serie'||itemType==='Miniserie'?(f?.tv_results?.[0]||f?.movie_results?.[0]):(f?.movie_results?.[0]||f?.tv_results?.[0]);
    return hit?String(hit.id):null;
  }catch(error){
    if(error?.name==='AbortError')throw Object.assign(new Error('Timeout de 15 s consultando TMDb'),{source:'tmdb',processStep:'resolve_tmdb',retryable:true});
    throw error;
  }finally{if(apiGate&&permit?.leaseId)await apiGate.release(permit).catch(()=>{})}
}

async function saveIdentity(sql,imdbId,tmdbId){
  const tmdb=String(tmdbId);const now=new Date().toISOString();
  const patch=JSON.stringify({identity_resolver:'tmdb_imdb',identity_resolved_at:now,identity_refresh_state:'pending',identity_refresh_reason:'identity_completed',identity_refresh_marked_at:now,identity_completed_at:now});
  await sql`UPDATE movies SET tmdb_id=COALESCE(tmdb_id,${tmdb}),tmdb_url=CASE WHEN tmdb_id IS NULL THEN CASE WHEN type IN('Serie','Miniserie') THEN ${'https://www.themoviedb.org/tv/'+tmdb} ELSE ${'https://www.themoviedb.org/movie/'+tmdb} END ELSE tmdb_url END,source_status=COALESCE(source_status,'{}'::jsonb)||${patch}::jsonb,synced_at=now() WHERE imdb_id=${imdbId}`;
}

export async function executeId001Canonical(sql,imdbId,{trace=null,lane='manual',apiToken=process.env.TMDB_API_TOKEN,apiGate=null,recomputeLifecycle}={}){
  const id=cleanId(imdbId);if(!/^tt\d+$/.test(id))throw Object.assign(new Error('IMDb ID inválido'),{processStep:'validate_input',permanent:true,retryable:false});
  const[row]=await sql`SELECT imdb_id,type,tmdb_id FROM movies WHERE imdb_id=${id}`;if(!row)throw Object.assign(new Error('Título no encontrado'),{processStep:'load_title',permanent:true,retryable:false});
  const started=Date.now(),event=payload=>trace?.event?trace.event(payload):Promise.resolve(),external=count=>trace?.externalCall?trace.externalCall(count):Promise.resolve();
  const before={tmdb_id:row.tmdb_id?String(row.tmdb_id):null,lifecycle_state:null};
  await event({eventType:'step_started',step:'resolve_tmdb',message:row.tmdb_id?'TMDb ya existente; no se consulta fuente externa':'Resolviendo TMDb desde IMDb',data:{existing_tmdb:Boolean(row.tmdb_id),lane}});
  let tmdbId=row.tmdb_id?String(row.tmdb_id):null;const methods=[];
  if(!tmdbId){await external(1);tmdbId=await fetchTmdb(id,row.type,{apiToken,apiGate,lane,owner:`${lane}:${id}:${trace?.runId||Date.now()}`});if(tmdbId){await saveIdentity(sql,id,tmdbId);methods.push('tmdb_imdb');await event({eventType:'step_completed',step:'resolve_tmdb',message:`TMDb ${tmdbId} resuelto y guardado`,durationMs:Date.now()-started,data:{method:'tmdb_imdb',tmdb_id:tmdbId}})}else{methods.push('tmdb_not_found');await event({eventType:'step_completed',step:'resolve_tmdb',message:'TMDb respondió sin coincidencia',durationMs:Date.now()-started,data:{method:'tmdb_not_found'}})}}else{methods.push('existing_tmdb');await event({eventType:'step_completed',step:'resolve_tmdb',message:`TMDb ${tmdbId} ya existente`,durationMs:Date.now()-started,data:{method:'existing_tmdb',tmdb_id:tmdbId}})}
  const[after]=await sql`SELECT imdb_id,tmdb_id FROM movies WHERE imdb_id=${id}`;await event({eventType:'step_started',step:'recompute_lifecycle',message:'Recalculando Lifecycle'});
  const lifecycle=typeof recomputeLifecycle==='function'?await recomputeLifecycle(id,sql):null;await event({eventType:'step_completed',step:'recompute_lifecycle',message:`Lifecycle: ${lifecycle?.state||'sin estado'}`,data:{lifecycle_state:lifecycle?.state||null}});
  const complete=Boolean(after?.imdb_id&&after?.tmdb_id),functionalResult=complete?(before.tmdb_id?'no_change':'updated'):'not_found';
  return{ok:true,complete,notFound:!complete&&!tmdbId,tmdbId:after?.tmdb_id||null,methods,lifecycle,durationMs:Date.now()-started,functionalResult,externalCalls:before.tmdb_id?0:1,before,after:{tmdb_id:after?.tmdb_id?String(after.tmdb_id):null,lifecycle_state:lifecycle?.state||null},technicalStatus:'succeeded',metrics:{methods,duration_ms:Date.now()-started,external_calls:before.tmdb_id?0:1},message:complete?'Identidad resuelta':'Identidad no encontrada'};
}
