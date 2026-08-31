'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {audit} from '@/lib/runlog';

function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function safeReturn(v,fallback='/catalogo/excluidas'){const s=String(v||'');return s.startsWith('/')&&!s.startsWith('//')?s:fallback}
function hasMinimum(candidate){const snap=candidate?.source_snapshot||{};const title=String(snap.title||snap.originalTitle||'').trim();return Boolean(candidate?.candidate_type&&title&&title!==candidate.imdb_id)}
function originOf(candidate){const s=candidate?.source_snapshot||{};if(s.origin)return String(s.origin);if(s.manual===true||s.manual==='true')return 'manual';return 'discovery'}
function refresh(imdbId){revalidatePath('/catalogo/excluidas');revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`);revalidatePath('/novedades');revalidatePath('/sagas');revalidatePath('/calidad');revalidatePath('/admin');revalidatePath('/')}

export async function restoreExclusionAction(formData){
  const imdbId=imdbIdOf(formData),requestedReturn=safeReturn(formData.get('returnTo'));
  const requestKey=`PROC-NOV-016:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({
    processCode:'PROC-NOV-016',runKind:'individual',triggerSource:'catalog_exclusions_manual',executor:'vercel',
    entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,
    context:{surface:'/catalogo/excluidas',operation:'restore_exclusion'}
  },async trace=>{
    const sql=db();
    const[excluded]=await sql`SELECT imdb_id,reason,excluded_at FROM catalog_exclusions WHERE imdb_id=${imdbId} LIMIT 1`;
    if(!excluded)return{technicalStatus:'succeeded',functionalResult:'no_change',after:{reason:'not_excluded'},message:'El IMDb ya no estaba excluido'};
    const[movie]=await sql`SELECT imdb_id,type,title FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
    const[candidate]=movie?[null]:await sql`SELECT imdb_id,candidate_type,eligibility_status,source_snapshot FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
    const destination=movie?'catalog':candidate?'news':'missing';
    await trace.event({eventType:'step_started',step:'restore_exclusion',message:'Retirando bloqueo global de exclusión',data:{destination,previous_reason:excluded.reason||null}});
    if(destination==='missing'){
      return{technicalStatus:'succeeded',functionalResult:'blocked',after:{destination:'missing',reason:'no_catalog_or_candidate'},message:'No existe título ni candidato histórico que restaurar'};
    }
    await sql`DELETE FROM catalog_exclusions WHERE imdb_id=${imdbId}`;
    if(destination==='catalog'){
      await recomputeLifecycleForIds([imdbId]);
      await audit('catalog','title',imdbId,'restore',{destination:'catalog',previous_reason:excluded.reason||null});
      await trace.event({eventType:'step_completed',step:'restore_exclusion',message:'Exclusión retirada; título reactivado en catálogo',data:{destination:'catalog'}});
      return{technicalStatus:'succeeded',functionalResult:'updated',after:{destination:'catalog'},metrics:{restored_catalog:1,restored_news:0,external_calls:0},message:'Título restaurado al catálogo'};
    }
    const minimumOk=hasMinimum(candidate),origin=originOf(candidate),restoredStatus=minimumOk?'eligible':'processing';
    const restorePatch={restoredFromExclusionAt:new Date().toISOString(),restoredFromExclusion:true,previousExclusionReason:excluded.reason||null};
    await sql`UPDATE catalog_candidates SET eligibility_status=${restoredStatus},processed_at=NULL,last_seen_at=now(),last_evaluated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify(restorePatch)}::jsonb,updated_at=now() WHERE imdb_id=${imdbId}`;
    await audit('catalog','candidate',imdbId,'restore',{destination:'news',origin,eligibility_status:restoredStatus,previous_reason:excluded.reason||null});
    await trace.event({eventType:'step_completed',step:'restore_exclusion',message:'Exclusión retirada; candidato histórico reactivado en Novedades',data:{destination:'news',origin,eligibility_status:restoredStatus}});
    return{technicalStatus:'succeeded',functionalResult:'updated',after:{destination:'news',origin,eligibility_status:restoredStatus},metrics:{restored_catalog:0,restored_news:1,external_calls:0},message:'Candidato histórico restaurado a Novedades'};
  });
  refresh(imdbId);
  const result=observed.result;
  if(result?.functionalResult==='blocked')redirect(`/catalogo/excluidas?notice=restore_missing&imdb=${encodeURIComponent(imdbId)}`);
  if(result?.after?.destination==='news')redirect(`/novedades?q=${encodeURIComponent(imdbId)}&notice=restored_from_exclusion`);
  if(result?.after?.destination==='catalog')redirect(requestedReturn.includes('/novedades')?`/catalogo/${imdbId}?notice=restored_from_exclusion`:requestedReturn);
  redirect(requestedReturn);
}
