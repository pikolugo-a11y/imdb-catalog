import 'server-only';
import {db} from './db';
import {validateTmdbIdentity} from './identity-resolver';
import {saveIdentity} from './identity';
import {recomputeLifecycleForIds} from './lifecycle';

const imdbOk=value=>/^tt\d+$/.test(String(value||''));
const tmdbOk=value=>/^\d+$/.test(String(value||''));
const isSeriesType=value=>value==='Serie'||value==='Miniserie';

export async function correctIdentityIds({oldImdbId,newImdbId,tmdbId,trace=null,forceMismatch=false,tmdbOnly=false}){
  const oldId=String(oldImdbId||'').trim();
  const newId=String(newImdbId||oldId).trim();
  const newTmdb=String(tmdbId||'').trim()||null;
  const useTmdbOnly=Boolean(tmdbOnly);
  if(!imdbOk(oldId)||!imdbOk(newId))throw new Error('IMDb ID inválido');
  if(newTmdb&&!tmdbOk(newTmdb))throw new Error('TMDb ID inválido');

  const sql=db();
  const[before]=await sql`SELECT imdb_id,type,tmdb_id,source_status,COALESCE(title_es,title,original_title) AS display_title FROM movies WHERE imdb_id=${oldId}`;
  if(!before)throw new Error('Título no encontrado');
  if(useTmdbOnly&&!isSeriesType(before.type))throw new Error('TMDb solo únicamente está disponible para series y miniseries');
  if(useTmdbOnly&&!newTmdb)throw new Error('Introduce el TMDb ID de la serie');
  if(useTmdbOnly&&newId!==oldId)throw new Error('En modo TMDb solo no se cambia el identificador interno del catálogo');
  const beforeMode=before.source_status?.identity_mode==='tmdb_only'?'tmdb_only':'normal';
  const nextMode=useTmdbOnly?'tmdb_only':'normal';
  if(newId===oldId&&String(before.tmdb_id||'')===String(newTmdb||'')&&beforeMode===nextMode)return{changed:false,savedImdbId:oldId,before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null,identity_mode:beforeMode},after:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null,identity_mode:beforeMode},lifecycle:null};

  await trace?.event?.({eventType:'step_started',step:'validate_identity_ids',message:useTmdbOnly?'Validando serie TMDb solo':'Validando corrección de IMDb/TMDb',data:{old_imdb_id:oldId,new_imdb_id:newId,tmdb_id:newTmdb,force_mismatch:Boolean(forceMismatch),identity_mode:nextMode}});
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
    if(!useTmdbOnly&&!verification.actualImdbId){await trace?.event?.({eventType:'step_warning',step:'validate_identity_ids',message:'TMDb no devolvió un IMDb verificable'});return{changed:false,blocked:true,reason:'unverifiable',verification,before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null,identity_mode:beforeMode}}}
    if(!useTmdbOnly&&!verification.ok&&!forceMismatch){await trace?.event?.({eventType:'step_warning',step:'validate_identity_ids',message:'TMDb corresponde a un IMDb distinto',data:{actual_imdb_id:verification.actualImdbId}});return{changed:false,blocked:true,reason:'mismatch',verification,before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null,identity_mode:beforeMode}}}
    if(!useTmdbOnly&&!verification.ok&&forceMismatch)await trace?.event?.({eventType:'step_warning',step:'manual_override',message:'Discrepancia IMDb/TMDb aceptada manualmente',data:{requested_imdb_id:newId,tmdb_id:newTmdb,actual_imdb_id:verification.actualImdbId}});
  }
  await trace?.event?.({eventType:'step_completed',step:'validate_identity_ids',message:useTmdbOnly?'TMDb verificado como serie; IMDb no se usa como fuente':verification&&!verification.ok&&forceMismatch?'Discrepancia verificada y aceptada manualmente':newTmdb?'IMDb/TMDb verificados':'Formatos verificados; sin TMDb que contrastar',data:{tmdb_verified:Boolean(newTmdb),actual_imdb_id:verification?.actualImdbId||null,forced:Boolean(forceMismatch&&verification&&!verification.ok),identity_mode:nextMode}});

  await trace?.event?.({eventType:'step_started',step:'save_identity_ids',message:'Guardando identidad canónica'});
  const savedImdbId=await saveIdentity(oldId,{imdbId:newId,tmdbId:newTmdb},{auditLegacy:false});
  const modePatch=useTmdbOnly?JSON.stringify({identity_mode:'tmdb_only',identity_mode_set_at:new Date().toISOString(),identity_mode_source:'manual',tmdb:'ok',imdb:'not_applicable',filmaffinity:'not_applicable',wikidata:'not_applicable'}):null;
  if(useTmdbOnly){
    await sql`UPDATE movies SET source_status=COALESCE(source_status,'{}'::jsonb)||${modePatch}::jsonb,imdb_url=NULL,synced_at=now() WHERE imdb_id=${savedImdbId}`;
  }else if(beforeMode==='tmdb_only'){
    await sql`UPDATE movies SET source_status=(COALESCE(source_status,'{}'::jsonb)-'identity_mode'-'identity_mode_set_at'-'identity_mode_source'-'imdb'-'filmaffinity'-'wikidata'),imdb_url=${`https://www.imdb.com/title/${savedImdbId}/`},synced_at=now() WHERE imdb_id=${savedImdbId}`;
  }
  await trace?.event?.({eventType:'step_completed',step:'save_identity_ids',message:'Identidad canónica guardada',data:{saved_imdb_id:savedImdbId,tmdb_id:newTmdb,forced:Boolean(forceMismatch&&verification&&!verification.ok),identity_mode:nextMode}});

  await trace?.event?.({eventType:'step_started',step:'recompute_lifecycle',message:'Recalculando Lifecycle tras corregir IDs'});
  const lifecycle=await recomputeLifecycleForIds([savedImdbId]);
  const next=lifecycle.get(savedImdbId)?.label||null;
  await trace?.event?.({eventType:'step_completed',step:'recompute_lifecycle',message:'Lifecycle recalculado',data:{next}});

  return{changed:true,forced:Boolean(forceMismatch&&verification&&!verification.ok),savedImdbId,verification,before:{imdb_id:oldId,tmdb_id:before.tmdb_id?String(before.tmdb_id):null,identity_mode:beforeMode},after:{imdb_id:savedImdbId,tmdb_id:newTmdb,identity_mode:nextMode},lifecycle:next};
}
