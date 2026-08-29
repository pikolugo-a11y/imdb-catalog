'use server';
import {revalidatePath} from 'next/cache';
import {updateDataQualityTitle} from '@/lib/data-quality-unitary';
import {refreshRatingsForTitle} from '@/lib/ratings-refresh';
import {calculateAndSavePikoScoreV3ForTitle} from '@/lib/pikoscore-v3';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {saveManualDataField,acceptIncompleteData,saveManualRating,fixRatingsAtFive} from '@/lib/data-quality-manual';
import {executeObservedProcess,recordProcessError} from '@/lib/process-runtime';

function refresh(imdbId){revalidatePath('/calidad/datos');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
function id(formData){const v=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(v))throw new Error('IMDb ID inválido');return v}
export async function updateDataAction(_prev,formData){
  let imdbId='';
  try{
    imdbId=id(formData);
    const requestKey=`PROC-DATA-001:manual:${imdbId}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-DATA-001',runKind:'individual',triggerSource:'calidad_datos_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/datos',operation:'complete_missing_structural_data'}},async trace=>{
      await trace.event({eventType:'step_started',step:'complete_missing_data',message:'Completando únicamente los datos estructurales ausentes'});
      const r=await updateDataQualityTitle(imdbId),results=r.results||[],failed=results.filter(x=>!x.ok),recovered=[...new Set(results.flatMap(x=>x.changed||[]))],missing=r.missing||[];
      for(const item of results){
        if(item.ok)await trace.event({eventType:'source_completed',step:`source_${String(item.source||'unknown').toLowerCase()}`,message:`${item.source} completada`,data:{source:item.source,attempted:item.attempted||[],changed:item.changed||[],remaining:item.remaining||[]}});
        else{
          await trace.event({eventType:'step_warning',step:`source_${String(item.source||'unknown').toLowerCase()}`,message:`${item.source} no pudo completar su intento`,data:{source:item.source,attempted:item.attempted||[],error:item.error||null}});
          await recordProcessError(trace.runId,{error:new Error(item.error||`Error en ${item.source}`),step:`source_${String(item.source||'unknown').toLowerCase()}`,source:String(item.source||'unknown').toLowerCase(),retryable:true,detail:{attempted:item.attempted||[],non_blocking:true}});
        }
      }
      const before={coverage:r.before?.coverage??null,missing:r.before?.missing||[],missing_blocking:r.before?.missingBlocking||[],data_ready:Boolean(r.before?.dataReady),lifecycle:r.before?.lifecycle_state||null};
      const after={coverage:r.after?.coverage??null,missing:r.after?.missing||missing,missing_blocking:r.after?.missingBlocking||[],data_ready:Boolean(r.after?.dataReady),lifecycle:r.lifecycle?.state||r.lifecycle?.label||null};
      const technicalStatus=failed.length?'partial':'succeeded';
      const functionalResult=!after.data_ready?'pending':recovered.length?'updated':'no_change';
      await trace.event({eventType:'step_completed',step:'complete_missing_data',message:after.data_ready?'Datos estructurales obligatorios completos':'Persisten datos estructurales obligatorios ausentes',data:{recovered,missing,failed_sources:failed.map(x=>x.source),data_ready:after.data_ready}});
      return{...r,recovered,failed,technicalStatus,functionalResult,before,after,metrics:{recovered_fields:recovered.length,missing_fields:missing.length,failed_sources:failed.length,data_ready:after.data_ready},message:after.data_ready?(recovered.length?'Datos estructurales completados':'No había datos estructurales obligatorios que completar'):'Quedan datos estructurales obligatorios pendientes'};
    });
    if(observed.reused){refresh(imdbId);return{ok:true,status:'duplicate',runId:observed.runId,message:'Esta solicitud ya se está procesando o acaba de procesarse. No se ha lanzado una segunda ejecución.'}}
    const r=observed.result,lifecycle=r.lifecycle,results=r.results||[],failed=r.failed||results.filter(x=>!x.ok),recovered=r.recovered||[...new Set(results.flatMap(x=>x.changed||[]))],missing=r.missing||[],sources=results.map(x=>`${x.source}${x.ok?'':' ⚠'}`).join(' → ');refresh(imdbId);
    if(!r.after?.dataReady)return{ok:true,status:failed.length?'partial':'pending',runId:observed.runId,message:`Actualización parcial · ${recovered.length} campo(s) recuperados · faltan ${missing.length}: ${missing.slice(0,6).join(', ')}${sources?` · fuentes: ${sources}`:''}${failed.length?` · ${failed.length} fuente(s) con error`:''}`};
    return{ok:true,status:failed.length?'partial':recovered.length?'updated':'no_change',runId:observed.runId,message:`Datos ${recovered.length?'completados':'revisados'} · ${recovered.length} campo(s) actualizados${sources?` · fuentes: ${sources}`:''}${failed.length?` · ${failed.length} fuente(s) con error no bloqueante`:''} · ratings se gestionan aparte · estado: ${lifecycle?.label||lifecycle?.state||'actualizado'}.`};
  }catch(e){refresh(imdbId);return{ok:false,runId:e?.runId||null,message:e?.message||'No se pudieron actualizar los datos'}}
}
export async function refreshRatingsAction(_prev,formData){try{const imdbId=id(formData),r=await refreshRatingsForTitle(imdbId),lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId);refresh(imdbId);if(!r.verified)return{ok:false,message:'MDBList no devolvió ningún rating utilizable para este título.'};const available=(r.ratings||[]).filter(x=>x.status==='available'&&Number(x.normalized_rating)>0);return{ok:true,message:`Ratings actualizados · ${r.saved} fuente(s) guardadas · ${available.length} disponibles · proveedor ${r.provider} · estado: ${lifecycle?.label||lifecycle?.state||'actualizado'}.`}}catch(e){return{ok:false,message:e?.message||'No se pudieron actualizar los ratings'}}}
export async function calculatePikoScoreV3Action(_prev,formData){try{const imdbId=id(formData),r=await calculateAndSavePikoScoreV3ForTitle(imdbId),lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId);refresh(imdbId);const familyText=(r.contributions||[]).map(x=>`${x.family} ${x.score.toFixed(2)}`).join(' · ');return{ok:true,message:`PikoScore 3.0 ${r.score.toFixed(2)} · confianza ${r.confidence.toFixed(1)}% · ${r.sourceCount} fuentes · ${r.familyCount} familias${familyText?` · ${familyText}`:''} · mercado ${r.market} · guardado · estado: ${lifecycle?.label||lifecycle?.state||'actualizado'}.`}}catch(e){return{ok:false,message:e?.message||'No se pudo calcular PikoScore 3.0'}}}

export async function saveManualDataAction(formData){const imdbId=id(formData);await saveManualDataField(imdbId,formData.get('field'),formData.get('value'));await recomputeLifecycleForIds([imdbId]);refresh(imdbId)}
export async function acceptIncompleteDataAction(formData){const imdbId=id(formData);await acceptIncompleteData(imdbId);await recomputeLifecycleForIds([imdbId]);refresh(imdbId)}
export async function saveManualRatingAction(formData){const imdbId=id(formData);await saveManualRating(imdbId,formData.get('source'),formData.get('rating'),formData.get('votes'));await recomputeLifecycleForIds([imdbId]);refresh(imdbId)}
export async function fixRatingsAtFiveAction(formData){const imdbId=id(formData);await fixRatingsAtFive(imdbId);await recomputeLifecycleForIds([imdbId]);refresh(imdbId)}
