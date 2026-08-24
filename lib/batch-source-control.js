import 'server-only';
import {db} from './db';

const SOURCES=new Set(['tmdb','omdb','wikidata','filmaffinity','fast','plex','mdblist']);
const cleanSource=v=>{const s=String(v||'').trim().toLowerCase();if(!SOURCES.has(s))throw new Error('Fuente no permitida');return s};

async function fetchProbe(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  const started=Date.now();
  try{
    const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
    const body=await response.text();
    return{ok:response.ok,status:response.status,duration_ms:Date.now()-started,message:response.ok?'Comunicación correcta':`HTTP ${response.status}: ${body.slice(0,180)}`};
  }catch(error){
    return{ok:false,status:null,duration_ms:Date.now()-started,message:error?.name==='AbortError'?'Timeout de 10 s':String(error?.message||error).slice(0,220)};
  }finally{clearTimeout(timer)}
}

async function probe(source){
  if(source==='tmdb'){
    const token=process.env.TMDB_API_TOKEN;if(!token)return{ok:false,status:null,duration_ms:0,message:'Falta TMDB_API_TOKEN'};
    return fetchProbe('https://api.themoviedb.org/3/configuration',{headers:{Authorization:`Bearer ${token}`,Accept:'application/json','User-Agent':'PikoFilm/3.0'}});
  }
  if(source==='omdb'){
    const key=process.env.OMDB_API_KEY||process.env.OMDB_APIKEY||process.env.OMDB_KEY;if(!key)return{ok:false,status:null,duration_ms:0,message:'Falta OMDB_API_KEY'};
    return fetchProbe(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=tt0111161&r=json`,{headers:{'User-Agent':'PikoFilm/3.0'}});
  }
  if(source==='mdblist'){
    const token=process.env.MDBLIST_API_KEY||process.env.MDBLIST_APIKEY||process.env.MDBLIST_KEY;if(!token)return{ok:false,status:null,duration_ms:0,message:'Falta MDBLIST_API_KEY'};
    return fetchProbe('https://api.mdblist.com/?i=tt0111161',{headers:{Authorization:`Bearer ${token}`,'User-Agent':'PikoFilm/3.0'}});
  }
  if(source==='wikidata')return fetchProbe('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q42&format=json&origin=*',{headers:{'User-Agent':'PikoFilm/3.0'}});
  if(source==='filmaffinity')return fetchProbe('https://www.filmaffinity.com/es/main.html',{headers:{'User-Agent':'Mozilla/5.0 PikoFilm/3.0'}});
  return{ok:false,status:null,duration_ms:0,message:`La prueba manual todavía no está definida para ${source}`};
}

export async function testSourceConnection(sourceValue){
  const source=cleanSource(sourceValue),sql=db(),result=await probe(source);
  if(result.ok){
    await sql`UPDATE batch_source_limits SET breaker_state='closed',blocked_until=NULL,consecutive_errors=0,updated_at=now() WHERE source=${source}`;
  }
  return{source,...result};
}

export async function closeSourceBreaker(sourceValue){
  const source=cleanSource(sourceValue),sql=db();
  await sql`UPDATE batch_source_limits SET breaker_state='closed',blocked_until=NULL,consecutive_errors=0,updated_at=now() WHERE source=${source}`;
  return{source,ok:true,message:'Breaker cerrado manualmente'};
}
