import 'server-only';

const OMDB='https://www.omdbapi.com/';

function apiKey(){return process.env.OMDB_API_KEY||process.env.OMDB_APIKEY||process.env.OMDB_KEY||null}
function firstYear(v){const m=String(v||'').match(/(19|20)\d{2}/);return m?Number(m[0]):null}
function mapType(v){const t=String(v||'').toLowerCase();if(t==='movie')return'movie';if(t==='series')return'tvSeries';return null}
function numberOrNull(v){if(v==null||v==='N/A')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function votesOrNull(v){if(v==null||v==='N/A')return null;const digits=String(v).replace(/[^0-9]/g,'');if(!digits)return null;const n=Number(digits);return Number.isInteger(n)?n:null}

export async function omdbMinimumByImdb(imdbId,{timeoutMs=10000}={}){
  if(!/^tt\d+$/.test(String(imdbId||'')))return null;
  const key=apiKey();if(!key)throw new Error('OMDb API key no configurada');
  const url=`${OMDB}?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}&plot=short&r=json`;
  const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':'PikoFilm/3.0'}});
  if(!r.ok)throw new Error(`OMDb HTTP ${r.status}`);
  const j=await r.json();
  if(j?.Response==='False')throw new Error(`OMDb: ${j?.Error||'título no encontrado'}`);
  return {
    imdb_id:imdbId,
    title:j?.Title&&j.Title!=='N/A'?j.Title:null,
    year:firstYear(j?.Year),
    candidate_type:mapType(j?.Type),
    imdb_rating:numberOrNull(j?.imdbRating),
    imdb_votes:votesOrNull(j?.imdbVotes),
    source:'omdb'
  };
}
