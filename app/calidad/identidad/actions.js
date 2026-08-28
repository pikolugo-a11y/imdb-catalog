'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {resolveIdentityUnitary} from '@/lib/identity-unitary';
import {executeObservedProcess} from '@/lib/process-runtime';
import {validateTmdbIdentity} from '@/lib/identity-resolver';
import {saveIdentity} from '@/lib/identity';
import {markIdentityRefreshPending,refreshKnownIdentity} from '@/lib/identity-refresh';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';

function refresh(imdbId){revalidatePath('/calidad/identidad');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId){revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`)}}
function imdb(formData,name='imdbId'){const id=String(formData.get(name)||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function tmdb(formData){const id=String(formData.get('tmdbId')||'').trim();if(id&&!/^\d+$/.test(id))throw new Error('TMDb ID inválido');return id}
async function recordOutcome(id,outcome){const sql=db();await sql`INSERT INTO batch_process_state(entity_type,entity_id,stage,attempt_count,no_progress_count,last_attempt_at,last_outcome,manual_review,updated_at) VALUES('title',${id},'IDENTITY_PENDING',1,${outcome==='CORREGIDO'?0:1},now(),${outcome},false,now()) ON CONFLICT(entity_type,entity_id,stage) DO UPDATE SET attempt_count=batch_process_state.attempt_count+1,no_progress_count=CASE WHEN ${outcome}='CORREGIDO' THEN 0 ELSE batch_process_state.no_progress_count+1 END,last_attempt_at=now(),last_outcome=${outcome},updated_at=now()`}

export async function obtainIdentityAction(_prev,formData){
  let id='';
  try{
    id=imdb(formData);
    const idempotencyKey=`PROC-ID-001:manual:${id}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({
      processCode:'PROC-ID-001',
      runKind:'individual',
      triggerSource:'calidad_identidad_manual',
      executor:'vercel',
      entityType:'title',
      entityId:id,
      correlationKey:`identity:${id}`,
      idempotencyKey,
      context:{surface:'/calidad/identidad',operation:'obtain_identity'}
    },async trace=>{
      const r=await resolveIdentityUnitary(id,trace);
      return{...r,technicalStatus:'succeeded',functionalResult:r.functionalResult,before:r.before,after:r.after,metrics:{methods:r.methods,duration_ms:r.durationMs},message:r.complete?'Identidad resuelta':'Identidad no encontrada'};
    });
    if(observed.reused){
      refresh(id);
      return{ok:true,status:'duplicate',imdbId:id,runId:observed.runId,message:'Esta solicitud ya se está procesando o acaba de procesarse. No se ha lanzado una segunda ejecución.'};
    }
    const r=observed.result;
    refresh(id);
    if(r?.complete){await recordOutcome(id,'CORREGIDO');return{ok:true,status:'resolved',imdbId:id,runId:observed.runId,message:`Identidad completa · TMDb ${r.tmdbId}`}}
    await recordOutcome(id,'NO_ENCONTRADO');
    return{ok:false,status:'not_found',imdbId:id,runId:observed.runId,message:'TMDb respondió correctamente, pero no encontró una coincidencia. Puedes corregir el ID manualmente.'};
  }catch(e){if(id)await recordOutcome(id,'ERROR').catch(()=>{});return{ok:false,status:'error',runId:e?.runId||null,message:e?.message||'No se pudo obtener la identidad'}}
}

export async function saveIdentityPageAction(_prev,formData){
  try{
    const old=imdb(formData),newId=imdb(formData,'newImdbId'),tmdbId=tmdb(formData),sql=db();
    const[row]=await sql`SELECT type,COALESCE(title_es,title,original_title) display_title FROM movies WHERE imdb_id=${old}`;
    if(!row)throw new Error('Título no encontrado');
    let validationWarning='';
    if(tmdbId){
      try{
        const check=await validateTmdbIdentity(tmdbId,row.type,newId);
        if(!check.ok)return{ok:false,status:'mismatch',message:`El TMDb ${tmdbId} corresponde a ${check.actualImdbId||'otro IMDb'}${check.title?` · ${check.title}${check.year?` (${check.year})`:''}`:''}. No se ha guardado.`};
      }catch(e){validationWarning=' No se pudo contrastar TMDb en ese momento; se guardó tras validar el formato.'}
    }
    const saved=await saveIdentity(old,{imdbId:newId,tmdbId});
    await markIdentityRefreshPending(saved,'manual_identity_edit');
    await recomputeLifecycleForIds([saved]);
    if(tmdbId)await recordOutcome(saved,'CORREGIDO').catch(()=>{});
    refresh(old);refresh(saved);
    return{ok:true,status:'saved',imdbId:saved,message:`Identidad guardada${tmdbId?` · TMDb ${tmdbId}`:''}.${validationWarning}`};
  }catch(e){return{ok:false,status:'error',message:e?.message||'No se pudo guardar la identidad'}}
}

export async function refreshIdentityDataAction(_prev,formData){try{const id=imdb(formData),r=await refreshKnownIdentity(id);refresh(id);return{ok:true,message:`Datos refrescados: ${r?.title||id}`}}catch(e){return{ok:false,message:e?.message||'No se pudieron refrescar los datos'}}}
