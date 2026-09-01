import {validateIdentityEvidence} from './identity-title-normalization-core.mjs';

const mediaFor=t=>t==='Serie'||t==='Miniserie'?'tv':'movie';
const firstYear=v=>{const m=String(v||'').match(/(19|20)\d{2}/);return m?Number(m[0]):null};
const omdbKey=()=>process.env.OMDB_API_KEY||process.env.OMDB_APIKEY||process.env.OMDB_KEY||null;

async function requestJson(url,{headers={},source,trace,apiGate,lane='manual',owner='identity-validation'}={}){
  let permit=null;
  try{
    if(apiGate)permit=await apiGate.acquire(source,{lane,owner});
    await trace?.externalCall?.(1);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    let response;
    try{response=await fetch(url,{headers,signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
    const body=await response.text();
    if(!response.ok){
      const retryAfter=Number(response.headers.get('retry-after'))||null;
      throw Object.assign(new Error(`HTTP ${response.status} en ${new URL(url).hostname}: ${body.slice(0,160)}`),{status:response.status,retryAfter,source});
    }
    const contentType=response.headers.get('content-type')||'';
    if(!contentType.toLowerCase().includes('application/json'))throw Object.assign(new Error(`Respuesta no JSON desde ${new URL(url).hostname}`),{source});
    if(apiGate)await apiGate.success(source);
    return JSON.parse(body);
  }catch(error){
    if(apiGate)await apiGate.failure(source,error,{lane}).catch(()=>{});
    throw error;
  }finally{
    if(apiGate&&permit)await apiGate.release(permit).catch(()=>{});
  }
}

async function imdbEvidence(sql,imdbId,{trace,apiGate,lane}){
  const[c]=await sql`SELECT year,source_snapshot FROM catalog_candidates WHERE imdb_id=${imdbId}`;
  if(c?.source_snapshot?.originalTitle&&c?.year)return{imdb_title:c.source_snapshot.title||null,imdb_original_title:c.source_snapshot.originalTitle,imdb_year:Number(c.year),imdb_source:'imdb_dataset_cache'};
  const[m]=await sql`SELECT title,original_title,year FROM movies WHERE imdb_id=${imdbId}`;
  if(m?.original_title&&m?.year)return{imdb_title:m.title||null,imdb_original_title:m.original_title,imdb_year:Number(m.year),imdb_source:'catalog'};
  const key=omdbKey();
  if(key){
    try{
      await trace?.event?.({eventType:'step_started',step:'imdb_omdb_fallback',message:'Consultando OMDb como respaldo IMDb'});
      const d=await requestJson(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}&plot=short&r=json`,{headers:{'User-Agent':'PikoFilm/3.0'},source:'omdb',trace,apiGate,lane,owner:`iv001:${imdbId}:omdb`});
      if(d?.Response!=='False'&&d?.Title&&d.Title!=='N/A'){
        await trace?.event?.({eventType:'step_completed',step:'imdb_omdb_fallback',message:'Respaldo OMDb obtenido'});
        return{imdb_title:d.Title,imdb_original_title:d.Title,imdb_year:firstYear(d.Year),imdb_source:'omdb'};
      }
    }catch(error){
      if(error?.apiGateReason)throw error;
      await trace?.event?.({eventType:'step_warning',step:'imdb_omdb_fallback',message:'OMDb no aportó evidencia utilizable'});
    }
  }
  return{imdb_title:m?.title||null,imdb_original_title:m?.original_title||null,imdb_year:Number(m?.year)||null,imdb_source:'catalog_incomplete'};
}

async function tmdbEvidence(imdbId,tmdbId,type,{trace,apiGate,lane}){
  const token=process.env.TMDB_API_TOKEN;if(!token)throw new Error('Falta TMDB_API_TOKEN');
  const media=mediaFor(type),headers={Authorization:`Bearer ${token}`,Accept:'application/json'};
  await trace?.event?.({eventType:'step_started',step:'tmdb_evidence',message:'Comprobando identidad en TMDb',data:{calls:3}});
  try{
    const urls=[
      `https://api.themoviedb.org/3/${media}/${tmdbId}?language=es-ES`,
      `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`,
      `https://api.themoviedb.org/3/${media}/${tmdbId}/external_ids`,
    ];
    const[d,find,external]=await Promise.all(urls.map((url,index)=>requestJson(url,{headers,source:'tmdb',trace,apiGate,lane,owner:`iv001:${imdbId}:tmdb:${index+1}`})));
    const date=d.release_date||d.first_air_date||'',list=media==='tv'?find.tv_results:find.movie_results,first=Array.isArray(list)&&list.length?list[0]:null;
    const result={tmdb_id:String(tmdbId),tmdb_title_es:d.title||d.name||null,tmdb_original_title:d.original_title||d.original_name||null,tmdb_year:Number(date.slice(0,4))||null,link_evidence:{expected_imdb_id:String(imdbId),expected_tmdb_id:String(tmdbId),expected_media_type:media,forward_found:Boolean(first),forward_tmdb_id:first?.id!=null?String(first.id):null,forward_media_type:first?media:null,forward_match:Boolean(first&&String(first.id)===String(tmdbId)),reverse_imdb_id:external?.imdb_id||null,reverse_match:Boolean(external?.imdb_id&&String(external.imdb_id)===String(imdbId)),type_match:true}};
    await trace?.event?.({eventType:'step_completed',step:'tmdb_evidence',message:'Comprobación TMDb completada',data:{forward_match:result.link_evidence.forward_match,reverse_match:result.link_evidence.reverse_match}});
    return result;
  }catch(error){error.processStep=error.processStep||'tmdb_evidence';error.source=error.source||'tmdb';error.retryable=error.retryable!==false;throw error}
}

const validManual=(manual,evidence,imdbId)=>manual&&manual.status&&String(manual.imdb_id||'')===String(imdbId)&&String(manual.tmdb_id||'')===String(evidence.tmdb_id||'');

export async function executeIv001Canonical(sql,imdbId,{trace=null,apiGate=null,lane='manual',recomputeLifecycle=null}={}){
  const[m]=await sql`SELECT m.imdb_id,m.type,m.tmdb_id,cl.lifecycle_state FROM movies m LEFT JOIN catalog_lifecycle cl USING(imdb_id) WHERE m.imdb_id=${imdbId}`;
  if(!m)throw new Error('Título no encontrado');
  if(!['IDENTITY_VALIDATION','IDENTITY_REVIEW_REQUIRED'].includes(String(m.lifecycle_state||'')))throw new Error('El título ya no está en Validación de identidad');
  if(!m.tmdb_id)throw new Error('Necesita IMDb + TMDb antes de obtener evidencia');
  await sql`INSERT INTO identity_validation(imdb_id,validation_status,validation_details,created_at,updated_at) VALUES(${imdbId},'pending_data','{}'::jsonb,now(),now()) ON CONFLICT(imdb_id) DO NOTHING`;
  const[before]=await sql`SELECT validation_status,validation_score,tmdb_id,validation_details FROM identity_validation WHERE imdb_id=${imdbId}`;
  await trace?.event?.({eventType:'step_started',step:'collect_evidence',message:'Recopilando evidencia IMDb ↔ TMDb',data:{tmdb_id:String(m.tmdb_id)}});
  const started=Date.now();
  const[imdb,tmdb]=await Promise.all([imdbEvidence(sql,imdbId,{trace,apiGate,lane}),tmdbEvidence(imdbId,m.tmdb_id,m.type,{trace,apiGate,lane})]);
  const[v]=await sql`SELECT validation_details FROM identity_validation WHERE imdb_id=${imdbId}`;const manual=v?.validation_details?.manual;
  await sql`UPDATE identity_validation SET imdb_title=${imdb.imdb_title||null},imdb_original_title=${imdb.imdb_original_title||null},imdb_year=${imdb.imdb_year||null},imdb_extracted_at=now(),tmdb_id=${tmdb.tmdb_id},tmdb_title_es=${tmdb.tmdb_title_es},tmdb_original_title=${tmdb.tmdb_original_title},tmdb_year=${tmdb.tmdb_year},tmdb_extracted_at=now(),validation_details=${JSON.stringify({link_evidence:tmdb.link_evidence,...(manual?{manual}:{})})}::jsonb,validation_status='pending_data',validation_score=NULL,suspected_source=NULL,validated_at=NULL,updated_at=now() WHERE imdb_id=${imdbId}`;
  const complete=Boolean((imdb.imdb_original_title&&imdb.imdb_year)||(tmdb.link_evidence.forward_match||tmdb.link_evidence.reverse_match));
  const after={validation_status:'pending_data',validation_score:null,tmdb_id:String(tmdb.tmdb_id),imdb_source:imdb.imdb_source,evidence_complete:complete,forward_match:tmdb.link_evidence.forward_match,reverse_match:tmdb.link_evidence.reverse_match};
  await trace?.event?.({eventType:'step_completed',step:'collect_evidence',message:complete?'Evidencia preparada para validar':'Evidencia actualizada pero incompleta',durationMs:Date.now()-started,data:{complete,imdb_source:imdb.imdb_source,forward_match:tmdb.link_evidence.forward_match,reverse_match:tmdb.link_evidence.reverse_match}});
  let lifecycle=null;if(recomputeLifecycle){await trace?.event?.({eventType:'step_started',step:'recompute_lifecycle',message:'Recalculando Lifecycle'});lifecycle=await recomputeLifecycle(imdbId,sql);await trace?.event?.({eventType:'step_completed',step:'recompute_lifecycle',message:'Lifecycle recalculado',data:{next:lifecycle?.label||lifecycle?.state||null}})}
  return{evidence:{...imdb,...tmdb},complete,failed:[],technicalStatus:'succeeded',functionalResult:complete?'updated':'pending',before:{validation_status:before?.validation_status||null,validation_score:before?.validation_score??null,tmdb_id:before?.tmdb_id?String(before.tmdb_id):null,had_manual:Boolean(before?.validation_details?.manual)},after:{...after,lifecycle:lifecycle?.label||lifecycle?.state||null},metrics:{evidence_complete:complete,imdb_source:imdb.imdb_source,duration_ms:Date.now()-started},message:complete?'Evidencia preparada para validar':'Evidencia actualizada; sigue incompleta'};
}

export async function executeIv002Canonical(sql,imdbId,{trace=null,recomputeLifecycle=null}={}){
  const[m]=await sql`SELECT cl.lifecycle_state FROM catalog_lifecycle cl WHERE cl.imdb_id=${imdbId}`;
  if(!m||!['IDENTITY_VALIDATION','IDENTITY_REVIEW_REQUIRED'].includes(String(m.lifecycle_state||'')))throw new Error('El título ya no está en Validación de identidad');
  const[v]=await sql`SELECT * FROM identity_validation WHERE imdb_id=${imdbId}`;if(!v?.tmdb_id)throw new Error('Falta TMDb. Obtén primero la evidencia.');
  const before={validation_status:v.validation_status||null,validation_score:v.validation_score??null,suspected_source:v.suspected_source||null,had_manual:Boolean(v.validation_details?.manual)};
  await trace?.event?.({eventType:'step_started',step:'score_identity',message:'Evaluando evidencia guardada'});
  const evidence={imdb_title:v.imdb_title,imdb_original_title:v.imdb_original_title,imdb_year:v.imdb_year,tmdb_id:v.tmdb_id,tmdb_title_es:v.tmdb_title_es,tmdb_original_title:v.tmdb_original_title,tmdb_year:v.tmdb_year,link_evidence:v.validation_details?.link_evidence||{}};
  const automatic=validateIdentityEvidence(evidence),manual=v.validation_details?.manual,manualApplied=validManual(manual,evidence,imdbId),status=manualApplied?manual.status:automatic.status,details={...automatic.details,...(manualApplied?{manual}:{})};
  await sql`UPDATE identity_validation SET validation_status=${status},validation_score=${automatic.score},validation_details=${JSON.stringify(details)}::jsonb,suspected_source=${automatic.suspected},validated_at=now(),updated_at=now() WHERE imdb_id=${imdbId}`;
  await trace?.event?.({eventType:'step_completed',step:'score_identity',message:'Identidad evaluada',data:{automatic_status:automatic.status,effective_status:status,score:automatic.score,manual_applied:manualApplied,suspected_source:automatic.suspected||null}});
  let lifecycle=null;if(recomputeLifecycle){await trace?.event?.({eventType:'step_started',step:'recompute_lifecycle',message:'Recalculando Lifecycle'});lifecycle=await recomputeLifecycle(imdbId,sql);await trace?.event?.({eventType:'step_completed',step:'recompute_lifecycle',message:'Lifecycle recalculado',data:{next:lifecycle?.label||lifecycle?.state||null}})}
  const functionalResult=status==='valid'?'updated':status==='insufficient'?'pending':'blocked';
  return{...automatic,status,automaticStatus:automatic.status,manualApplied,technicalStatus:'succeeded',functionalResult,before,after:{validation_status:status,automatic_status:automatic.status,validation_score:automatic.score??null,suspected_source:automatic.suspected||null,manual_applied:Boolean(manualApplied),lifecycle:lifecycle?.label||lifecycle?.state||null},metrics:{validation_status:status,automatic_status:automatic.status,score:automatic.score??null,manual_applied:Boolean(manualApplied)},message:status==='valid'?'Identidad validada':status==='insufficient'?'Evidencia insuficiente para validar':'Identidad requiere revisión'};
}
