const ENDPOINT='https://query.wikidata.org/sparql';
const USER_AGENT='PikoFilm/3.0 (https://github.com/pikolugo-a11y/imdb-catalog)';

function value(binding,key){return binding?.[key]?.value??null;}
function qid(uri){const m=String(uri||'').match(/\/entity\/(Q\d+)$/);return m?.[1]||null;}

export async function lookupWikidataByImdb(imdbId){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id))throw Object.assign(new Error('IMDb ID no válido para Wikidata'),{permanent:true});
  const query=`SELECT ?item ?itemLabel ?tmdbMovie ?tmdbTv WHERE {
    ?item wdt:P345 "${id}".
    OPTIONAL { ?item wdt:P4947 ?tmdbMovie. }
    OPTIONAL { ?item wdt:P4983 ?tmdbTv. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  } LIMIT 3`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const url=`${ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    const r=await fetch(url,{headers:{Accept:'application/sparql-results+json','User-Agent':USER_AGENT,'Accept-Encoding':'gzip, deflate'},signal:controller.signal});
    if(!r.ok){const e=new Error(`Wikidata HTTP ${r.status}`);e.status=r.status;const retry=Number(r.headers.get('retry-after'));if(Number.isFinite(retry)&&retry>0)e.retryAfterSeconds=retry;throw e;}
    const j=await r.json();
    const rows=j?.results?.bindings||[];
    if(!rows.length)return{found:false,imdb_id:id};
    const unique=[...new Map(rows.map(x=>[value(x,'item'),x])).values()];
    if(unique.length!==1)throw Object.assign(new Error(`Wikidata devolvió ${unique.length} entidades para ${id}`),{permanent:true});
    const b=unique[0];
    return{found:true,imdb_id:id,qid:qid(value(b,'item')),label:value(b,'itemLabel'),tmdb_movie_id:value(b,'tmdbMovie'),tmdb_tv_id:value(b,'tmdbTv')};
  }finally{clearTimeout(timer)}
}

export function chooseWikidataTmdb(hit,type){
  if(!hit?.found)return null;
  const series=type==='Serie'||type==='Miniserie';
  return String(series?hit.tmdb_tv_id||'':hit.tmdb_movie_id||'').trim()||null;
}
