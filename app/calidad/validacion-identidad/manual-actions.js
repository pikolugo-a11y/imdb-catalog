'use server';
import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {validateOne} from '@/lib/identity-validation';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {executeObservedProcess} from '@/lib/process-runtime';

function refresh(imdbId){
  revalidatePath('/calidad/validacion-identidad');
  revalidatePath('/calidad');
  revalidatePath('/admin');
  revalidatePath('/catalogo');
  if(imdbId)revalidatePath(`/catalogo/${imdbId}`);
}
const idFrom=f=>{const id=String(f.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id};
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);

async function lifecycleGuard(sql,imdbId,trace){
  const[row]=await sql`SELECT lifecycle_state FROM catalog_lifecycle WHERE imdb_id=${imdbId}`;
  if(!row||!['IDENTITY_VALIDATION','IDENTITY_REVIEW_REQUIRED'].includes(row.lifecycle_state))throw new Error('El título ya no está en esta fase');
  await trace.event({eventType:'step_started',step:'lifecycle_guard',message:'Comprobando fase de Validación de identidad',data:{lifecycle_state:row.lifecycle_state}});
  return row.lifecycle_state;
}

export async function setManualIdentityDecisionAction(_prev,formData){
  let imdbId='';
  try{
    imdbId=idFrom(formData);
    const decision=String(formData.get('decision')||'');
    if(!['valid','doubtful','invalid'].includes(decision))throw new Error('Decisión manual inválida');
    const requestKey=`PROC-IV-004:set:${imdbId}:${decision}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-IV-004',runKind:'individual',triggerSource:'calidad_validacion_identidad_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/validacion-identidad',operation:'set_manual_identity_decision'}},async trace=>{
      const sql=db();
      const lifecycleBefore=await lifecycleGuard(sql,imdbId,trace);
      const[m]=await sql`SELECT m.imdb_id,m.tmdb_id,v.validation_status,v.validation_score,v.validation_details,v.suspected_source,v.validated_at FROM movies m LEFT JOIN identity_validation v USING(imdb_id) WHERE m.imdb_id=${imdbId}`;
      if(!m?.validation_details)throw new Error('La identidad todavía no tiene datos de validación');
      const previousManual=m.validation_details?.manual||null;
      if(previousManual?.status===decision){
        return{technicalStatus:'succeeded',functionalResult:'no_change',before:{validation_status:m.validation_status,validation_score:m.validation_score,manual:previousManual,lifecycle:lifecycleBefore},after:{validation_status:m.validation_status,validation_score:m.validation_score,manual:previousManual,lifecycle:lifecycleBefore},metrics:{decision,already_applied:true},message:'La decisión manual ya estaba aplicada'};
      }
      const automaticSnapshot={status:m.validation_status,score:m.validation_score,imdb_id:String(m.imdb_id),tmdb_id:String(m.tmdb_id||''),suspected_source:m.suspected_source||null,validated_at:m.validated_at||null,validation_version:'2.0.0',link_evidence:m.validation_details?.link_evidence||{}};
      const manual={status:decision,automatic_status:m.validation_status,automatic_score:m.validation_score,imdb_id:String(m.imdb_id),tmdb_id:String(m.tmdb_id||''),reviewed_at:new Date().toISOString(),automatic_snapshot_fingerprint:fingerprint(automaticSnapshot),automatic_snapshot:automaticSnapshot};
      await trace.event({eventType:'step_started',step:'persist_manual_decision',message:'Aplicando decisión manual',data:{decision,automatic_status:m.validation_status,automatic_score:m.validation_score,snapshot_fingerprint:manual.automatic_snapshot_fingerprint}});
      const[r]=await sql`UPDATE identity_validation SET validation_details=COALESCE(validation_details,'{}'::jsonb)||jsonb_build_object('manual',${JSON.stringify(manual)}::jsonb),validation_status=${decision},updated_at=now() WHERE imdb_id=${imdbId} RETURNING imdb_id`;
      if(!r)throw new Error('La identidad todavía no tiene datos de validación');
      const lifecycle=await recomputeLifecycleForIds([imdbId]);
      const next=lifecycle.get(imdbId)?.label||'—';
      await trace.event({eventType:'manual_override',step:'persist_manual_decision',message:'Decisión manual aplicada',data:{decision,lifecycle_before:lifecycleBefore,lifecycle_after:next,snapshot_fingerprint:manual.automatic_snapshot_fingerprint}});
      return{technicalStatus:'succeeded',functionalResult:'updated',before:{validation_status:m.validation_status,validation_score:m.validation_score,manual:previousManual,lifecycle:lifecycleBefore},after:{validation_status:decision,validation_score:m.validation_score,manual:{status:decision,snapshot_fingerprint:manual.automatic_snapshot_fingerprint},lifecycle:next},metrics:{decision,automatic_status:m.validation_status,automatic_score:m.validation_score,snapshot_fingerprint:manual.automatic_snapshot_fingerprint},message:decision==='valid'?`Correcta manualmente. Continúa a ${next}.`:decision==='doubtful'?'Marcada como dudosa manualmente.':'Marcada como ID incorrecto manualmente.'};
    });
    refresh(imdbId);
    if(observed.reused)return{ok:true,status:'duplicate',runId:observed.runId,message:'Esta decisión ya se está procesando o acaba de procesarse.'};
    return{ok:true,status:observed.result.functionalResult,runId:observed.runId,message:observed.result.message};
  }catch(e){refresh(imdbId);return{ok:false,runId:e?.runId||null,message:e?.message||'No se pudo guardar la revisión manual'}}
}

export async function clearManualIdentityDecisionAction(_prev,formData){
  let imdbId='';
  try{
    imdbId=idFrom(formData);
    const requestKey=`PROC-IV-004:clear:${imdbId}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-IV-004',runKind:'individual',triggerSource:'calidad_validacion_identidad_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/validacion-identidad',operation:'clear_manual_identity_decision'}},async trace=>{
      const sql=db();
      const lifecycleBefore=await lifecycleGuard(sql,imdbId,trace);
      const[v]=await sql`SELECT validation_status,validation_score,validation_details,suspected_source FROM identity_validation WHERE imdb_id=${imdbId}`;
      const manual=v?.validation_details?.manual||null;
      if(!manual){
        return{technicalStatus:'succeeded',functionalResult:'no_change',before:{validation_status:v?.validation_status||null,validation_score:v?.validation_score??null,manual:null,lifecycle:lifecycleBefore},after:{validation_status:v?.validation_status||null,validation_score:v?.validation_score??null,manual:null,lifecycle:lifecycleBefore},metrics:{manual_present:false},message:'No había ninguna decisión manual vigente que quitar'};
      }
      await trace.event({eventType:'step_started',step:'clear_manual_override',message:'Retirando decisión manual',data:{manual_status:manual.status||null,snapshot_fingerprint:manual.automatic_snapshot_fingerprint||null}});
      await sql`UPDATE identity_validation SET validation_details=COALESCE(validation_details,'{}'::jsonb)-'manual',updated_at=now() WHERE imdb_id=${imdbId}`;
      await trace.event({eventType:'step_completed',step:'clear_manual_override',message:'Override manual retirado; recalculando resultado automático vigente'});
      const automatic=await validateOne(imdbId,trace);
      const lifecycle=await recomputeLifecycleForIds([imdbId]);
      const next=lifecycle.get(imdbId)?.label||'—';
      await trace.event({eventType:'step_completed',step:'recompute_lifecycle',message:'Resultado automático vigente restaurado mediante revalidación',data:{automatic_status:automatic.automaticStatus||automatic.status,score:automatic.score??null,lifecycle_before:lifecycleBefore,lifecycle_after:next}});
      const functionalResult=automatic.status==='valid'?'updated':automatic.status==='insufficient'?'pending':'blocked';
      return{technicalStatus:'succeeded',functionalResult,before:{validation_status:v?.validation_status||null,validation_score:v?.validation_score??null,manual:{status:manual.status||null,snapshot_fingerprint:manual.automatic_snapshot_fingerprint||null},lifecycle:lifecycleBefore},after:{validation_status:automatic.status,automatic_status:automatic.automaticStatus||automatic.status,validation_score:automatic.score??null,manual:null,lifecycle:next},metrics:{manual_removed:true,previous_manual_status:manual.status||null,automatic_status:automatic.automaticStatus||automatic.status,score:automatic.score??null,snapshot_fingerprint:manual.automatic_snapshot_fingerprint||null},message:`Decisión manual eliminada. Resultado automático recalculado: ${automatic.status}${automatic.score!=null?` (${automatic.score}/100)`:''}.`};
    });
    refresh(imdbId);
    if(observed.reused)return{ok:true,status:'duplicate',runId:observed.runId,message:'Esta reversión ya se está procesando o acaba de procesarse.'};
    return{ok:true,status:observed.result.functionalResult,runId:observed.runId,message:observed.result.message};
  }catch(e){refresh(imdbId);return{ok:false,runId:e?.runId||null,message:e?.message||'No se pudo quitar la decisión manual'}}
}
