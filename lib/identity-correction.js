import 'server-only';
import {db} from './db';
import {validateTmdbIdentity} from './identity-resolver';
import {saveIdentity} from './identity';
import {recomputeLifecycleForIds} from './lifecycle';

const imdbOk=value=>/^tt\d+$/.test(String(value||''));
const tmdbOk=value=>/^\d+$/.test(String(value||''));

export async function correctIdentityIds({oldImdbId,newImdbId,tmdbId,trace=null}){
  const oldId=String(oldImdbId||'').trim();
  const newId=String(newImdbId||oldId).trim();
  const newTmdb=String(tmdbId||'').trim()||null;
  if(!imdbOk(oldId)||!imdbOk(newId))throw new Error('IMDb ID inválido');
  if(newTmdb&&!tmdbOk(newTmdb))throw new Error('TMDb ID inválido');

  const sql=db();
  const[before]=await sql`SELECT imdb_id,type,tmdb_id,COALESCE(title_es,title,original_title) AS display_title FROM movies WHERE imdb_id=${oldId}`;
  if(!before)throw new Error('Título no encontrado');
  if(newId===oldId&&String(before.tmdb_id||'')===String(newTmdb||''))return{changed:false,savedImdbId:oldId,before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null},after:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null},lifecycle:null};

  await trace?.event?.({eventType:'step_started',step:'validate_identity_ids',message:'Validando corrección de IMDb/TMDb',data:{old_imdb_id:oldId,new_imdb_id:newId,tmdb_id:newTmdb}});
  let verification=null;
  if(newTmdb){
    try{
      await trace?.externalCall?.(2);
      verification=await validateTmdbIdentity(newTmdb,before.type,newId);
    }catch(e){
      e.processStep='validate_tmdb_identity';
      e.source='tmdb';
      e.retryable=true;
      throw e;
    }
    if(!verification.actualImdbId)return{changed:false,blocked:true,reason:'unverifiable',verification,before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null}};
    if(!verification.ok)return{changed:false,blocked:true,reason:'mismatch',verification,before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null}};
  }
  await trace?.event?.({eventType:'step_completed',step:'validate_identity_ids',message:newTmdb?'IMDb/TMDb verificados':'Formatos verificados; sin TMDb que contrastar',data:{tmdb_verified:Boolean(newTmdb),actual_imdb_id:verification?.actualImdbId||null}});

  await trace?.event?.({eventType:'step_started',step:'save_identity_ids',message:'Guardando identidad canónica'});
  const savedImdbId=await saveIdentity(oldId,{imdbId:newId,tmdbId:newTmdb},{auditLegacy:false});
  await trace?.event?.({eventType:'step_completed',step:'save_identity_ids',message:'Identidad canónica guardada',data:{saved_imdb_id:savedImdbId,tmdb_id:newTmdb}});

  await trace?.event?.({eventType:'step_started',step:'recompute_lifecycle',message:'Recalculando Lifecycle tras corregir IDs'});
  const lifecycle=await recomputeLifecycleForIds([savedImdbId]);
  const next=lifecycle.get(savedImdbId)?.label||null;
  await trace?.event?.({eventType:'step_completed',step:'recompute_lifecycle',message:'Lifecycle recalculado',data:{next}});

  return{
    changed:true,
    savedImdbId,
    verification,
    before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null},
    after:{imdb_id:savedImdbId,tmdb_id:newTmdb},
    lifecycle:next,
  };
}
