import 'server-only';
import {db} from './db';

export async function getCatalogSeriesProfile(imdbId){
  const sql=db();
  const[row]=await sql`SELECT m.imdb_id,
    COALESCE(sr.official_seasons,NULLIF(m.source_status #>> '{series_profile,seasons}','')::int) official_seasons,
    COALESCE(sr.official_episodes,NULLIF(m.source_status #>> '{series_profile,episodes}','')::int) official_episodes,
    m.source_status #>> '{series_profile,status}' tmdb_status,
    COALESCE(m.source_status #>> '{series_profile,spain,streaming}','false')='true' spain_streaming,
    COALESCE(m.source_status #> '{series_profile,spain,providers}','[]'::jsonb) spain_providers,
    NULLIF(m.source_status #>> '{series_profile,checked_at}','')::timestamptz profile_checked_at,
    sr.show_rating_key,sr.diagnosed,sr.present,sr.missing,sr.unknown,sr.not_available_es
  FROM movies m
  LEFT JOIN LATERAL(
    SELECT r.show_rating_key,max(r.official_seasons)::int official_seasons,max(r.official_episodes)::int official_episodes,
      count(e.*)::int diagnosed,count(e.*) FILTER(WHERE e.effective_status='present')::int present,
      count(e.*) FILTER(WHERE e.effective_status='missing_actionable')::int missing,
      count(e.*) FILTER(WHERE e.effective_status='availability_unknown')::int unknown,
      count(e.*) FILTER(WHERE e.effective_status='not_available_es')::int not_available_es
    FROM series_reference r LEFT JOIN series_episode_effective_status e ON e.show_rating_key=r.show_rating_key
    WHERE r.imdb_id=m.imdb_id GROUP BY r.show_rating_key ORDER BY count(e.*) DESC LIMIT 1
  ) sr ON true
  WHERE m.imdb_id=${imdbId} AND m.type IN ('Serie','Miniserie') LIMIT 1`;
  if(!row)return null;
  return{...row,official_seasons:Number(row.official_seasons||0)||null,official_episodes:Number(row.official_episodes||0)||null,spain_providers:Array.isArray(row.spain_providers)?row.spain_providers:[]};
}
