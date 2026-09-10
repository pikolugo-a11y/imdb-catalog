'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {resetTitleToNews} from '@/lib/title-reset';

const imdb=value=>{const id=String(value||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id};
const refresh=id=>{revalidatePath('/admin');revalidatePath('/novedades');revalidatePath('/catalogo');revalidatePath('/calidad');revalidatePath('/calidad/identidad');revalidatePath('/calidad/validacion-identidad');revalidatePath('/calidad/datos');if(id)revalidatePath(`/catalogo/${id}`)};

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

export async function resolveIncidentAction(formData){
  const errorId=String(formData.get('errorId')||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(errorId))throw new Error('Incidencia inválida');
  const sql=db();
  const [error]=await sql`SELECT error_id,run_id,process_code,entity_type,entity_id,resolved_at FROM process_run_errors WHERE error_id=${errorId}::uuid LIMIT 1`;
  if(!error||error.resolved_at){revalidatePath('/admin');return}
  const key=`PROC-OPS-002:resolve:${errorId}`;
  await executeObservedProcess({processCode:'PROC-OPS-002',runKind:'individual',triggerSource:'operations_manual',executor:'vercel',entityType:error.entity_type||'incident',entityId:error.entity_id||errorId,correlationKey:`incident:${errorId}`,idempotencyKey:key,context:{surface:'/admin',operation:'resolve_incident',error_id:errorId,source_run_id:error.run_id}},async trace=>{
    await sql`UPDATE process_run_errors SET resolved_at=now(),resolution='Descartada manualmente desde Operaciones: ya no requiere atención' WHERE error_id=${errorId}::uuid AND resolved_at IS NULL`;
    await trace.event({eventType:'incident_resolved',step:'operations_resolution',message:'Incidencia marcada como resuelta manualmente',data:{error_id:errorId,source_run_id:error.run_id}});
    return{technicalStatus:'succeeded',functionalResult:'no_change',metrics:{incidents_resolved:1},message:'Incidencia resuelta manualmente'};
  });
  revalidatePath('/admin');
  revalidatePath(`/admin/runs/${error.run_id}`);
}
