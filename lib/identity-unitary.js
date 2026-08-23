import 'server-only';
import crypto from 'node:crypto';
import {db} from './db';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';
import {resolveTmdbOnly,wikidataFaBatch,wikidataFaByTmdbBatch,saveIdentity} from './identity-resolver';

function appBase(){
  const explicit=String(process.env.PIKOFILM_URL||'').trim().replace(/\/$/,'');
  if(explicit)return explicit;
  const prod=String(process.env.VERCEL_PROJECT_PRODUCTION_URL||'').trim();
  if(prod)return `https://${prod}`;
  return 'https://imdb-catalog-eight.vercel.app';
}

async function searchFaPython(row){
  const dbUrl=String(process.env.DATABASE_URL||'');
  if(!dbUrl)throw new Error('DATABASE_URL no configurada');
  const token=crypto.createHash('sha256').update(dbUrl).digest('hex');
  const c=new AbortController(),t=setTimeout(()=>c.abort(),25000),started=Date.now();
  try{
    const r=await fetch(`${appBase()}/api/fa-search`,{
      method:'POST',
      headers:{'content-type':'application/json','x-pikofilm-worker':token},
      body:JSON.stringify({imdb_id:row.imdb_id,title:row.title,title_es:row.title_es,original_title:row.original_title,year:row.year}),
      cache:'no-store',signal:c.signal
    });
    const text=await r.text();
    let data=null;try{data=JSON.parse(text)}catch{}
    if(!r.ok)throw new Error(data?.error||`FA Python HTTP ${r.status}`);
    return {...(data||{}),elapsed_ms:Date.now()-started};
  }finally{clearTimeout(t)}
}

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
  let faDiagnostics=null;

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
    const found=await searchFaPython({...row,tmdb_id:tmdbId}).catch(e=>({ok:false,status:'error',fa_id:null,error:e?.message||String(e)}));
    faDiagnostics={method:'fa_python',status:found?.status||null,confidence:Number(found?.confidence||0),margin:Number(found?.margin||0),elapsed_ms:Number(found?.elapsed_ms||Math.round(Number(found?.elapsed_s||0)*1000)),error:found?.error||null,candidates:Array.isArray(found?.candidates)?found.candidates.slice(0,5):[],queries:found?.queries||[]};
    if(found?.fa_id){faId=String(found.fa_id);methods.push(`fa_python_${found.status||'match'}`);}
  }

  if((!row.tmdb_id&&tmdbId)||(!row.fa_id&&faId))await saveIdentity(id,{tmdbId:!row.tmdb_id?tmdbId:null,faId:!row.fa_id?faId:null,method:methods.join('+')||'unitary'});

  const [after]=await sql`SELECT imdb_id,tmdb_id,fa_id FROM movies WHERE imdb_id=${id}`;
  const lifecycle=(await recomputeLifecycleForIds([id])).get(id);
  const complete=Boolean(after?.imdb_id&&after?.tmdb_id&&after?.fa_id);
  await audit('identity','title',id,'unitary_resolution_completed',{complete,tmdb_id:after?.tmdb_id||null,fa_id:after?.fa_id||null,methods,fa:faDiagnostics,duration_ms:Date.now()-started,lifecycle:lifecycle?.state||null});

  return{ok:true,complete,tmdbId:after?.tmdb_id||null,faId:after?.fa_id||null,methods,faDiagnostics,lifecycle,durationMs:Date.now()-started};
}
