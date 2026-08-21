'use server';
import {revalidatePath} from 'next/cache';
import {repairDataQualityField,repairDataQualityTitle} from '@/lib/data-quality-repair';

function refresh(imdbId){revalidatePath('/calidad/datos');revalidatePath('/calidad');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
function id(formData){const v=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(v))throw new Error('IMDb ID inválido');return v}
export async function repairTitleAction(_prev,formData){try{const imdbId=id(formData),r=await repairDataQualityTitle(imdbId);refresh(imdbId);const delta=Number(r.after?.coverage||0)-Number(r.before?.coverage||0);return{ok:true,message:`Ficha reparada · cobertura ${r.after?.coverage??'—'}%${delta>0?` (+${delta.toFixed(1)})`:''}${r.omdbChanged?.length?` · OMDb: ${r.omdbChanged.join(', ')}`:''}`}}catch(e){return{ok:false,message:e?.message||'No se pudo reparar la ficha'}}}
export async function repairFieldAction(_prev,formData){try{const imdbId=id(formData),field=String(formData.get('field')||''),r=await repairDataQualityField(imdbId,field);refresh(imdbId);return{ok:true,message:r.after?.missing?.includes(field)?'La fuente sigue sin aportar este dato.':'Dato recuperado correctamente.'}}catch(e){return{ok:false,message:e?.message||'No se pudo recuperar el dato'}}}
