import 'server-only';
import { RATING_SOURCES } from './title-ratings';

const SOURCE_MAP = {
  imdb: { source: RATING_SOURCES.IMDB, scale: 10, ratingType: 'audience' },
  tmdb: { source: RATING_SOURCES.TMDB, scale: 100, ratingType: 'audience' },
  trakt: { source: RATING_SOURCES.TRAKT, scale: 100, ratingType: 'audience' },
  letterboxd: { source: RATING_SOURCES.LETTERBOXD, scale: 5, ratingType: 'cinephile' },
  tomatoes: { source: RATING_SOURCES.RT_CRITICS, scale: 100, ratingType: 'critics' },
  rottentomatoes: { source: RATING_SOURCES.RT_CRITICS, scale: 100, ratingType: 'critics' },
  audience: { source: RATING_SOURCES.RT_AUDIENCE, scale: 100, ratingType: 'audience' },
  popcorn: { source: RATING_SOURCES.RT_AUDIENCE, scale: 100, ratingType: 'audience' },
  metacritic: { source: RATING_SOURCES.METACRITIC, scale: 100, ratingType: 'critics' },
  metacriticuser: { source: RATING_SOURCES.METACRITIC_USER, scale: 10, ratingType: 'audience' },
  rogerebert: { source: RATING_SOURCES.ROGER_EBERT, scale: 4, ratingType: 'critics' },
};

function sourceKey(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function firstDefined(payload,keys){for(const key of keys){const value=payload?.[key];if(value!==undefined&&value!==null&&value!=='')return value;}return null;}
function firstDefinedPath(payload,paths){for(const path of paths){let value=payload;for(const part of path.split('.'))value=value?.[part];if(value!==undefined&&value!==null&&value!=='')return value;}return null;}
function isoDate(value){if(!value)return null;const d=new Date(value);if(Number.isNaN(d.getTime()))return null;return d.toISOString().slice(0,10);}
function numeric(value){if(value===null||value===undefined||value==='')return null;const m=String(value).match(/\d+(?:\.\d+)?/);if(!m)return null;const n=Number(m[0]);return Number.isFinite(n)&&n>0?n:null;}
function nameOf(value){if(!value)return null;if(typeof value==='string')return value.trim()||null;if(typeof value==='object')return String(value.name||value.title||value.original_name||'').trim()||null;return null;}
function namesOf(value){const items=Array.isArray(value)?value:String(value||'').split(',');return items.map(nameOf).filter(Boolean);}
function imageOf(value){if(!value)return null;if(typeof value==='string')return value.trim()||null;if(typeof value==='object')return String(value.url||value.file_path||value.path||value.src||'').trim()||null;return null;}
function normalizeType(value){const raw=String(value||'').toLowerCase();if(['show','series','serie','tv','tvseries','tv series','miniseries','miniserie'].includes(raw))return 'Serie';if(['movie','film','pelicula','película'].includes(raw))return 'Película';return null;}
function mdbMediaType(mediaType){
  const raw=String(mediaType||'').trim().toLowerCase();
  const normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(['movie','film','pelicula','peliculas'].includes(normalized))return 'movie';
  if(['show','series','serie','tv','tvseries','tv series','miniseries','miniserie'].includes(normalized))return 'show';
  throw new Error(`Tipo de contenido no soportado por MDBList: ${mediaType||'vacío'}`);
}

export function parseMDBListRatings(payload){const ratings=Array.isArray(payload?.ratings)?payload.ratings:[],result=[];for(const item of ratings){const mapping=SOURCE_MAP[sourceKey(item?.source)];if(!mapping)continue;const rating=Number(item?.value??item?.rating);if(!Number.isFinite(rating))continue;const votesRaw=item?.votes??item?.vote_count??null,votes=votesRaw==null?null:Number(votesRaw);result.push({...mapping,rating,votes:Number.isFinite(votes)?votes:null,provider:'mdblist',rawPayload:item});}return result;}

// Solo persistimos extras confirmados en el payload real y de coste mínimo.
export function parseMDBListExtras(payload){
  const digitalRelease=isoDate(firstDefined(payload,['released_digital','digital_release','digitalRelease','releasedDigital']));
  return Object.fromEntries(Object.entries({digital_release:digitalRelease}).filter(([,value])=>value!==null));
}

// Metadata auxiliar para CALIDAD → Datos. Esta lectura es aditiva y no modifica el contrato
// existente de ratings: reutiliza el mismo payload y solo expone campos que realmente existan.
export function parseMDBListMetadata(payload){
  const directors=namesOf(firstDefinedPath(payload,['directors','director','credits.directors','crew.directors']));
  const cast=namesOf(firstDefinedPath(payload,['cast','actors','credits.cast']));
  const countries=namesOf(firstDefinedPath(payload,['countries','country','production_countries']));
  const genres=namesOf(firstDefinedPath(payload,['genres','genre']));
  const poster=imageOf(firstDefinedPath(payload,['poster','poster_url','posterUrl','images.poster','images.poster_url']));
  const backdrop=imageOf(firstDefinedPath(payload,['backdrop','backdrop_url','backdropUrl','fanart','fanart_url','fanartUrl','images.backdrop','images.fanart']));
  return {
    type:normalizeType(firstDefined(payload,['mediatype','media_type','mediaType','type'])),
    title:firstDefined(payload,['title','name']),
    original_title:firstDefined(payload,['original_title','originalTitle','original_name','originalName']),
    year:numeric(firstDefined(payload,['year','release_year','releaseYear'])),
    runtime:numeric(firstDefined(payload,['runtime','runtime_minutes','runtimeMinutes','episode_runtime','episodeRuntime','duration'])),
    country:countries.join(', ')||null,
    genres,
    overview:firstDefined(payload,['overview','description','plot','summary']),
    original_language:firstDefined(payload,['original_language','originalLanguage','language']),
    release_date:isoDate(firstDefined(payload,['release_date','releaseDate','released','release','premiered'])),
    poster,
    backdrop,
    director:directors[0]||null,
    cast,
  };
}

async function fetchMDBListPayload({imdbId,mediaType='movie',signal}={}){const apiKey=process.env.MDBLIST_API_KEY;if(!apiKey)throw new Error('MDBLIST_API_KEY no está configurada');const type=mdbMediaType(mediaType);const url=`https://api.mdblist.com/imdb/${type}/${encodeURIComponent(imdbId)}?apikey=${encodeURIComponent(apiKey)}`;const response=await fetch(url,{headers:{Accept:'application/json'},signal,cache:'no-store'});if(!response.ok){const body=await response.text().catch(()=>'');const error=new Error(`MDBList HTTP ${response.status}${body?`: ${body.slice(0,300)}`:''}`);error.status=response.status;throw error;}return response.json();}

export async function fetchMDBListRatings({imdbId,mediaType='movie',signal}={}){const payload=await fetchMDBListPayload({imdbId,mediaType,signal});return{payload,ratings:parseMDBListRatings(payload),extras:parseMDBListExtras(payload)};}
export async function fetchMDBListMetadata({imdbId,mediaType='movie',signal}={}){const payload=await fetchMDBListPayload({imdbId,mediaType,signal});return{payload,metadata:parseMDBListMetadata(payload)};}
