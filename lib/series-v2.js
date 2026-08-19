import 'server-only';
import {db} from './db';
import {startRun,finishRun,errorInfo} from './runlog';
const api='https://api.themoviedb.org/3';
async function tmdb(path){const token=process.env.TMDB_API_TOKEN;if(!token)throw new Error('TMDB_API_TOKEN no está configurado');const r=await fetch(`${api}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error(`TMDb ${r.status}: ${path}`);return r.json()}
const today=()=>new Date().toISOString().slice(0,10);
async function pool(items,n,fn){let i=0;const out=[];await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const x=items[i++];try{out.push(await fn(x))}catch(e){out.push({error:e,item:x})}}}));return out}

async function reconcileSeriesIdentities(sql){
  const stale=await sql`
    WITH plex_ids AS (
      SELECT p.rating_key,p.plex_title,p.plex_year,
        max(x.external_id) FILTER(WHERE x.provider='imdb') imdb_id,
        max(x.external_id) FILTER(WHERE x.provider='tmdb') tmdb_id,
        max(x.external_id) FILTER(WHERE x.provider='tvdb') tvdb_id
      FROM plex_items p
      LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key
      WHERE p.active AND p.item_type='show'
      GROUP BY p.rating_key,p.plex_title,p.plex_year
    )
    SELECT r.show_rating_key,r.imdb_id old_imdb,r.tmdb_id old_tmdb,r.tvdb_id old_tvdb,
      p.imdb_id new_imdb,p.tmdb_id new_tmdb,p.tvdb_id new_tvdb,p.plex_title,p.plex_year
    FROM series_reference r JOIN plex_ids p ON p.rating_key=r.show_rating_key
    WHERE (p.imdb_id IS NOT NULL AND p.imdb_id IS DISTINCT FROM r.imdb_id)
       OR (p.tmdb_id IS NOT NULL AND p.tmdb_id IS DISTINCT FROM r.tmdb_id)
       OR (p.tvdb_id IS NOT NULL AND p.tvdb_id IS DISTINCT FROM r.tvdb_id)`;
  const changes=[];
  for(const s of stale){
    await sql.transaction([
      sql`DELETE FROM series_reference_episodes WHERE show_rating_key=${s.show_rating_key}`,
      sql`DELETE FROM series_season_availability WHERE show_rating_key=${s.show_rating_key}`,
      sql`DELETE FROM series_diagnostics WHERE show_rating_key=${s.show_rating_key}`,
      sql`UPDATE series_reference SET imdb_id=COALESCE(${s.new_imdb},imdb_id),tmdb_id=COALESCE(${s.new_tmdb},tmdb_id),tvdb_id=COALESCE(${s.new_tvdb},tvdb_id),title=COALESCE(${s.plex_title},title),year=COALESCE(${s.plex_year},year),official_seasons=NULL,official_episodes=NULL,avg_runtime_minutes=NULL,reference_source='plex_identity_rebuild',refreshed_at='1970-01-01'::timestamptz WHERE show_rating_key=${s.show_rating_key}`
    ]);
    changes.push({rating_key:s.show_rating_key,title:s.plex_title,year:s.plex_year,old:{imdb:s.old_imdb,tmdb:s.old_tmdb,tvdb:s.old_tvdb},current:{imdb:s.new_imdb,tmdb:s.new_tmdb,tvdb:s.new_tvdb}});
  }
  return changes;
}

export async function refreshSeriesV2({limit=120}={}){const sql=db(),run=await startRun('series_v2_refresh','web',{stage:'identity_reconcile'});try{
  const identityChanges=await reconcileSeriesIdentities(sql);
  const shows=await sql`SELECT r.show_rating_key,r.tmdb_id,r.title,r.year,r.refreshed_at FROM series_reference r LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id WHERE r.tmdb_id IS NOT NULL AND ex.imdb_id IS NULL ORDER BY CASE WHEN r.refreshed_at<'2000-01-01'::timestamptz THEN 0 WHEN r.refreshed_at IS NULL THEN 1 ELSE 2 END,r.refreshed_at ASC LIMIT ${limit}`;
  let seasons=0,episodes=0,errors=0,available=0,partial=0,unknown=0,notYet=0;
  const results=await pool(shows,6,async s=>{const d=await tmdb(`/tv/${s.tmdb_id}?language=es-ES&append_to_response=watch/providers`),providers=d['watch/providers']?.results?.ES,hasEs=Boolean(providers&&(providers.flatrate?.length||providers.buy?.length||providers.rent?.length||providers.free?.length||providers.ads?.length));const eps=[];
    for(const season of(d.seasons||[]).filter(x=>x.season_number>0)){const sd=await tmdb(`/tv/${s.tmdb_id}/season/${season.season_number}?language=es-ES`);seasons++;const air=(sd.episodes||[]).map(x=>x.air_date).filter(Boolean).sort(),past=(sd.episodes||[]).filter(x=>x.air_date&&x.air_date<=today()),future=(sd.episodes||[]).filter(x=>x.air_date&&x.air_date>today());let status='UNKNOWN',confidence='unknown';if(hasEs&&past.length){status=future.length?'ES_PARTIAL':'ES_AVAILABLE';confidence='medium'}else if(air.length&&air[0]>today()){status='ES_NOT_YET';confidence='high'}
      if(status==='ES_AVAILABLE')available++;else if(status==='ES_PARTIAL')partial++;else if(status==='ES_NOT_YET')notYet++;else unknown++;
      await sql`INSERT INTO series_season_availability(show_rating_key,season_number,country_code,status,available_from,source,confidence,manual_override,checked_at,note) VALUES(${s.show_rating_key},${season.season_number},'ES',${status},${air[0]||null},'tmdb_watch_providers',${confidence},false,now(),${hasEs?'Proveedor ES detectado':'Sin evidencia suficiente de distribución ES'}) ON CONFLICT(show_rating_key,season_number,country_code) DO UPDATE SET status=CASE WHEN series_season_availability.manual_override THEN series_season_availability.status ELSE EXCLUDED.status END,available_from=CASE WHEN series_season_availability.manual_override THEN series_season_availability.available_from ELSE EXCLUDED.available_from END,source=CASE WHEN series_season_availability.manual_override THEN series_season_availability.source ELSE EXCLUDED.source END,confidence=CASE WHEN series_season_availability.manual_override THEN series_season_availability.confidence ELSE EXCLUDED.confidence END,checked_at=now(),note=CASE WHEN series_season_availability.manual_override THEN series_season_availability.note ELSE EXCLUDED.note END`;
      for(const e of sd.episodes||[]){episodes++;eps.push(sql`INSERT INTO series_reference_episodes(show_rating_key,season_number,episode_number,tmdb_episode_id,name,overview,air_date,runtime_minutes) VALUES(${s.show_rating_key},${season.season_number},${e.episode_number},${String(e.id)},${e.name||null},${e.overview||null},${e.air_date||null},${e.runtime||null}) ON CONFLICT(show_rating_key,season_number,episode_number) DO UPDATE SET tmdb_episode_id=EXCLUDED.tmdb_episode_id,name=EXCLUDED.name,overview=EXCLUDED.overview,air_date=EXCLUDED.air_date,runtime_minutes=EXCLUDED.runtime_minutes`)}
    }
    if(eps.length)for(let j=0;j<eps.length;j+=100)await sql.transaction(eps.slice(j,j+100));await sql`UPDATE series_reference SET title=COALESCE(${d.name||null},title),original_title=COALESCE(${d.original_name||null},original_title),year=COALESCE(${Number(String(d.first_air_date||'').slice(0,4))||null},year),official_seasons=${(d.seasons||[]).filter(x=>x.season_number>0).length},official_episodes=${Number(d.number_of_episodes||0)},reference_source='tmdb',refreshed_at=now() WHERE show_rating_key=${s.show_rating_key}`;return{ok:true}}
  );
  errors=results.filter(x=>x?.error).length;
  const[anomalyStats]=await sql`WITH x AS (SELECT r.show_rating_key,r.official_episodes,count(p.*) FILTER(WHERE ref.show_rating_key IS NULL)::int extras FROM series_reference r LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id LEFT JOIN plex_items p ON p.grandparent_rating_key=r.show_rating_key AND p.active AND p.item_type='episode' LEFT JOIN series_reference_episodes ref ON ref.show_rating_key=r.show_rating_key AND ref.season_number=p.parent_index AND ref.episode_number=p.item_index WHERE ex.imdb_id IS NULL GROUP BY r.show_rating_key,r.official_episodes) SELECT count(*) FILTER(WHERE extras>0)::int anomaly_series,COALESCE(sum(extras),0)::int unmatched_episodes,count(*) FILTER(WHERE extras>0 AND official_episodes>0 AND extras::numeric/official_episodes>=.2)::int high_risk_series FROM x`;
  const anomalies=anomalyStats?.anomaly_series||0;
  await finishRun(run.id,'success',{processed:shows.length,updated:identityChanges.length,errors,summary:{stage:'done',series_reviewed:shows.length,seasons,episodes,identity_rebuilt:identityChanges.length,identity_changes:identityChanges.slice(0,25),availability:{available,partial,not_yet:notYet,unknown},anomalies:{series:anomalies,unmatched_episodes:anomalyStats?.unmatched_episodes||0,high_risk_series:anomalyStats?.high_risk_series||0},errors}});
  return{series:shows.length,seasons,episodes,available,partial,notYet,unknown,identityRebuilt:identityChanges.length,anomalies,unmatchedEpisodes:anomalyStats?.unmatched_episodes||0,errors};
}catch(e){await finishRun(run.id,'failed',{errors:1,summary:{stage:'failed',error:errorInfo(e)}});throw e}}

export async function setSeasonAvailability(showRatingKey,seasonNumber,available){const sql=db(),status=available?'EXCEPTION_AVAILABLE':'EXCEPTION_NOT_AVAILABLE';await sql`INSERT INTO series_season_availability(show_rating_key,season_number,country_code,status,source,confidence,manual_override,checked_at,note) VALUES(${showRatingKey},${seasonNumber},'ES',${status},'manual','high',true,now(),'Confirmado manualmente') ON CONFLICT(show_rating_key,season_number,country_code) DO UPDATE SET status=EXCLUDED.status,source='manual',confidence='high',manual_override=true,checked_at=now(),note='Confirmado manualmente'`}
