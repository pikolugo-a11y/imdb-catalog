'use server';
import {revalidatePath} from 'next/cache';
import {updateDataQualityTitle} from '@/lib/data-quality-unitary';
import {finalizeRatingsRefresh,calculatePikoScoreForTitle} from '@/lib/pikoscore';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';

function refresh(imdbId){revalidatePath('/calidad/datos');revalidatePath('/calidad');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
function id(formData){const v=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(v))throw new Error('IMDb ID inválido');return v}
export async function updateDataAction(_prev,formData){try{const imdbId=id(formData),r=await updateDataQualityTitle(imdbId);const ratingsReady=await finalizeRatingsRefresh(imdbId);const lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId);refresh(imdbId);const failed=(r.results||[]).filter(x=>!x.ok),recovered=[...new Set((r.results||[]).flatMap(x=>x.changed||[]))],missing=r.after?.missingCritical||[];if(missing.length)return{ok:true,message:`Actualización parcial · cobertura ${r.after?.coverage??'—'}% · faltan ${missing.length}: ${missing.slice(0,5).join(', ')}${failed.length?` · ${failed.length} fuente(s) con error`:''}`};return{ok:true,message:`Datos obligatorios completos · ${recovered.length} campos actualizados${ratingsReady?' · notas listas para PikoScore':''} · estado: ${lifecycle?.label||lifecycle?.state||'actualizado'}.`}}catch(e){return{ok:false,message:e?.message||'No se pudieron actualizar los datos'}}}
export async function calculatePikoScoreAction(_prev,formData){try{const imdbId=id(formData),r=await calculatePikoScoreForTitle(imdbId),lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId);refresh(imdbId);return{ok:true,message:`PikoScore ${r.score.toFixed(2)} · confianza ${r.confidence.toFixed(1)}% · versión 2.0.0 · siguiente estado: ${lifecycle?.label||lifecycle?.state||'actualizado'}.`}}catch(e){return{ok:false,message:e?.message||'No se pudo calcular PikoScore'}}
