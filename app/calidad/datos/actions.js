'use server';
import {revalidatePath} from 'next/cache';
import {updateDataQualityTitle} from '@/lib/data-quality-unitary';

function refresh(imdbId){revalidatePath('/calidad/datos');revalidatePath('/calidad');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
function id(formData){const v=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(v))throw new Error('IMDb ID inválido');return v}
export async function updateDataAction(_prev,formData){try{const imdbId=id(formData),r=await updateDataQualityTitle(imdbId);refresh(imdbId);const failed=(r.results||[]).filter(x=>!x.ok),recovered=[...new Set((r.results||[]).flatMap(x=>x.changed||[]))],missing=r.after?.missingCritical||[];if(missing.length)return{ok:true,message:`Actualización parcial · cobertura ${r.after?.coverage??'—'}% · faltan ${missing.length}: ${missing.slice(0,5).join(', ')}${failed.length?` · ${failed.length} fuente(s) con error`:''}`};return{ok:true,message:`Datos obligatorios completos · ${recovered.length} campos actualizados${r.ratingsInvalidated?' · PikoScore pendiente de recalcular':''}.`}}catch(e){return{ok:false,message:e?.message||'No se pudieron actualizar los datos'}}}
