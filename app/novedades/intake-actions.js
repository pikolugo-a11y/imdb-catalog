'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {executeObservedProcess} from '@/lib/process-runtime';
import {intakeNewsCandidate,prepareNewsCandidate} from '@/lib/news-intake-v4';

const imdbOf=v=>{const id=String(v||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id};
const safeReturn=(v,f='/novedades')=>{const s=String(v||'');return s.startsWith('/')&&!s.startsWith('//')?s:f};
const refresh=p=>{revalidatePath('/novedades');revalidatePath('/admin');if(p)revalidatePath(p)};

export async function routeToNewsAction(formData){
  const imdbId=imdbOf(formData.get('imdbId')),origin=String(formData.get('origin')||'manual'),returnTo=safeReturn(formData.get('returnTo'));
  const context={personId:formData.get('personId')||null,personName:formData.get('personName')||null,sagaId:formData.get('sagaId')||null,sagaName:formData.get('sagaName')||null,tmdbMovieId:formData.get('tmdbMovieId')||null,plexRatingKey:formData.get('plexRatingKey')||null};
  const key=`PROC-NOV-012:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-NOV-012',runKind:'individual',triggerSource:`novedades_${origin}`,executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:key,idempotencyKey:key,context:{surface:returnTo,operation:'canonical_news_intake',origin}},async trace=>{
    await trace.event({eventType:'step_started',step:'intake',message:`Intake canónico desde ${origin}`});
    const intake=await intakeNewsCandidate({imdbId,origin,title:formData.get('title'),year:formData.get('year'),candidateType:formData.get('candidateType')||'movie',context});
    if(intake.status==='catalogued')return{technicalStatus:'succeeded',functionalResult:'no_change',after:{already_catalogued:true},message:'Ya estaba en catálogo'};
    if(intake.status==='excluded')return{technicalStatus:'succeeded',functionalResult:'blocked',after:{excluded:true},message:'IMDb excluido'};
    if(intake.ready)return{technicalStatus:'succeeded',functionalResult:'updated',after:{ready:true,origins:intake.origins},message:'Candidato listo'};
    const prepared=await prepareNewsCandidate(imdbId,{trace});
    return{technicalStatus:prepared.ready?'succeeded':'partial',functionalResult:prepared.ready?'updated':'pending',after:{ready:prepared.ready,error:prepared.error||null},message:prepared.ready?'Candidato preparado':'Candidato requiere atención'};
  });
  refresh(returnTo);
  if(observed.result?.after?.already_catalogued)redirect(`/catalogo/${imdbId}`);
  if(observed.result?.after?.excluded)redirect(`/catalogo/excluidas?q=${encodeURIComponent(imdbId)}`);
  redirect(`${returnTo}${returnTo.includes('?')?'&':'?'}notice=sent_to_news`);
}

export async function retryNewsPreparationAction(formData){
  const imdbId=imdbOf(formData.get('imdbId')),key=`PROC-NOV-013:${imdbId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-NOV-013',runKind:'individual',triggerSource:'novedades_retry',executor:'vercel',entityType:'title',entityId:imdbId,correlationKey:key,idempotencyKey:key,context:{surface:'/novedades',operation:'canonical_prepare_minimums'}},async trace=>{
    await trace.event({eventType:'step_started',step:'prepare_minimums',message:'Reintentando preparación canónica'});
    const r=await prepareNewsCandidate(imdbId,{trace});
    if(r.status==='missing')return{technicalStatus:'succeeded',functionalResult:'not_found',message:'Candidato no encontrado'};
    return{technicalStatus:r.ready?'succeeded':'partial',functionalResult:r.ready?'updated':'pending',after:{ready:r.ready,error:r.error||null},message:r.ready?'Identidad mínima resuelta':'Sigue requiriendo atención'};
  });
  refresh('/novedades');
  redirect(`/novedades?notice=${observed.result?.after?.ready?'retry_resolved':'retry_failed'}&imdb=${encodeURIComponent(imdbId)}`);
}
