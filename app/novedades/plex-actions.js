'use server';
import {revalidatePath} from 'next/cache';
import {syncPlexFast} from '@/lib/plex-sync';
import {seedPlexNewsCandidates} from '@/lib/plex-news-seed';
import {captureDashboardSnapshot} from '@/lib/dashboard-v2';
import {startRun,finishRun,errorInfo} from '@/lib/runlog';

export async function syncPlexFromNews(_prevState,formData){
  const raw=String(formData?.get('reviewFrom')||'').trim();
  const reviewFrom=raw?`${raw}T00:00:00.000Z`:undefined;
  const run=await startRun('plex_fast_sync','web',{stage:'running',review_from:reviewFrom||'last_complete_success'});
  try{
    const r=await syncPlexFast({reviewFrom});
    const news=await seedPlexNewsCandidates().catch(()=>({seeded:0,resolved:0,failed:1,pending:0}));
    await captureDashboardSnapshot().catch(()=>{});
    revalidatePath('/');revalidatePath('/novedades');revalidatePath('/catalogo');revalidatePath('/plex');revalidatePath('/calidad');revalidatePath('/admin');
    await finishRun(run.id,'success',{processed:r.total,added:r.new,updated:r.changed,errors:(r.errors||0)+(news.failed||0),summary:{stage:'done',review_from:r.identityReview?.review_from||reviewFrom||null,identity_review_complete:true,identity_reviewed:r.identityReview?.reviewed||0,imdb_identity_changes:r.identityReview?.imdb_changed||0,imdb_removed:r.identityReview?.imdb_removed||0,imdb_added:r.identityReview?.imdb_added||0,total:r.total,new:r.new,changed:r.changed,missing:r.missing,plex_news:news}});
    return{ok:true,message:`Plex actualizado · ${r.total.toLocaleString('es-ES')} títulos · ${r.identityReview?.reviewed||0} identidades revisadas desde ${new Date(r.identityReview.review_from).toLocaleDateString('es-ES')} · ${r.identityReview?.imdb_changed||0} cambios IMDb · ${r.new} altas · ${r.missing} bajas`};
  }catch(e){await finishRun(run.id,'failed',{errors:1,summary:{stage:'failed',identity_review_complete:false,review_from:reviewFrom||null,error:errorInfo(e)}});return{ok:false,message:e?.message||'No se pudo actualizar Plex'}}
}
