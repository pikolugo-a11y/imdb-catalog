'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';

function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
const refresh=()=>{revalidatePath('/novedades');revalidatePath('/catalogo/excluidas');revalidatePath('/catalogo');revalidatePath('/calidad');revalidatePath('/admin')};

export async function excludeNewsCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db(),requestKey=`PROC-NOV-005:${imdbId}:${Math.floor(Date.now()/3000)}`;
  await executeObservedProcess({processCode:'PROC-NOV-005',runKind:'individual',triggerSource:'novedades_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/novedades',operation:'exclude_news_candidate'}},async trace=>{
    const[candidate]=await sql`SELECT imdb_id,eligibility_status,source_snapshot FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
    const[before]=await sql`SELECT reason,excluded_at,excluded_by FROM catalog_exclusions WHERE imdb_id=${imdbId} LIMIT 1`;
    await trace.event({eventType:'manual_decision',step:'exclude_candidate',entityType:'title',entityId:imdbId,message:'Excluir IMDb globalmente desde Novedades',data:{candidate_status:candidate?.eligibility_status||null,already_excluded:Boolean(before)}});
    await sql`INSERT INTO catalog_exclusions(imdb_id,reason,excluded_at,excluded_by) VALUES(${imdbId},'Excluida desde Novedades',now(),'pikofilm-ui') ON CONFLICT(imdb_id) DO UPDATE SET reason='Excluida desde Novedades',excluded_at=now(),excluded_by='pikofilm-ui'`;
    return{technicalStatus:'succeeded',functionalResult:before?'no_change':'updated',before:before||{excluded:false},after:{excluded:true,reason:'Excluida desde Novedades',excluded_by:'pikofilm-ui'},metrics:{exclusions:before?0:1},message:before?'El IMDb ya estaba excluido; exclusión renovada':'IMDb excluido globalmente'};
  });
  refresh();
  redirect('/novedades?notice=excluded_now');
}
