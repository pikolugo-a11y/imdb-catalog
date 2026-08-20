import 'server-only';

const TMDB='https://api.themoviedb.org/3';

function mapType(v){const t=String(v||'').toLowerCase();if(t==='movie')return'movie';if(t==='tvseries')return'tvSeries';if(t==='tvminiseries')return'tvMiniSeries';return null}
function firstYear(v){const y=String(v||'').match(/(19|20)\d{2}/);return y?Number(y[0]):null}
function countryCodesFromLd(x){const arr=Array.isArray(x?.countryOfOrigin)?x.countryOfOrigin:(x?.countryOfOrigin?[x.countryOfOrigin]:[]);return arr.map(c=>String(c?.identifier||c?.name||'').trim()).filter(Boolean)}

async function imdbJsonLd(imdbId){
  const r=await fetch(`https://www.imdb.com/title/${imdbId}/`,{headers:{'User-Agent':'Mozilla/5.0 PikoFilm/3.0','Accept-Language':'es-ES,es;q=0.9,en;q=0.8'},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`IMDb HTTP ${r.status}`);
  const html=await r.text();
  const m=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!m)throw new Error('IMDb no devolvió JSON-LD');
  const j=JSON.parse(m[1]);
  const agg=j?.aggregateRating||{};
  return {title:j?.name||null,originalTitle:j?.alternateName||null,candidate_type:mapType(j?.['@type']),year:firstYear(j?.datePublished),imdb_rating:Number.isFinite(Number(agg.ratingValue))?Number(agg.ratingValue):null,imdb_votes:Number.isFinite(Number(agg.ratingCount))?Number(agg.ratingCount):null,image:j?.image||null,countries:countryCodesFromLd(j),genres:Array.isArray(j?.genre)?j.genre:[],description:j?.description||null};
}

async function tmdbResolve(imdbId,typeHint){
  const token=process.env.TMDB_API_TOKEN;if(!token)return null;
  const headers={Authorization:`Bearer ${token}`,Accept:'application/json'};
  const f=await fetch(`${TMDB}/find/${imdbId}?external_source=imdb_id`,{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});if(!f.ok)return null;
  const j=await f.json();const movie=j.movie_results?.[0]||null,tv=j.tv_results?.[0]||null,hit=typeHint==='movie'?(movie||tv):(typeHint?(tv||movie):(movie||tv));if(!hit)return null;
  const media=movie&&hit===movie?'movie':'tv';
  let detail=null;try{const d=await fetch(`${TMDB}/${media}/${hit.id}?language=es-ES`,{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});if(d.ok)detail=await d.json()}catch{}
  return {tmdb_id:hit.id,candidate_type:media==='movie'?'movie':'tvSeries',title:detail?.title||detail?.name||hit.title||hit.name||null,originalTitle:detail?.original_title||detail?.original_name||hit.original_title||hit.original_name||null,year:firstYear(detail?.release_date||detail?.first_air_date||hit.release_date||hit.first_air_date),countries:media==='movie'?(detail?.production_countries||[]).map(c=>c.iso_3166_1).filter(Boolean):(detail?.origin_country||hit.origin_country||[]),poster_path:detail?.poster_path||hit.poster_path||null,overview:detail?.overview||hit.overview||null};
}

export async function resolveManualNewsCandidate(imdbId){
  let imdb=null,tmdb=null,imdbError=null;
  try{imdb=await imdbJsonLd(imdbId)}catch(e){imdbError=e?.message||String(e)}
  try{tmdb=await tmdbResolve(imdbId,imdb?.candidate_type)}catch{}
  const candidate_type=imdb?.candidate_type||tmdb?.candidate_type||null;
  const title=imdb?.title||tmdb?.title||imdbId;
  const originalTitle=imdb?.originalTitle||tmdb?.originalTitle||title;
  const year=imdb?.year||tmdb?.year||null;
  const countries=(imdb?.countries?.length?imdb.countries:tmdb?.countries)||[];
  return {candidate_type,year,imdb_rating:imdb?.imdb_rating??null,imdb_votes:imdb?.imdb_votes??null,source_snapshot:{manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1',title,originalTitle,countries,countryStatus:countries.length?'resolved':'pending',posterPath:tmdb?.poster_path||null,posterUrl:imdb?.image||null,tmdbId:tmdb?.tmdb_id||null,genres:imdb?.genres||[],overview:tmdb?.overview||imdb?.description||null,manualResolvedAt:new Date().toISOString(),manualResolver:'imdb-jsonld+tmdb',imdbResolverError:imdbError}};
}
