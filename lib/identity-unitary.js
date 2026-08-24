import 'server-only';
import {db} from './db';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';
import {resolveTmdbOnly,saveIdentity} from './identity-resolver';

export async function resolveIdentityUnitary(imdbId){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');
  const sql=db();
  const [row]=await sql`SELECT imdb_id,type,tmdb_id FROM movies WHERE imdb_id=${id}`;
  if(!row)throw new Error('Título no encontrado');

  const started=Date.now();
  await audit('identity','title',id,'unitary_resolution_started',{tmdb_id:row.tmdb_id||null});

  let tmdbId=row.tmdb_id?String(row.tmdb_id):null;
  const methods=[];
  if(!tmdbId){
    tmdbId=await resolveTmdbOnly(id,row.type).catch(()=>null);
    if(tmdbId){
      tmdbId=String(tmdbId);
      await saveIdentity(id,{tmdbId,method:'tmdb_imdb'});
      methods.push('tmdb_imdb');
    }
  }else methods.push('existing_tmdb');

  const [after]=await sql`SELECT imdb_id,tmdb_id FROM movies WHERE imdb_id=${id}`;
  const lifecycle=(await recomputeLifecycleForIds([id])).get(id);
  const complete=Boolean(after?.imdb_id&&after?.tmdb_id);
  await audit('identity','title',id,'unitary_resolution_completed',{complete,tmdb_id:after?.tmdb_id||null,methods,duration_ms:Date.now()-started,lifecycle:lifecycle?.state||null});

  return{ok:true,complete,tmdbId:after?.tmdb_id||null,methods,lifecycle,durationMs:Date.now()-started};
}
