'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';

function imdbIdOf(formData){
  const id=String(formData.get('imdbId')||'').trim();
  if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');
  return id;
}

function refresh(){
  revalidatePath('/novedades');
  revalidatePath('/admin');
}

export async function removeManualCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db(),requestKey=`PROC-NOV-006:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({
    processCode:'PROC-NOV-006',runKind:'individual',triggerSource:'novedades_manual',executor:'vercel',
    entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,
    context:{surface:'/novedades',operation:'remove_manual_candidate'}
  },async trace=>{
    const[candidate]=await sql`
      SELECT imdb_id,eligibility_status,source_snapshot
      FROM catalog_candidates
      WHERE imdb_id=${imdbId}
        AND source_snapshot->>'manual'='true'
        AND COALESCE(source_snapshot->>'manualActive','true')<>'false'
      LIMIT 1`;
    if(!candidate)return{
      technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'missing_active_manual_candidate'},
      message:'La alta manual ya no está activa'
    };
    await trace.event({eventType:'manual_decision',step:'remove_manual_origin',entityType:'title',entityId:imdbId,message:'Retirar únicamente el origen manual'});
    const removedAt=new Date().toISOString();
    await sql`
      UPDATE catalog_candidates
      SET eligibility_status='not_eligible',
          source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({manualActive:false,manualRemovedAt:removedAt})}::jsonb,
          last_evaluated_at=now(),updated_at=now()
      WHERE imdb_id=${imdbId}
        AND source_snapshot->>'manual'='true'
        AND COALESCE(source_snapshot->>'manualActive','true')<>'false'`;
    await trace.event({eventType:'step_completed',step:'remove_manual_origin',entityType:'title',entityId:imdbId,message:'Alta manual retirada sin excluir el IMDb',data:{manualActive:false,eligibility_status:'not_eligible'}});
    return{
      technicalStatus:'succeeded',functionalResult:'updated',
      before:{eligibility_status:candidate.eligibility_status,manualActive:true},
      after:{eligibility_status:'not_eligible',manualActive:false,excluded:false},
      metrics:{removed:1},message:'Alta manual retirada; el IMDb puede volver por otros orígenes'
    };
  });
  refresh();
  if(observed.result?.functionalResult==='blocked')redirect(`/novedades?notice=manual_remove_missing&imdb=${encodeURIComponent(imdbId)}`);
  redirect(`/novedades?notice=manual_removed&imdb=${encodeURIComponent(imdbId)}`);
}
