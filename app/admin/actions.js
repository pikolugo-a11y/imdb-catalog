'use server';
import {revalidatePath} from 'next/cache';
import {executeObservedProcess} from '@/lib/process-runtime';
import {resetTitleToNews} from '@/lib/title-reset';

const imdb=value=>{const id=String(value||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id};
const refresh=id=>{revalidatePath('/admin');revalidatePath('/novedades');revalidatePath('/catalogo');revalidatePath('/calidad');revalidatePath('/calidad/identidad');revalidatePath('/calidad/validacion-identidad');revalidatePath('/calidad/datos');revalidatePath(`/catalogo/${id}`)};

export async function resetTitleToNewsAction(_prev,formData){
  let id='';
  try{
    id=imdb(formData.get('imdbId'));
    const confirm=String(formData.get('confirmImdb')||'').trim();
    if(confirm!==id)throw new Error('Escribe el mismo IMDb ID para confirmar el reinicio');
    const key=`PROC-OPS-001:manual:${id}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-OPS-001',runKind:'individual',triggerSource:'operations_manual',executor:'vercel',entityType:'title',entityId:id,correlationKey:`reset:${id}`,idempotencyKey:key,context:{surface:'/admin',operation:'reset_title_to_news'}},async trace=>{
      const r=await resetTitleToNews(id,trace);
      return{...r,technicalStatus:'succeeded',functionalResult:'updated',before:r.before,after:r.after,metrics:{tables_cleared:r.tablesCleared.length},message:'Título reiniciado desde Novedades'};
    });
    refresh(id);
    if(observed.reused)return{ok:true,status:'duplicate',runId:observed.runId,message:'El reinicio ya se está ejecutando o acaba de ejecutarse.'};
    return{ok:true,status:'reset',runId:observed.runId,imdbId:id,message:'Título devuelto a Novedades. Ya puedes recorrer de nuevo el circuito completo.'};
  }catch(e){refresh(id);return{ok:false,runId:e?.runId||null,message:e?.message||'No se pudo reiniciar el título'}}
}
