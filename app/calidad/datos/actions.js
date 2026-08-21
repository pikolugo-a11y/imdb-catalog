'use server';
import {revalidatePath} from 'next/cache';
import {repairDataQualityTitle,retryDataQualitySource} from '@/lib/data-quality-repair';

function refresh(imdbId){revalidatePath('/calidad/datos');revalidatePath('/calidad');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
function id(formData){const v=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(v))throw new Error('IMDb ID inválido');return v}
export async function repairTitleAction(_prev,formData){try{const imdbId=id(formData),r=await repairDataQualityTitle(imdbId);refresh(imdbId);const delta=Number(r.after?.coverage||0)-Number(r.before?.coverage||0),recovered=(r.results||[]).flatMap(x=>x.changed||[]);return{ok:true,message:`Ficha reparada · cobertura ${r.after?.coverage??'—'}%${delta>0?` (+${delta.toFixed(1)})`:''}${recovered.length?` · ${[...new Set(recovered)].length} campos recuperados`:''}`}}catch(e){return{ok:false,message:e?.message||'No se pudo reparar la ficha'}}}
export async function retrySourceAction(_prev,formData){try{const imdbId=id(formData),source=String(formData.get('source')||''),r=await retryDataQualitySource(imdbId,source);refresh(imdbId);const n=r.changed?.length||0;return{ok:true,message:n?`${source}: ${n} campos recuperados (${r.changed.join(', ')}).`:`${source} fue consultado, pero no pudo completar ningún hueco nuevo.`}}catch(e){return{ok:false,message:e?.message||'No se pudo consultar la fuente'}}}
