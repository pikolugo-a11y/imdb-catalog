'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {executeData003Canonical} from '@/lib/data003-canonical.mjs';

function refresh(imdbId){revalidatePath('/calidad/datos');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
function id(formData){const v=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(v))throw new Error('IMDb ID inválido');return v}

export async function calculatePikoScoreV3Action(_prev,formData){
  let imdbId='';
  try{
    imdbId=id(formData);
    const requestKey=`PROC-DATA-003:manual:${imdbId}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-DATA-003',runKind:'individual',triggerSource:'calidad_datos_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/datos',operation:'calculate_pikoscore_v3'}},trace=>executeData003Canonical(db(),imdbId,{trace}));
    if(observed.reused){refresh(imdbId);return{ok:true,status:'duplicate',runId:observed.runId,message:'Esta solicitud ya se está procesando o acaba de procesarse. No se ha lanzado una segunda ejecución.'}}
    const r=observed.result;refresh(imdbId);
    const familyText=(r.contributions||[]).map(x=>`${x.family} ${x.score.toFixed(2)}`).join(' · ');
    return{ok:true,status:r.functionalResult||'updated',runId:observed.runId,message:`PikoScore 3.0 ${r.score.toFixed(2)} · confianza ${r.confidence.toFixed(1)}% · ${r.sourceCount} fuentes · ${r.familyCount} familias${familyText?` · ${familyText}`:''} · mercado ${r.market} · guardado · estado: ${r.lifecycle?.label||r.lifecycle?.state||'actualizado'}.`};
  }catch(error){refresh(imdbId);return{ok:false,runId:error?.runId||null,message:error?.message||'No se pudo calcular PikoScore 3.0'}}
}
