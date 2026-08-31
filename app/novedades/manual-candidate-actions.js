'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {resolveManualNewsCandidate} from '@/lib/news-manual-resolver';
import {executeObservedProcess} from '@/lib/process-runtime';

function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
const refresh=()=>{revalidatePath('/novedades');revalidatePath('/admin')};

async function persistResolved(sql,imdbId,resolved){
  const status=resolved.ready?'eligible':'processing';
  const snap={...resolved.source_snapshot,manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1'};
  await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
    VALUES(${imdbId},${resolved.candidate_type},${resolved.year},${resolved.imdb_rating},${resolved.imdb_votes},${status},now(),now(),${resolved.ready?new Date():null},now(),${JSON.stringify(snap)}::jsonb,now(),now())
    ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=EXCLUDED.candidate_type,year=EXCLUDED.year,imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,eligibility_status=EXCLUDED.eligibility_status,last_seen_at=now(),became_eligible_at=CASE WHEN EXCLUDED.eligibility_status='eligible' THEN COALESCE(catalog_candidates.became_eligible_at,now()) ELSE catalog_candidates.became_eligible_at END,last_evaluated_at=now(),source_snapshot=(COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)-'authoritativeStatus'-'authoritativeRequestedAt'-'authoritativeAttempts'-'manualAuthoritativeError'-'manualAuthoritativeFailedAt'-'manualAuthoritativeResolvedAt')||EXCLUDED.source_snapshot,updated_at=now()`;
  return status;
}

export async function addManualCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db(),requestKey=`PROC-NOV-002:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-NOV-002',runKind:'individual',triggerSource:'novedades_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/novedades',operation:'manual_imdb_intake'}},async trace=>{
    const[movie]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
    if(movie)return{technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'already_catalogued'},message:'El IMDb ya está en el catálogo'};
    const[excluded]=await sql`SELECT imdb_id FROM catalog_exclusions WHERE imdb_id=${imdbId} LIMIT 1`;
    if(excluded)return{technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'excluded'},message:'El IMDb está excluido'};
    await trace.event({eventType:'step_started',step:'resolve_minimums',entityType:'title',entityId:imdbId,message:'Resolviendo identidad mínima para alta manual'});
    const resolved=await resolveManualNewsCandidate(imdbId,{trace});
    await trace.event({eventType:'step_completed',step:'resolve_minimums',entityType:'title',entityId:imdbId,message:resolved.ready?'Identidad mínima resuelta':'No se pudo completar identidad mínima',data:{ready:resolved.ready,title:resolved.source_snapshot?.title||null,type:resolved.candidate_type||null,year:resolved.year||null}});
    const status=await persistResolved(sql,imdbId,resolved);
    if(!resolved.ready){
      const error=resolved.source_snapshot?.omdbError||'Faltan título o tipo para completar el alta manual';
      await trace.event({eventType:'manual_candidate_pending',step:'persist_candidate',entityType:'title',entityId:imdbId,message:'Candidato manual pendiente de mínimos',data:{minimums:resolved.source_snapshot?.minimums||null}});
      return{technicalStatus:'partial',functionalResult:'pending',after:{eligibility_status:status,minimums:resolved.source_snapshot?.minimums||null,error},metrics:{candidates:1,ready:0,pending:1},message:'Alta manual pendiente de identidad mínima'};
    }
    return{technicalStatus:'succeeded',functionalResult:'updated',after:{eligibility_status:status,title:resolved.source_snapshot?.title,type:resolved.candidate_type,year:resolved.year||null},metrics:{candidates:1,ready:1,pending:0},message:'IMDb añadido manualmente a Novedades'};
  });
  refresh();
  const result=observed.result;
  if(result?.functionalResult==='blocked'&&result?.after?.reason==='already_catalogued')redirect(`/novedades?notice=exists&imdb=${encodeURIComponent(imdbId)}`);
  if(result?.functionalResult==='blocked'&&result?.after?.reason==='excluded')redirect(`/novedades?notice=excluded&imdb=${encodeURIComponent(imdbId)}`);
  if(result?.functionalResult==='pending')redirect(`/novedades?notice=manual_resolve_error&imdb=${encodeURIComponent(imdbId)}`);
  redirect(`/novedades?notice=manual_added&imdb=${encodeURIComponent(imdbId)}`);
}

export async function retryManualCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db(),requestKey=`PROC-NOV-003:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-NOV-003',runKind:'individual',triggerSource:'novedades_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/novedades',operation:'retry_manual_minimums'}},async trace=>{
    const[candidate]=await sql`SELECT imdb_id,eligibility_status,source_snapshot FROM catalog_candidates WHERE imdb_id=${imdbId} AND source_snapshot->>'manual'='true' AND COALESCE(source_snapshot->>'manualActive','true')<>'false' LIMIT 1`;
    if(!candidate)return{technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'missing_manual_candidate'},message:'El candidato manual ya no está disponible'};
    await trace.event({eventType:'step_started',step:'resolve_minimums',entityType:'title',entityId:imdbId,message:'Reintentando identidad mínima del candidato manual'});
    const resolved=await resolveManualNewsCandidate(imdbId,{trace});
    await trace.event({eventType:'step_completed',step:'resolve_minimums',entityType:'title',entityId:imdbId,message:resolved.ready?'Reintento completó identidad mínima':'Reintento sigue sin completar identidad mínima',data:{ready:resolved.ready,title:resolved.source_snapshot?.title||null,type:resolved.candidate_type||null,year:resolved.year||null}});
    const status=await persistResolved(sql,imdbId,resolved);
    if(!resolved.ready)return{technicalStatus:'partial',functionalResult:'pending',before:{eligibility_status:candidate.eligibility_status},after:{eligibility_status:status,minimums:resolved.source_snapshot?.minimums||null},metrics:{retries:1,ready:0,pending:1},message:'El candidato sigue pendiente de identidad mínima'};
    return{technicalStatus:'succeeded',functionalResult:'updated',before:{eligibility_status:candidate.eligibility_status},after:{eligibility_status:status,title:resolved.source_snapshot?.title,type:resolved.candidate_type,year:resolved.year||null},metrics:{retries:1,ready:1,pending:0},message:'Candidato manual recuperado'};
  });
  refresh();
  const result=observed.result;
  if(result?.functionalResult==='blocked')redirect('/novedades?notice=retry_missing');
  if(result?.functionalResult==='pending')redirect(`/novedades?notice=retry_failed&imdb=${encodeURIComponent(imdbId)}`);
  redirect(`/novedades?notice=retry_resolved&imdb=${encodeURIComponent(imdbId)}`);
}
