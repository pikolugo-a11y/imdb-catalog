'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';

function imdbIdOf(formData){const id=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function refresh(id){revalidatePath('/novedades');revalidatePath('/catalogo');revalidatePath(`/catalogo/${id}`);revalidatePath('/calidad');revalidatePath('/calidad/identidad');revalidatePath('/admin');revalidatePath('/')}
function candidateOrigin(candidate){const snap=candidate.source_snapshot||{},isManual=snap.manual===true||snap.manual==='true',isPlex=snap.origin==='plex'||snap.matchedRule==='plex',isSaga=snap.origin==='saga'||snap.matchedRule==='saga_manual';return isPlex?'plex':isManual?'manual':isSaga?'saga':'discovery'}
function movieType(candidateType){return candidateType==='movie'?'Película':candidateType==='tvMiniSeries'?'Miniserie':candidateType==='tvSeries'?'Serie':null}

async function linkPlexCandidate(sql,imdbId,snap){
  const ratingKey=String(snap?.plexRatingKey||'').trim();if(!ratingKey)return null;
  const[media]=await sql`SELECT resolution FROM plex_media WHERE rating_key=${ratingKey} ORDER BY media_index LIMIT 1`;
  await sql`INSERT INTO plex_catalog_status(imdb_id,status,rating_key,resolution,last_confirmed_at,source_updated_at,updated_at) VALUES(${imdbId},'in_plex',${ratingKey},${media?.resolution||null},now(),now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET status='in_plex',rating_key=EXCLUDED.rating_key,resolution=COALESCE(EXCLUDED.resolution,plex_catalog_status.resolution),last_confirmed_at=now(),source_updated_at=now(),updated_at=now()`;
  return ratingKey;
}

export async function admitNewsCandidateAction(formData){
  const imdbId=imdbIdOf(formData),sql=db(),requestKey=`PROC-NOV-007:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-NOV-007',runKind:'individual',triggerSource:'novedades_manual',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/novedades',operation:'admit_candidate_to_catalog'}},async trace=>{
    const[existing]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
    if(existing)return{technicalStatus:'succeeded',functionalResult:'no_change',after:{already_catalogued:true},message:'El IMDb ya estaba en el catálogo'};
    const[candidate]=await sql`SELECT * FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
    if(!candidate)return{technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'missing_candidate'},message:'Candidato no encontrado'};
    if(candidate.eligibility_status!=='eligible')return{technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'not_eligible',eligibility_status:candidate.eligibility_status},message:'El candidato todavía no está listo'};
    const snap=candidate.source_snapshot||{},origin=candidateOrigin(candidate),type=movieType(candidate.candidate_type),title=String(snap.title||snap.originalTitle||'').trim();
    if(!type||!title||title===imdbId)return{technicalStatus:'succeeded',functionalResult:'blocked',after:{reason:'minimum_identity_missing',title:title||null,candidate_type:candidate.candidate_type||null},message:'Faltan título o tipo para admitir el candidato'};
    const inclusionOrigin=origin==='plex'?'plex':origin==='manual'?'imdb_manual':origin==='saga'?'saga':'imdb_discovery';
    const movieOrigin=origin==='plex'?'plex_news':origin==='manual'?'imdb_manual':origin==='saga'?'saga_news':'imdb_discovery';
    const sourceStatus={intake_origin:origin,admission:'minimums_only',...(origin==='saga'&&snap.tmdbMovieId?{tmdb_origin_evidence:String(snap.tmdbMovieId),tmdb_identity_validated:false}:{})};
    await trace.event({eventType:'step_started',step:'admission',entityType:'title',entityId:imdbId,message:'Admitiendo mínimos conocidos en catálogo',data:{origin,title,type,year:candidate.year||null}});
    await sql`INSERT INTO movies(imdb_id,type,title,title_es,year,origin,source_status,synced_at,inclusion_origin) VALUES(${imdbId},${type},${title},${title},${candidate.year||null},${movieOrigin},${JSON.stringify(sourceStatus)}::jsonb,now(),${inclusionOrigin})`;
    const plexRatingKey=origin==='plex'?await linkPlexCandidate(sql,imdbId,snap):null;
    await sql`UPDATE catalog_candidates SET eligibility_status='catalogued',processed_at=now(),updated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({cataloguedAt:new Date().toISOString(),catalogAdmission:'minimums_only'})}::jsonb WHERE imdb_id=${imdbId}`;
    await recomputeLifecycleForIds([imdbId]);
    await trace.event({eventType:'step_completed',step:'admission',entityType:'title',entityId:imdbId,message:'Título admitido; Lifecycle recalculado',data:{origin,plexRatingKey}});
    return{technicalStatus:'succeeded',functionalResult:'updated',after:{catalogued:true,title,type,origin,year:candidate.year||null,plex_rating_key:plexRatingKey},metrics:{admitted:1,external_calls:0},message:'Título admitido al catálogo con identidad mínima'};
  });
  refresh(imdbId);
  const result=observed.result;
  if(result?.after?.already_catalogued)redirect(`/catalogo/${imdbId}`);
  if(result?.functionalResult==='blocked')redirect(`/novedades?notice=admission_error&imdb=${encodeURIComponent(imdbId)}`);
  redirect(`/catalogo/${imdbId}?notice=admitted_from_news`);
}
