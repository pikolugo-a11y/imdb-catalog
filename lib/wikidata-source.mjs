const ENDPOINT='https://query.wikidata.org/sparql';
const USER_AGENT='PikoFilm/3.0 (https://github.com/pikolugo-a11y/imdb-catalog)';

function value(binding,key){return binding?.[key]?.value??null;}
function qid(uri){const m=String(uri||'').match(/\/entity\/(Q\d+)$/);return m?.[1]||null;}

function parseRetryAfterMs(value){
  if(value==null||value==='')return null;
  const seconds=Number(value);
  if(Number.isFinite(seconds)&&seconds>=0)return Math.round(seconds*1000);
  const at=Date.parse(String(value));
  return Number.isFinite(at)?Math.max(0,at-Date.now()):null;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function lookupWikidataByImdb(imdbId,{timeoutMs=12000,retries=0,baseBackoffMs=1000,maxBackoffMs=30000,trace=null}={}){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id))throw Object.assign(new Error('IMDb ID no válido para Wikidata'),{permanent:true});
  const query=`SELECT ?item ?itemLabel ?tmdbMovie ?tmdbTv WHERE {
    ?item wdt:P345 "${id}".
    OPTIONAL { ?item wdt:P4947 ?tmdbMovie. }
    OPTIONAL { ?item wdt:P4983 ?tmdbTv. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  } LIMIT 3`;
  const url=`${ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  let last=null;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      await trace?.externalCall?.(1);
      const r=await fetch(url,{headers:{Accept:'application/sparql-results+json','User-Agent':USER_AGENT,'Accept-Encoding':'gzip, deflate'},signal:controller.signal});
      if(!r.ok){
        const e=new Error(`Wikidata HTTP ${r.status}`);
        e.status=r.status;
        e.retryAfter=r.headers.get('retry-after')||null;
        e.retryable=r.status===429||r.status>=500;
        throw e;
      }
      const j=await r.json();
      const rows=j?.results?.bindings||[];
      if(!rows.length)return{found:false,imdb_id:id};
      const unique=[...new Map(rows.map(x=>[value(x,'item'),x])).values()];
      if(unique.length!==1)throw Object.assign(new Error(`Wikidata devolvió ${unique.length} entidades para ${id}`),{permanent:true});
      const b=unique[0];
      return{found:true,imdb_id:id,qid:qid(value(b,'item')),label:value(b,'itemLabel'),tmdb_movie_id:value(b,'tmdbMovie'),tmdb_tv_id:value(b,'tmdbTv')};
    }catch(error){
      last=error;
      if(error?.permanent||attempt>=retries)throw error;
      const fromHeader=parseRetryAfterMs(error?.retryAfter);
      const fallback=Math.min(Math.max(0,baseBackoffMs)*(2**attempt),Math.max(1000,maxBackoffMs));
      await sleep(fromHeader==null?fallback:Math.min(fromHeader,Math.max(1000,maxBackoffMs)));
    }finally{clearTimeout(timer)}
  }
  throw last||new Error('Wikidata lookup failed')
}

export function chooseWikidataTmdb(hit,type){
  if(!hit?.found)return null;
  const series=type==='Serie'||type==='Miniserie';
  return String(series?hit.tmdb_tv_id||'':hit.tmdb_movie_id||'').trim()||null;
}
