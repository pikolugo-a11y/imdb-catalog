import 'server-only';
import {db} from './db';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';
import {reconcileSeriesReferencesFromPlex} from './series-reference-reconcile';
import {rebuildSeriesDiagnostics} from './series-diagnostics-core.mjs';

const API='https://api.themoviedb.org/3';
const today=()=>new Date().toISOString().slice(0,10);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function tmdb(path,attempt=0){
  const token=process.env.TMDB_API_TOKEN;
  if(!token)throw new Error('TMDB_API_TOKEN no configurado');
  const r=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});
  if(r.ok)return r.json();
  if((r.status===429||r.status>=500)&&attempt<3){const wait=Number(r.headers.get('retry-after')||0)*1000||500*(2**attempt);await sleep(wait);return tmdb(path,attempt+1)}
  throw new Error(`TMDb respondió ${r.status}`);
}

export async function refreshSeriesUnitary({imdbId=null,ratingKey=null}={}){
  if(!imdbId&&!ratingKey)throw new Error('Falta identificar la serie');
  const sql=db();
  await reconcileSeriesReferencesFromPlex(sql);
  const [s]=ratingKey
    ?await sql`SELECT r.show_rating_key,r.imdb_id,r.tmdb_id,r.title,r.year FROM series_reference r JOIN identity_validation iv ON iv.imdb_id=r.imdb_id AND iv.validation_status='valid' LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id WHERE r.show_rating_key=${String(ratingKey)} AND ex.imdb_id IS NULL LIMIT 1`
    :await sql`SELECT r.show_rating_key,r.imdb_id,r.tmdb_id,r.title,r.year FROM series_reference r JOIN identity_validation iv ON iv.imdb_id=r.imdb_id AND iv.validation_status='valid' LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id WHERE r.imdb_id=${String(imdbId)} AND ex.imdb_id IS NULL LIMIT 1`;
  if(!s)throw new Error('La serie no está preparada para esta fase');
  if(!s.tmdb_id)throw new Error('La serie no tiene TMDb ID');
  await audit('quality','series',s.imdb_id,'unitary_refresh_started',{rating_key:s.show_rating_key,tmdb_id:s.tmdb_id});
  try{
    const d=await tmdb(`/tv/${s.tmdb_id}?language=es-ES&append_to_response=watch/providers`);
    const providers=d['watch/providers']?.results?.ES;
    const hasEs=Boolean(providers&&(providers.flatrate?.length||providers.buy?.length||providers.rent?.length||providers.free?.length||providers.ads?.length));
    const seasons=(d.seasons||[]).filter(x=>x.season_number>0);
    const episodes=[];
    for(const season of seasons){
      const sd=await tmdb(`/tv/${s.tmdb_id}/season/${season.season_number}?language=es-ES`);
      const arr=sd.episodes||[];
      const air=arr.map(x=>x.air_date).filter(Boolean).sort();
      const past=arr.filter(x=>x.air_date&&x.air_date<=today());
      const future=arr.filter(x=>x.air_date&&x.air_date>today());
      let status='UNKNOWN',confidence='unknown';
      if(hasEs&&past.length){status=future.length?'ES_PARTIAL':'ES_AVAILABLE';confidence='medium'}
      else if(air.length&&air[0]>today()){status='ES_NOT_YET';confidence='high'}
      await sql`INSERT INTO series_season_availability(show_rating_key,season_number,country_code,status,available_from,source,confidence,manual_override,checked_at,note) VALUES(${s.show_rating_key},${season.season_number},'ES',${status},${air[0]||null},'tmdb_watch_providers',${confidence},false,now(),${hasEs?'Proveedor ES detectado':'Sin evidencia suficiente de distribución ES'}) ON CONFLICT(show_rating_key,season_number,country_code) DO UPDATE SET status=CASE WHEN series_season_availability.manual_override THEN series_season_availability.status ELSE EXCLUDED.status END,available_from=CASE WHEN series_season_availability.manual_override THEN series_season_availability.available_from ELSE EXCLUDED.available_from END,source=CASE WHEN series_season_availability.manual_override THEN series_season_availability.source ELSE EXCLUDED.source END,confidence=CASE WHEN series_season_availability.manual_override THEN series_season_availability.confidence ELSE EXCLUDED.confidence END,checked_at=now(),note=CASE WHEN series_season_availability.manual_override THEN series_season_availability.note ELSE EXCLUDED.note END`;
      for(const e of arr)episodes.push({show_rating_key:s.show_rating_key,season_number:season.season_number,episode_number:e.episode_number,tmdb_episode_id:String(e.id),name:e.name||null,overview:e.overview||null,air_date:e.air_date||null,runtime_minutes:e.runtime||null});
    }
    await sql`DELETE FROM series_reference_episodes WHERE show_rating_key=${s.show_rating_key}`;
    for(let i=0;i<episodes.length;i+=200){
      const payload=JSON.stringify(episodes.slice(i,i+200));
      await sql`INSERT INTO series_reference_episodes(show_rating_key,season_number,episode_number,tmdb_episode_id,name,overview,air_date,runtime_minutes) SELECT x.show_rating_key,x.season_number,x.episode_number,x.tmdb_episode_id,x.name,x.overview,x.air_date::date,x.runtime_minutes FROM jsonb_to_recordset(${payload}::jsonb) AS x(show_rating_key text,season_number int,episode_number int,tmdb_episode_id text,name text,overview text,air_date text,runtime_minutes int)`;
    }
    await sql`UPDATE series_reference SET title=COALESCE(${d.name||null},title),original_title=COALESCE(${d.original_name||null},original_title),year=COALESCE(${Number(String(d.first_air_date||'').slice(0,4))||null},year),official_seasons=${seasons.length},official_episodes=${Number(d.number_of_episodes||episodes.length||0)},reference_source='tmdb',refreshed_at=now() WHERE show_rating_key=${s.show_rating_key}`;
    const diagnostics=await rebuildSeriesDiagnostics(sql,s.show_rating_key);
    const lifecycle=(await recomputeLifecycleForIds([s.imdb_id])).get(s.imdb_id);
    await audit('quality','series',s.imdb_id,'unitary_refresh_completed',{rating_key:s.show_rating_key,seasons:seasons.length,episodes:episodes.length,diagnostics,lifecycle:lifecycle?.state});
    return{ok:true,imdbId:s.imdb_id,ratingKey:s.show_rating_key,seasons:seasons.length,episodes:episodes.length,diagnostics,lifecycle};
  }catch(e){
    await audit('quality','series',s.imdb_id,'unitary_refresh_failed',{rating_key:s.show_rating_key,error:e?.message||String(e)});
    throw e;
  }
}
