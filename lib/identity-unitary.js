import 'server-only';
import {db} from './db';
import {recomputeLifecycleForIds} from './lifecycle';
import {resolveTmdbOnly,saveIdentity} from './identity-resolver';

export async function resolveIdentityUnitary(imdbId,trace={}){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id)){const e=new Error('IMDb ID inválido');e.processStep='validate_input';throw e}
  const sql=db();
  const [row]=await sql`SELECT imdb_id,type,tmdb_id FROM movies WHERE imdb_id=${id}`;
  if(!row){const e=new Error('Título no encontrado');e.processStep='load_title';throw e}

  const started=Date.now();
  const event=async(payload)=>{if(typeof trace.event==='function')await trace.event(payload)};
  const externalCall=async(count=1)=>{if(typeof trace.externalCall==='function')await trace.externalCall(count)};
  const before={tmdb_id:row.tmdb_id?String(row.tmdb_id):null,lifecycle_state:null};
  await event({eventType:'step_started',step:'resolve_tmdb',message:row.tmdb_id?'TMDb ya existente; no se consulta fuente externa':'Resolviendo TMDb desde IMDb',data:{existing_tmdb:Boolean(row.tmdb_id)}});

  let tmdbId=row.tmdb_id?String(row.tmdb_id):null;
  const methods=[];
  if(!tmdbId){
    try{
      await externalCall(1);
      tmdbId=await resolveTmdbOnly(id,row.type);
    }catch(error){error.processStep='resolve_tmdb';error.source='tmdb';error.retryable=true;throw error}
    if(tmdbId){
      tmdbId=String(tmdbId);
      await saveIdentity(id,{tmdbId,method:'tmdb_imdb'});
      methods.push('tmdb_imdb');
      await event({eventType:'step_completed',step:'resolve_tmdb',message:`TMDb ${tmdbId} resuelto y guardado`,durationMs:Date.now()-started,data:{method:'tmdb_imdb',tmdb_id:tmdbId}});
    }else{
      methods.push('tmdb_not_found');
      await event({eventType:'step_completed',step:'resolve_tmdb',message:'TMDb respondió sin coincidencia',durationMs:Date.now()-started,data:{method:'tmdb_not_found'}});
    }
  }else{
    methods.push('existing_tmdb');
    await event({eventType:'step_completed',step:'resolve_tmdb',message:`TMDb ${tmdbId} ya existente`,durationMs:Date.now()-started,data:{method:'existing_tmdb',tmdb_id:tmdbId}});
  }

  const [after]=await sql`SELECT imdb_id,tmdb_id FROM movies WHERE imdb_id=${id}`;
  await event({eventType:'step_started',step:'recompute_lifecycle',message:'Recalculando Lifecycle'});
  let lifecycle;
  try{lifecycle=(await recomputeLifecycleForIds([id])).get(id)}catch(error){error.processStep='recompute_lifecycle';throw error}
  await event({eventType:'step_completed',step:'recompute_lifecycle',message:`Lifecycle: ${lifecycle?.state||'sin estado'}`,data:{lifecycle_state:lifecycle?.state||null}});

  const complete=Boolean(after?.imdb_id&&after?.tmdb_id);
  const functionalResult=complete?(before.tmdb_id?'no_change':'updated'):'not_found';
  return{
    ok:true,
    complete,
    notFound:!complete&&!tmdbId,
    tmdbId:after?.tmdb_id||null,
    methods,
    lifecycle,
    durationMs:Date.now()-started,
    functionalResult,
    externalCalls:before.tmdb_id?0:1,
    before,
    after:{tmdb_id:after?.tmdb_id?String(after.tmdb_id):null,lifecycle_state:lifecycle?.state||null}
  };
}
