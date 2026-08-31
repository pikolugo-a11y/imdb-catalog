'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {resolveManualNewsCandidate} from '@/lib/news-manual-resolver';
import {executeObservedProcess} from '@/lib/process-runtime';

function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
const refresh=()=>{revalidatePath('/novedades');revalidatePath('/admin')};

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

    const status=resolved.ready?'eligible':'processing';
    const snap={...resolved.source_snapshot,manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1'};
    await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
      VALUES(${imdbId},${resolved.candidate_type},${resolved.year},${resolved.imdb_rating},${resolved.imdb_votes},${status},now(),now(),${resolved.ready?new Date():null},now(),${JSON.stringify(snap)}::jsonb,now(),now())
      ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=EXCLUDED.candidate_type,year=EXCLUDED.year,imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,eligibility_status=EXCLUDED.eligibility_status,last_seen_at=now(),became_eligible_at=CASE WHEN EXCLUDED.eligibility_status='eligible' THEN COALESCE(catalog_candidates.became_eligible_at,now()) ELSE catalog_candidates.became_eligible_at END,last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,updated_at=now()`;

    if(!resolved.ready){
      const e=new Error(resolved.source_snapshot?.omdbError||'Faltan título o tipo para completar el alta manual');
      await trace.event({eventType:'manual_candidate_pending',step:'persist_candidate',entityType:'title',entityId:imdbId,message:'Candidato manual pendiente de mínimos',data:{minimums:resolved.source_snapshot?.minimums||null}});
      return{technicalStatus:'partial',functionalResult:'pending',after:{eligibility_status:'processing',minimums:resolved.source_snapshot?.minimums||null,error:e.message},metrics:{candidates:1,ready:0,pending:1},message:'Alta manual pendiente de identidad mínima'};
    }

    return{technicalStatus:'succeeded',functionalResult:'updated',after:{eligibility_status:'eligible',title:resolved.source_snapshot?.title,type:resolved.candidate_type,year:resolved.year||null},metrics:{candidates:1,ready:1,pending:0},message:'IMDb añadido manualmente a Novedades'};
  });
  refresh();
  const result=observed.result;
  if(result?.functionalResult==='blocked'&&result?.after?.reason==='already_catalogued')redirect(`/novedades?notice=exists&imdb=${encodeURIComponent(imdbId)}`);
  if(result?.functionalResult==='blocked'&&result?.after?.reason==='excluded')redirect(`/novedades?notice=excluded&imdb=${encodeURIComponent(imdbId)}`);
  if(result?.functionalResult==='pending')redirect(`/novedades?notice=manual_resolve_error&imdb=${encodeURIComponent(imdbId)}`);
  redirect(`/novedades?notice=manual_added&imdb=${encodeURIComponent(imdbId)}`);
}
