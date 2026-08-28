'use server';
import {revalidatePath} from 'next/cache';
import {resolveIdentityUnitary} from '@/lib/identity-unitary';
import {correctIdentityIds} from '@/lib/identity-correction';
import {executeObservedProcess} from '@/lib/process-runtime';
import {markIdentityRefreshPending,refreshKnownIdentity} from '@/lib/identity-refresh';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';

function refresh(imdbId){revalidatePath('/calidad/identidad');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId){revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`)}}
function imdb(formData,name='imdbId'){const id=String(formData.get(name)||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function tmdb(formData){const id=String(formData.get('tmdbId')||'').trim();if(id&&!/^\d+$/.test(id))throw new Error('TMDb ID inválido');return id}

export async function obtainIdentityAction(_prev,formData){
  let id='';
  try{
    id=imdb(formData);
    const idempotencyKey=`PROC-ID-001:manual:${id}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-ID-001',runKind:'individual',triggerSource:'calidad_identidad_manual',executor:'vercel',entityType:'title',entityId:id,correlationKey:`identity:${id}`,idempotencyKey,context:{surface:'/calidad/identidad',operation:'obtain_identity'}},async trace=>{
      const r=await resolveIdentityUnitary(id,trace);
      return{...r,technicalStatus:'succeeded',functionalResult:r.functionalResult,before:r.before,after:r.after,metrics:{methods:r.methods,duration_ms:r.durationMs},message:r.complete?'Identidad resuelta':'Identidad no encontrada'};
    });
    if(observed.reused){refresh(id);return{ok:true,status:'duplicate',imdbId:id,runId:observed.runId,message:'Esta solicitud ya se está procesando o acaba de procesarse. No se ha lanzado una segunda ejecución.'}}
    const r=observed.result;refresh(id);
    if(r?.complete)return{ok:true,status:'resolved',imdbId:id,runId:observed.runId,message:`Identidad completa · TMDb ${r.tmdbId}`};
    return{ok:false,status:'not_found',imdbId:id,runId:observed.runId,message:'TMDb respondió correctamente, pero no encontró una coincidencia. Puedes corregir el ID manualmente.'};
  }catch(e){return{ok:false,status:'error',runId:e?.runId||null,message:e?.message||'No se pudo obtener la identidad'}}
}

export async function saveIdentityPageAction(_prev,formData){
  let old='';
  try{
    old=imdb(formData);const newId=imdb(formData,'newImdbId'),tmdbId=tmdb(formData);
    const requestKey=`PROC-ID-002:manual:${old}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-ID-002',runKind:'individual',triggerSource:'calidad_identidad_manual',executor:'vercel',entityType:'title',entityId:old,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/identidad',operation:'correct_identity_ids'}},async trace=>{
      const r=await correctIdentityIds({oldImdbId:old,newImdbId:newId,tmdbId,trace});
      if(r.blocked)return{...r,technicalStatus:'succeeded',functionalResult:'blocked',before:r.before,after:r.before,metrics:{reason:r.reason,actual_imdb_id:r.verification?.actualImdbId||null},message:r.reason==='mismatch'?'TMDb corresponde a otro IMDb':'TMDb no permitió verificar el IMDb'};
      if(!r.changed)return{...r,technicalStatus:'succeeded',functionalResult:'no_change',before:r.before,after:r.after,metrics:{changed:false},message:'No había cambios de identidad'};
      await trace.event({eventType:'step_started',step:'identity_refresh_pending',message:'Marcando refresco de identidad pendiente'});
      await markIdentityRefreshPending(r.savedImdbId,'manual_identity_edit');
      const lifecycle=await recomputeLifecycleForIds([r.savedImdbId]);
      const next=lifecycle.get(r.savedImdbId)?.label||r.lifecycle;
      await trace.event({eventType:'step_completed',step:'identity_refresh_pending',message:'Corrección integrada en la fase de Identidad',data:{next}});
      return{...r,lifecycle:next,technicalStatus:'succeeded',functionalResult:'updated',before:r.before,after:{...r.after,lifecycle:next},metrics:{tmdb_verified:Boolean(tmdbId),imdb_changed:old!==r.savedImdbId},message:'Identidad corregida'};
    });
    if(observed.reused){refresh(old);return{ok:true,status:'duplicate',runId:observed.runId,message:'Esta solicitud ya se está procesando o acaba de procesarse. No se ha lanzado una segunda ejecución.'}}
    const r=observed.result;refresh(old);refresh(r.savedImdbId||old);
    if(r.blocked){const check=r.verification||{};return{ok:false,status:r.reason,runId:observed.runId,message:r.reason==='mismatch'?`El TMDb ${tmdbId} corresponde a ${check.actualImdbId||'otro IMDb'}${check.title?` · ${check.title}${check.year?` (${check.year})`:''}`:''}. No se ha guardado.`:'TMDb no devolvió un IMDb verificable. No se ha guardado ningún cambio.'}}
    if(!r.changed)return{ok:true,status:'no_change',runId:observed.runId,message:'No hay cambios que guardar.'};
    return{ok:true,status:'saved',imdbId:r.savedImdbId,runId:observed.runId,message:`Identidad guardada${tmdbId?` · TMDb ${tmdbId}`:''}.`};
  }catch(e){return{ok:false,status:'error',runId:e?.runId||null,message:e?.message||'No se pudo guardar la identidad'}}
}

export async function refreshIdentityDataAction(_prev,formData){try{const id=imdb(formData),r=await refreshKnownIdentity(id);refresh(id);return{ok:true,message:`Datos refrescados: ${r?.title||id}`}}catch(e){return{ok:false,message:e?.message||'No se pudieron refrescar los datos'}}}
