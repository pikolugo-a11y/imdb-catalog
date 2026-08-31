'use server';
import {revalidatePath} from 'next/cache';
import {syncPlexFast} from '@/lib/plex-sync';
import {seedPlexNewsCandidates} from '@/lib/plex-news-seed';
import {captureDashboardSnapshot} from '@/lib/dashboard-v2';
import {executeObservedProcess,recordProcessError} from '@/lib/process-runtime';

function refresh(){revalidatePath('/');revalidatePath('/novedades');revalidatePath('/catalogo');revalidatePath('/plex');revalidatePath('/calidad');revalidatePath('/admin')}

export async function syncPlexFromNews(_prevState,formData){
  const raw=String(formData?.get('reviewFrom')||'').trim();
  const reviewFrom=raw?`${raw}T00:00:00.000Z`:undefined;
  const requestKey=`PROC-NOV-008:${reviewFrom||'last-success'}:${Math.floor(Date.now()/3000)}`;
  try{
    const observed=await executeObservedProcess({processCode:'PROC-NOV-008',runKind:'system',triggerSource:'novedades_manual',executor:'vercel',entityType:'series_library',entityId:'plex',correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/novedades',operation:'sync_plex_and_seed_news',review_from:reviewFrom||'last_success'}},async trace=>{
      await trace.event({eventType:'step_started',step:'plex_sync',message:'Sincronizando biblioteca Plex'});
      const r=await syncPlexFast({reviewFrom});
      await trace.event({eventType:'step_completed',step:'plex_sync',message:'Biblioteca Plex sincronizada',data:{total:r.total,new:r.new,changed:r.changed,missing:r.missing,identity_review:r.identityReview||null}});

      await trace.event({eventType:'step_started',step:'seed_news',message:'Sembrando candidatos Plex en Novedades'});
      let news,seedError=null;
      try{
        news=await seedPlexNewsCandidates();
        await trace.event({eventType:'step_completed',step:'seed_news',message:'Siembra Plex completada',data:news});
      }catch(error){
        seedError=error;
        news={seeded:0,resolved:0,failed:1,pending:0};
        await recordProcessError(trace.runId,{error,step:'seed_news',source:'vercel',retryable:true,detail:{plex_sync_completed:true}});
      }

      await captureDashboardSnapshot().catch(()=>{});
      const metrics={plex_total:r.total,plex_new:r.new,plex_changed:r.changed,plex_missing:r.missing,identity_reviewed:r.identityReview?.reviewed||0,imdb_changes:r.identityReview?.imdb_changed||0,candidates_seeded:news.seeded||0,candidates_ready:news.resolved||0,candidates_pending:news.pending||0,seed_failures:news.failed||0};
      return{technicalStatus:seedError?'partial':'succeeded',functionalResult:(r.new||r.changed||r.missing||news.seeded||news.resolved)?'updated':'no_change',metrics,after:{review_from:r.identityReview?.review_from||reviewFrom||null,identity_review_complete:true,plex:{total:r.total,new:r.new,changed:r.changed,missing:r.missing},news},message:seedError?'Plex sincronizado; siembra de Novedades con incidencia':'Plex sincronizado y candidatos de Novedades sembrados'};
    });
    refresh();
    const m=observed.result?.metrics||{};
    const review=observed.result?.after?.review_from;
    const partial=observed.result?.technicalStatus==='partial';
    return{ok:!partial,message:`Plex actualizado · ${(m.plex_total||0).toLocaleString('es-ES')} títulos · ${(m.identity_reviewed||0).toLocaleString('es-ES')} identidades revisadas${review?` desde ${new Date(review).toLocaleDateString('es-ES')}`:''} · ${m.imdb_changes||0} cambios IMDb · ${m.plex_new||0} altas · ${m.plex_missing||0} bajas · ${m.candidates_seeded||0} candidatos Plex${partial?' · siembra con incidencia':''}`};
  }catch(e){refresh();return{ok:false,message:e?.message||'No se pudo actualizar Plex'}}
}
