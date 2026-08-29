'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {correctIdentityIds} from '@/lib/identity-correction';
import {refreshIdentityEvidence} from '@/lib/identity-validation';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {executeObservedProcess,recordProcessError} from '@/lib/process-runtime';

function refresh(imdbId){revalidatePath('/calidad/validacion-identidad');revalidatePath('/calidad');revalidatePath('/admin');revalidatePath('/catalogo');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
const idFrom=f=>{const id=String(f.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id};

export async function forceIdentityIdsAction(_prev,formData){
  let oldId='';
  try{
    oldId=idFrom(formData);
    const newImdb=String(formData.get('newImdbId')||oldId).trim();
    const rawTmdb=String(formData.get('tmdbId')||'').trim();
    const newTmdb=rawTmdb||null;
    const confirmation=String(formData.get('forceConfirmation')||'').trim();
    if(!/^tt\d+$/.test(newImdb))throw new Error('El nuevo IMDb debe tener formato tt1234567');
    if(!rawTmdb||!/^\d+$/.test(rawTmdb))throw new Error('TMDb debe ser numérico para forzar una asociación');
    if(confirmation!=='FORZAR')throw new Error('Escribe FORZAR para confirmar la asociación manual');

    const requestKey=`PROC-IV-005:manual:${oldId}:${newImdb}:${newTmdb}:${Math.floor(Date.now()/5000)}`;
    const observed=await executeObservedProcess({processCode:'PROC-IV-005',runKind:'individual',triggerSource:'calidad_validacion_identidad_manual',executor:'vercel',entityType:'title',entityId:oldId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/validacion-identidad',operation:'force_identity_ids',manual_override:true}},async trace=>{
      const sql=db();
      const[validationBefore]=await sql`SELECT validation_status,validation_score,validation_details FROM identity_validation WHERE imdb_id=${oldId}`;
      const r=await correctIdentityIds({oldImdbId:oldId,newImdbId:newImdb,tmdbId:newTmdb,trace,forceMismatch:true});
      if(r.blocked)return{...r,technicalStatus:'succeeded',functionalResult:'blocked',before:{...r.before,validation_status:validationBefore?.validation_status||null},after:r.before,metrics:{reason:r.reason},message:'No se pudo verificar suficientemente el TMDb para aplicar el override'};
      if(!r.changed)return{...r,technicalStatus:'succeeded',functionalResult:'no_change',before:r.before,after:r.after,metrics:{changed:false},message:'No había cambios de identidad'};
      if(!r.forced)throw new Error('La asociación ya era compatible; usa Guardar y comprobar en lugar de Forzar');

      const newId=r.savedImdbId;
      await trace.event({eventType:'step_started',step:'invalidate_validation',message:'Invalidando validación anterior tras override manual'});
      if(newId!==oldId)await sql`DELETE FROM identity_validation WHERE imdb_id=${oldId}`;
      await sql`INSERT INTO identity_validation(imdb_id,validation_status,validation_details,created_at,updated_at) VALUES(${newId},'pending_data','{}'::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET validation_status='pending_data',validation_score=NULL,validation_details='{}'::jsonb,suspected_source=NULL,validated_at=NULL,imdb_title=NULL,imdb_original_title=NULL,imdb_year=NULL,imdb_extracted_at=NULL,tmdb_id=NULL,tmdb_title_es=NULL,tmdb_original_title=NULL,tmdb_year=NULL,tmdb_extracted_at=NULL,updated_at=now()`;
      await trace.event({eventType:'step_completed',step:'invalidate_validation',message:'Validación anterior invalidada'});

      let evidence=null,evidenceError=null;
      try{evidence=await refreshIdentityEvidence(newId,trace)}catch(e){evidenceError=e;await recordProcessError(trace.runId,{error:e,step:e?.processStep||'refresh_identity_evidence',source:e?.source||'validation',retryable:Boolean(e?.retryable),detail:{ids_saved:true,manual_override:true}})}

      const override={forced:true,requested_imdb_id:newId,tmdb_id:String(newTmdb),actual_imdb_id:r.verification?.actualImdbId||null,title:r.verification?.title||null,year:r.verification?.year||null,forced_at:new Date().toISOString(),source:'PROC-IV-005'};
      await sql`UPDATE identity_validation SET validation_details=COALESCE(validation_details,'{}'::jsonb)||jsonb_build_object('identity_override',${JSON.stringify(override)}::jsonb),updated_at=now() WHERE imdb_id=${newId}`;
      await trace.event({eventType:'manual_override',step:'persist_override',message:'Override manual de identidad persistido',data:override});

      const lifecycle=await recomputeLifecycleForIds([newId]);
      const next=lifecycle.get(newId)?.label||r.lifecycle;
      return{...r,evidence,evidenceError:Boolean(evidenceError),override,lifecycle:next,technicalStatus:evidenceError?'partial':'succeeded',functionalResult:'updated',before:{...r.before,validation_status:validationBefore?.validation_status||null,validation_score:validationBefore?.validation_score??null},after:{...r.after,validation_status:'pending_data',manual_override:true,evidence_complete:Boolean(evidence?.complete),lifecycle:next},metrics:{manual_override:true,actual_imdb_id:r.verification?.actualImdbId||null,evidence_complete:Boolean(evidence?.complete),evidence_error:Boolean(evidenceError)},message:evidenceError?'Asociación forzada; la nueva evidencia queda pendiente':'Asociación forzada y registrada bajo responsabilidad manual'};
    });

    if(observed.reused){refresh(oldId);return{ok:true,status:'duplicate',runId:observed.runId,message:'Este forzado ya se está procesando o acaba de procesarse.'}}
    const r=observed.result;refresh(oldId);refresh(r.savedImdbId||oldId);
    if(r.blocked)return{ok:false,status:r.reason,runId:observed.runId,message:'No se pudo aplicar el override porque TMDb no devolvió un IMDb verificable.'};
    if(!r.changed)return{ok:true,status:'no_change',runId:observed.runId,message:'No hay cambios que forzar.'};
    return{ok:true,status:'forced',runId:observed.runId,message:r.evidenceError?'Asociación forzada. La evidencia no pudo renovarse ahora y queda pendiente.':'Asociación forzada y registrada. PikoFilm conservará la marca de override manual.'};
  }catch(e){refresh(oldId);return{ok:false,runId:e?.runId||null,message:e?.message||'No se pudo forzar la asociación'}}
}
