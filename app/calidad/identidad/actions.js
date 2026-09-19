'use server';
import {revalidatePath} from 'next/cache';
import {resolveIdentityUnitary} from '@/lib/identity-unitary';
import {correctIdentityIds} from '@/lib/identity-correction';
import {executeObservedProcess} from '@/lib/process-runtime';
import {markIdentityRefreshPending,refreshKnownIdentity} from '@/lib/identity-refresh';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {relinkCatalogTitleFromPlex} from '@/lib/identity';

function refresh(imdbId){revalidatePath('/calidad/identidad');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId){revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`)}}
function imdb(formData,name='imdbId'){const id=String(formData.get(name)||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function tmdb(formData){const id=String(formData.get('tmdbId')||'').trim();if(id&&!/^\d+$/.test(id))throw new Error('TMDb ID inválido');return id}
function titleType(formData){const value=String(formData.get('newType')||'').trim();if(!['Película','Serie','Miniserie'].includes(value))throw new Error('Tipo de título inválido');return value}

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
    old=imdb(formData);const tmdbOnly=String(formData.get('tmdbOnly')||'')==='1';const newId=tmdbOnly?old:imdb(formData,'newImdbId'),tmdbId=tmdb(formData),newType=titleType(formData);
    const requestKey=`PROC-ID-002:manual:${old}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-ID-002',runKind:'individual',triggerSource:'calidad_identidad_manual',executor:'vercel',entityType:'title',entityId:old,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/identidad',operation:tmdbOnly?'set_tmdb_only':'correct_identity_ids'}},async trace=>{
      const r=await correctIdentityIds({oldImdbId:old,newImdbId:newId,tmdbId,newType,trace,tmdbOnly});
      if(r.blocked)return{...r,technicalStatus:'succeeded',functionalResult:'blocked',before:r.before,after:r.before,metrics:{reason:r.reason,actual_imdb_id:r.verification?.actualImdbId||null},message:r.reason==='mismatch'?'TMDb corresponde a otro IMDb':'TMDb no permitió verificar el IMDb'};
      const savedId=r.savedImdbId||old;
      await trace.event({eventType:'step_started',step:'plex_relink',message:'Buscando coincidencia Plex por identidad canónica'});
      const plex=await relinkCatalogTitleFromPlex(savedId);
      await trace.event({eventType:'step_completed',step:'plex_relink',message:plex.linked?'Plex enlazado por identidad canónica':'No se modificó el enlace Plex',data:{linked:Boolean(plex.linked),rating_key:plex.ratingKey||null,reason:plex.reason||null,matches:plex.matches??null}});
      if(!r.changed){
        if(plex.linked){
          const lifecycle=await recomputeLifecycleForIds([...new Set([...(plex.displaced||[]),savedId])]);
          const next=lifecycle.get(savedId)?.label||r.lifecycle;
          return{...r,plex,lifecycle:next,technicalStatus:'succeeded',functionalResult:'updated',before:r.before,after:{...r.after,lifecycle:next},metrics:{changed:false,plex_linked:true},message:'Identidad sin cambios; Plex enlazado correctamente'};
        }
        return{...r,plex,technicalStatus:'succeeded',functionalResult:'no_change',before:r.before,after:r.after,metrics:{changed:false,plex_linked:false},message:'No había cambios de identidad'};
      }
      await trace.event({eventType:'step_started',step:'identity_refresh_pending',message:'Marcando refresco de identidad pendiente'});
      await markIdentityRefreshPending(savedId,tmdbOnly?'manual_tmdb_only':'manual_identity_edit');
      const lifecycle=await recomputeLifecycleForIds([...new Set([...(plex.displaced||[]),savedId])]);
      const next=lifecycle.get(savedId)?.label||r.lifecycle;
      await trace.event({eventType:'step_completed',step:'identity_refresh_pending',message:'Corrección integrada en la fase de Identidad',data:{next,identity_mode:tmdbOnly?'tmdb_only':'normal'}});
      return{...r,plex,lifecycle:next,technicalStatus:'succeeded',functionalResult:'updated',before:r.before,after:{...r.after,lifecycle:next},metrics:{tmdb_verified:Boolean(tmdbId),imdb_changed:old!==savedId,type_changed:r.before?.type!==r.after?.type,tmdb_only:tmdbOnly,plex_linked:Boolean(plex.linked)},message:tmdbOnly?'Serie configurada como TMDb solo':'Identidad corregida'};
    });
    if(observed.reused){refresh(old);return{ok:true,status:'duplicate',runId:observed.runId,message:'Esta solicitud ya se está procesando o acaba de procesarse. No se ha lanzado una segunda ejecución.'}}
    const r=observed.result;refresh(old);refresh(r.savedImdbId||old);
    if(r.blocked){const check=r.verification||{};return{ok:false,status:r.reason,runId:observed.runId,message:r.reason==='mismatch'?`El TMDb ${tmdbId} corresponde a ${check.actualImdbId||'otro IMDb'}${check.title?` · ${check.title}${check.year?` (${check.year})`:''}`:''}. No se ha guardado.`:'TMDb no devolvió un IMDb verificable. No se ha guardado ningún cambio.'}}
    if(!r.changed&&!r.plex?.linked)return{ok:true,status:'no_change',runId:observed.runId,message:'No hay cambios que guardar.'};
    return{ok:true,status:'saved',imdbId:r.savedImdbId||old,runId:observed.runId,message:r.plex?.linked&&!r.changed?'Identidad sin cambios · Plex enlazado correctamente.':tmdbOnly?`Serie guardada como TMDb solo · TMDb ${tmdbId}${r.plex?.linked?' · Plex enlazado':''}.`:`Identidad guardada · ${r.after?.type||newType}${tmdbId?` · TMDb ${tmdbId}`:''}${r.plex?.linked?' · Plex enlazado':''}.`};
  }catch(e){return{ok:false,status:'error',runId:e?.runId||null,message:e?.message||'No se pudo guardar la identidad'}}
}

export async function refreshIdentityDataAction(_prev,formData){try{const id=imdb(formData),r=await refreshKnownIdentity(id);refresh(id);return{ok:true,message:`Datos refrescados: ${r?.title||id}`}}catch(e){return{ok:false,message:e?.message||'No se pudieron refrescar los datos'}}}
