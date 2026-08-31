'use server';
import {revalidatePath} from 'next/cache';
import {syncPlexFast} from '@/lib/plex-sync';
import {seedPlexNewsCandidates} from '@/lib/plex-news-seed';
import {captureDashboardSnapshot} from '@/lib/dashboard-v2';
import {executeObservedProcess,recordProcessError} from '@/lib/process-runtime';
import {db} from '@/lib/db';

function refresh(){revalidatePath('/');revalidatePath('/novedades');revalidatePath('/catalogo');revalidatePath('/plex');revalidatePath('/calidad');revalidatePath('/admin')}

export async function syncPlexFromNews(_prevState,formData){
  const raw=String(formData?.get('reviewFrom')||'').trim();
  const reviewFrom=raw?`${raw}T00:00:00.000Z`:undefined;
  const sql=db();
  const [active]=await sql`SELECT run_id FROM process_runs WHERE process_code IN('PROC-NOV-009','PROC-NOV-008') AND technical_status IN('queued','running') AND finished_at IS NULL ORDER BY requested_at DESC LIMIT 1`;
  if(active)return{ok:false,message:'Ya hay una actualización de Plex en curso. Espera a que termine.'};
  const requestKey=`plex-sync:${reviewFrom||'last-success'}:${Math.floor(Date.now()/3000)}`;
  try{
    const sync=await executeObservedProcess({processCode:'PROC-NOV-009',runKind:'system',triggerSource:'novedades_manual',executor:'vercel',entityType:'series_library',entityId:'plex',correlationKey:requestKey,idempotencyKey:`PROC-NOV-009:${requestKey}`,context:{surface:'/novedades',operation:'sync_plex_global',review_from:reviewFrom||'last_success'}},async trace=>{
      await trace.event({eventType:'step_started',step:'plex_sync',message:'Sincronizando biblioteca Plex incrementalmente'});
      const r=await syncPlexFast({reviewFrom});
      await trace.event({eventType:'step_completed',step:'plex_sync',message:'Biblioteca Plex sincronizada',data:{total:r.total,new:r.new,changed:r.changed,missing:r.missing,identity_review:r.identityReview||null}});
      await captureDashboardSnapshot().catch(()=>{});
      return{technicalStatus:'succeeded',functionalResult:(r.new||r.changed||r.missing)?'updated':'no_change',metrics:{plex_total:r.total,plex_new:r.new,plex_changed:r.changed,plex_missing:r.missing,identity_reviewed:r.identityReview?.reviewed||0,imdb_changes:r.identityReview?.imdb_changed||0},after:{review_from:r.identityReview?.review_from||reviewFrom||null,identity_review_complete:true,plex:{total:r.total,new:r.new,changed:r.changed,missing:r.missing}},message:'Sincronización Plex global completada'};
    });

    const seed=await executeObservedProcess({processCode:'PROC-NOV-008',runKind:'system',triggerSource:'novedades_manual',executor:'vercel',entityType:'discovery',entityId:'plex',correlationKey:requestKey,idempotencyKey:`PROC-NOV-008:${requestKey}`,context:{surface:'/novedades',operation:'seed_plex_news',parent_process:'PROC-NOV-009'}},async trace=>{
      await trace.event({eventType:'step_started',step:'seed_news',message:'Sembrando candidatos Plex en Novedades'});
      try{
        const news=await seedPlexNewsCandidates();
        await trace.event({eventType:'step_completed',step:'seed_news',message:'Siembra Plex completada',data:news});
        return{technicalStatus:'succeeded',functionalResult:(news.seeded||news.resolved)?'updated':'no_change',metrics:{candidates_seeded:news.seeded||0,candidates_ready:news.resolved||0,candidates_pending:news.pending||0,seed_failures:news.failed||0},after:{news},message:'Candidatos Plex sembrados en Novedades'};
      }catch(error){
        await recordProcessError(trace.runId,{error,step:'seed_news',source:'vercel',retryable:true,detail:{plex_sync_run_id:sync.runId}});
        return{technicalStatus:'partial',functionalResult:'pending',metrics:{candidates_seeded:0,candidates_ready:0,candidates_pending:0,seed_failures:1},after:{news:{seeded:0,resolved:0,failed:1,pending:0}},message:'Sincronización Plex correcta; siembra de Novedades con incidencia'};
      }
    });

    refresh();
    const m=sync.result?.metrics||{},n=seed.result?.metrics||{};
    const review=sync.result?.after?.review_from;
    const partial=seed.result?.technicalStatus==='partial';
    return{ok:!partial,message:`Plex actualizado · ${(m.plex_total||0).toLocaleString('es-ES')} títulos · ${(m.identity_reviewed||0).toLocaleString('es-ES')} identidades revisadas${review?` desde ${new Date(review).toLocaleDateString('es-ES')}`:''} · ${m.imdb_changes||0} cambios IMDb · ${m.plex_new||0} altas · ${m.plex_missing||0} bajas · ${n.candidates_seeded||0} candidatos Plex${partial?' · siembra con incidencia':''}`};
  }catch(e){refresh();return{ok:false,message:e?.message||'No se pudo actualizar Plex'}}
}
