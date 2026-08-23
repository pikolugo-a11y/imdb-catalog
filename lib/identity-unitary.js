import 'server-only';
import {db} from './db';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';
import {resolveTmdbOnly,wikidataFaBatch,wikidataFaByTmdbBatch,searchFaBrave,saveIdentity} from './identity-resolver';

export async function resolveIdentityUnitary(imdbId){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');
  const sql=db();
  const [row]=await sql`SELECT imdb_id,type,title,title_es,original_title,year,tmdb_id,fa_id FROM movies WHERE imdb_id=${id}`;
  if(!row)throw new Error('Título no encontrado');

  const started=Date.now();
  await audit('identity','title',id,'unitary_resolution_started',{tmdb_id:row.tmdb_id||null,fa_id:row.fa_id||null});

  let tmdbId=row.tmdb_id?String(row.tmdb_id):null;
  let faId=row.fa_id?String(row.fa_id):null;
  const methods=[];

  const tmdbPromise=tmdbId?Promise.resolve(tmdbId):resolveTmdbOnly(id,row.type).catch(()=>null);
  const faImdbPromise=faId?Promise.resolve({map:{[id]:faId}}):wikidataFaBatch([id]).catch(()=>({map:{}}));
  const [tmdbResolved,faImdb]=await Promise.all([tmdbPromise,faImdbPromise]);

  if(!tmdbId&&tmdbResolved){tmdbId=String(tmdbResolved);methods.push('tmdb_imdb');}
  if(!faId&&faImdb?.map?.[id]){faId=String(faImdb.map[id]);methods.push('wikidata_imdb');}

  if(!faId&&tmdbId){
    const byTmdb=await wikidataFaByTmdbBatch([{...row,tmdb_id:tmdbId}]).catch(()=>({map:{}}));
    if(byTmdb?.map?.[tmdbId]){faId=String(byTmdb.map[tmdbId]);methods.push('wikidata_tmdb');}
  }

  if(!faId){
    const brave=await searchFaBrave({...row,tmdb_id:tmdbId},{singleQuery:true}).catch(()=>null);
    if(brave?.faId){faId=String(brave.faId);methods.push('fa_brave');}
  }

  if((!row.tmdb_id&&tmdbId)||(!row.fa_id&&faId))await saveIdentity(id,{tmdbId:!row.tmdb_id?tmdbId:null,faId:!row.fa_id?faId:null,method:methods.join('+')||'unitary'});

  const [after]=await sql`SELECT imdb_id,tmdb_id,fa_id FROM movies WHERE imdb_id=${id}`;
  const lifecycle=(await recomputeLifecycleForIds([id])).get(id);
  const complete=Boolean(after?.imdb_id&&after?.tmdb_id&&after?.fa_id);
  await audit('identity','title',id,'unitary_resolution_completed',{complete,tmdb_id:after?.tmdb_id||null,fa_id:after?.fa_id||null,methods,duration_ms:Date.now()-started,lifecycle:lifecycle?.state||null});

  return{ok:true,complete,tmdbId:after?.tmdb_id||null,faId:after?.fa_id||null,methods,lifecycle,durationMs:Date.now()-started};
}
