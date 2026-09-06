'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {audit} from '@/lib/runlog';

function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function safeReturn(v,fallback='/catalogo/excluidas'){const s=String(v||'');return s.startsWith('/')&&!s.startsWith('//')?s:fallback}
function withNotice(path,notice,imdbId){const u=new URL(path,'https://pikofilm.local');u.searchParams.set('notice',notice);u.searchParams.set('imdb',imdbId);return `${u.pathname}?${u.searchParams.toString()}`}
function hasMinimum(candidate){const snap=candidate?.source_snapshot||{};const title=String(snap.title||snap.originalTitle||'').trim();return Boolean(candidate?.candidate_type&&title&&title!==candidate.imdb_id)}
function refresh(imdbId){revalidatePath('/catalogo/excluidas');revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`);revalidatePath('/novedades');revalidatePath('/sagas');revalidatePath('/calidad');revalidatePath('/admin');revalidatePath('/')}
function candidateType(type){return type==='Película'?'movie':type==='Miniserie'?'tvMiniSeries':type==='Serie'?'tvSeries':null}

export async function restoreExclusionAction(formData){
  const imdbId=imdbIdOf(formData),requestedReturn=safeReturn(formData.get('returnTo'));
  const requestKey=`PROC-NOV-016:${imdbId}:${Math.floor(Date.now()/3000)}`;
  try{
    const observed=await executeObservedProcess({processCode:'PROC-NOV-016',runKind:'individual',triggerSource:'catalog_exclusions_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/catalogo/excluidas',operation:'restore_exclusion_to_news'}},async trace=>{
      const sql=db();
      const[excluded]=await sql`SELECT imdb_id,reason,excluded_at FROM catalog_exclusions WHERE imdb_id=${imdbId} LIMIT 1`;
      if(!excluded)return{technicalStatus:'succeeded',functionalResult:'no_change',after:{reason:'not_excluded'},message:'El IMDb ya no estaba excluido'};
      const[movie]=await sql`SELECT imdb_id,type,title,title_es,original_title,year FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
      const[existingCandidate]=await sql`SELECT imdb_id,candidate_type,year,eligibility_status,source_snapshot FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
      if(!movie&&!existingCandidate)return{technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'no_catalog_or_candidate'},message:'No existe información suficiente para restaurar el candidato'};
      const now=new Date().toISOString(),baseSnap=existingCandidate?.source_snapshot||{},title=String(movie?.title_es||movie?.title||movie?.original_title||baseSnap.title||baseSnap.originalTitle||'').trim(),type=existingCandidate?.candidate_type||candidateType(movie?.type),year=existingCandidate?.year??movie?.year??null;
      const candidate={imdb_id:imdbId,candidate_type:type,source_snapshot:{...baseSnap,title:title||baseSnap.title||imdbId,originalTitle:movie?.original_title||baseSnap.originalTitle||title||imdbId,origin:'restored_exclusion'}};
      const minimumOk=hasMinimum(candidate),status=minimumOk?'eligible':'processing';
      const patch={restoredFromExclusion:true,restoredFromExclusionAt:now,pendingCatalogAdmission:true,previousExclusionReason:excluded.reason||null,origin:'restored_exclusion',title:candidate.source_snapshot.title,originalTitle:candidate.source_snapshot.originalTitle};
      await trace.event({eventType:'step_started',step:'route_to_news',message:'Preparando restauración como candidato pendiente de admisión',data:{had_catalog_row:Boolean(movie),eligibility_status:status}});
      await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,eligibility_status,first_seen_at,last_seen_at,last_evaluated_at,source_snapshot,created_at,updated_at) VALUES(${imdbId},${type},${year},${status},now(),now(),now(),${JSON.stringify({...candidate.source_snapshot,...patch})}::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=COALESCE(EXCLUDED.candidate_type,catalog_candidates.candidate_type),year=COALESCE(EXCLUDED.year,catalog_candidates.year),eligibility_status=EXCLUDED.eligibility_status,processed_at=NULL,last_seen_at=now(),last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,updated_at=now()`;
      // La exclusión física se conserva como bloqueo hasta la decisión explícita de admisión en Novedades.
      // Excluidas V4 oculta los candidatos con restoredFromExclusion=true para que la decisión no aparezca en dos colas.
      await audit('catalog','candidate',imdbId,'restore_to_news',{eligibility_status:status,previous_reason:excluded.reason||null,kept_exclusion_guard:true});
      await trace.event({eventType:'step_completed',step:'route_to_news',message:'Candidato enviado a Novedades; admisión pendiente de decisión humana',data:{eligibility_status:status,kept_exclusion_guard:true}});
      return{technicalStatus:'succeeded',functionalResult:'updated',after:{destination:'news',eligibility_status:status},metrics:{restored_news:1,external_calls:0},message:'Restauración preparada en Novedades'};
    });
    refresh(imdbId);
    if(observed.result?.functionalResult==='blocked')redirect(withNotice(requestedReturn,'restore_error',imdbId));
    redirect(withNotice(requestedReturn,'restored',imdbId));
  }catch(error){
    // next/navigation redirect lanza internamente; no convertirlo en un falso error funcional.
    if(error?.digest?.startsWith?.('NEXT_REDIRECT'))throw error;
    refresh(imdbId);redirect(withNotice(requestedReturn,'restore_error',imdbId));
  }
}
