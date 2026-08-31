'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {audit} from '@/lib/runlog';

const imdbOf=v=>{const id=String(v||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id};
const safeReturn=v=>{const s=String(v||'');return s.startsWith('/')&&!s.startsWith('//')?s:'/sagas'};

export async function addSagaMemberToNewsAction(formData){
  const imdbId=imdbOf(formData.get('imdbId'));
  const tmdbMovieId=String(formData.get('tmdbMovieId')||'').trim();
  const title=String(formData.get('title')||'').trim().slice(0,300);
  const year=Number(formData.get('year'))||null;
  const returnTo=safeReturn(formData.get('returnTo'));
  if(!title)throw new Error('Título vacío');
  const key=`PROC-NOV-011:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-NOV-011',runKind:'individual',triggerSource:'sagas_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:key,idempotencyKey:key,context:{surface:returnTo,operation:'route_saga_title_to_news',tmdb_movie_id:tmdbMovieId||null}},async trace=>{
    const sql=db();
    const[existing]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
    if(existing)return{technicalStatus:'succeeded',functionalResult:'no_change',after:{already_catalogued:true},message:'El título ya estaba en el catálogo'};
    await trace.event({eventType:'step_started',step:'minimum_admission',message:'Creando candidato mínimo desde Sagas'});
    const snap={origin:'saga',matchedRule:'saga_manual',title,originalTitle:title,tmdbMovieId:tmdbMovieId||null,tmdbEvidence:true,discoveredAt:new Date().toISOString(),discoveryVersion:'novedades-v1'};
    await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,eligibility_status,first_seen_at,became_eligible_at,last_seen_at,last_evaluated_at,source_snapshot,created_at,updated_at) VALUES(${imdbId},'movie',${year},'eligible',now(),now(),now(),now(),${JSON.stringify(snap)}::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET candidate_type='movie',year=COALESCE(catalog_candidates.year,EXCLUDED.year),eligibility_status='eligible',became_eligible_at=COALESCE(catalog_candidates.became_eligible_at,now()),last_seen_at=now(),last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,updated_at=now()`;
    await audit('sagas','candidate',imdbId,'route_to_news',{tmdb_movie_id:tmdbMovieId||null,title,year,direct_eligible:true,no_enrichment:true});
    await trace.event({eventType:'step_completed',step:'minimum_admission',message:'Candidato Saga listo en Novedades',data:{tmdb_movie_id:tmdbMovieId||null,year}});
    return{technicalStatus:'succeeded',functionalResult:'updated',after:{eligible:true,origin:'saga',tmdb_movie_id:tmdbMovieId||null},metrics:{candidates_ready:1,external_calls:0},message:'Candidato de Saga enviado a Novedades'};
  });
  revalidatePath(returnTo);revalidatePath('/novedades');revalidatePath('/admin');
  if(observed.result?.after?.already_catalogued)redirect(`/catalogo/${imdbId}`);
  redirect(`${returnTo}${returnTo.includes('?')?'&':'?'}notice=sent_to_news`);
}
