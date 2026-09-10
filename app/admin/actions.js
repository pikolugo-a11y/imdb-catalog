'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {resetTitleToNews} from '@/lib/title-reset';

const imdb=value=>{const id=String(value||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id};
const clean=(value,max=160)=>String(value||'').trim().slice(0,max);
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
  const errorId=clean(formData.get('errorId'),32);
  if(!/^\d+$/.test(errorId))throw new Error('Incidencia inválida');
  const processCode=clean(formData.get('processCode'),120),step=clean(formData.get('step')),errorKey=clean(formData.get('errorKey')),source=clean(formData.get('source'));
  const grouped=formData.get('grouped')==='1'&&processCode&&errorKey;
  const sql=db();
  const [sample]=await sql`SELECT error_id,run_id,process_code,entity_type,entity_id,resolved_at FROM process_run_errors WHERE error_id=${errorId}::bigint LIMIT 1`;
  if(!sample){revalidatePath('/admin');return}
  const scopeId=grouped?`${processCode}:${step||'-'}:${errorKey}:${source||'-'}`:errorId;
  const key=`PROC-OPS-002:resolve:${scopeId}`.slice(0,240);
  await executeObservedProcess({processCode:'PROC-OPS-002',runKind:'individual',triggerSource:'operations_manual',executor:'vercel',entityType:grouped?'incident_group':sample.entity_type||'incident',entityId:grouped?scopeId:sample.entity_id||errorId,correlationKey:`incident:${scopeId}`.slice(0,240),idempotencyKey:key,context:{surface:'/admin',operation:grouped?'resolve_incident_group':'resolve_incident',sample_error_id:errorId,source_run_id:sample.run_id}},async trace=>{
    let rows;
    if(grouped){rows=await sql`UPDATE process_run_errors e SET resolved_at=now(),resolution='Descartada manualmente desde Operaciones: ya no requiere atención' WHERE e.resolved_at IS NULL AND e.occurred_at>=now()-interval '30 days' AND e.process_code=${processCode} AND COALESCE(e.step,'')=${step} AND COALESCE(e.error_code,e.error_class,'MESSAGE:'||left(e.message,120))=${errorKey} AND COALESCE(e.source,'')=${source} AND NOT EXISTS (SELECT 1 FROM process_runs later WHERE later.process_code=e.process_code AND later.requested_at>e.occurred_at AND later.technical_status='succeeded' AND COALESCE(later.entity_type,'')=COALESCE(e.entity_type,'') AND COALESCE(later.entity_id,'')=COALESCE(e.entity_id,'')) RETURNING e.error_id,e.run_id`}
    else{rows=await sql`UPDATE process_run_errors SET resolved_at=now(),resolution='Descartada manualmente desde Operaciones: ya no requiere atención' WHERE error_id=${errorId}::bigint AND resolved_at IS NULL RETURNING error_id,run_id`}
    await trace.event({eventType:'incident_resolved',step:'operations_resolution',message:grouped?'Grupo de incidencias marcado como resuelto manualmente':'Incidencia marcada como resuelta manualmente',data:{sample_error_id:errorId,count:rows.length,grouped}});
    return{technicalStatus:'succeeded',functionalResult:'no_change',metrics:{incidents_resolved:rows.length},message:grouped?'Grupo de incidencias resuelto manualmente':'Incidencia resuelta manualmente'};
  });
  revalidatePath('/admin');
  revalidatePath(`/admin/runs/${sample.run_id}`);
}
