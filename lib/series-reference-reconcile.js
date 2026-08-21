import 'server-only';

export async function reconcileSeriesReferencesFromPlex(sql){
  const created=await sql`
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
    INSERT INTO series_reference(show_rating_key,tmdb_id,imdb_id,tvdb_id,title,original_title,year,reference_source,refreshed_at)
    SELECT p.rating_key,COALESCE(m.tmdb_id,p.tmdb_id),m.imdb_id,p.tvdb_id,COALESCE(m.title_es,m.title,p.plex_title),m.original_title,COALESCE(m.year,p.plex_year),'lifecycle_intake','1970-01-01'::timestamptz
    FROM plex_ids p
    JOIN movies m ON m.imdb_id=p.imdb_id AND m.type IN('Serie','Miniserie')
    JOIN identity_validation iv ON iv.imdb_id=m.imdb_id AND iv.validation_status='valid'
    LEFT JOIN movie_metadata mm ON mm.imdb_id=m.imdb_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=m.imdb_id
    LEFT JOIN series_reference r ON r.show_rating_key=p.rating_key
    WHERE ex.imdb_id IS NULL AND r.show_rating_key IS NULL AND COALESCE(m.tmdb_id,p.tmdb_id) IS NOT NULL AND m.fa_id IS NOT NULL
      AND m.title_es IS NOT NULL AND btrim(m.title_es)<>'' AND m.original_title IS NOT NULL AND btrim(m.original_title)<>'' AND m.year>1800
      AND m.imdb_rating>0 AND m.imdb_votes>0 AND m.fa_rating>0 AND m.fa_votes>0 AND m.tmdb_rating>0 AND m.tmdb_votes>0 AND m.final_rating>0
      AND m.runtime>0 AND m.country IS NOT NULL AND btrim(m.country)<>'' AND mm.overview IS NOT NULL AND btrim(mm.overview)<>'' AND mm.release_date IS NOT NULL
      AND (m.poster_path IS NOT NULL OR COALESCE(m.source_status #>> '{data_quality_external_poster,url}','')<>'')
      AND EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id)
      AND (EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='crew' AND c.job='Director') OR COALESCE(m.source_status #>> '{data_quality_external_director,value}','')<>'')
      AND (EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='cast') OR COALESCE(m.source_status #>> '{data_quality_external_cast,value}','')<>'')
    ON CONFLICT(show_rating_key) DO NOTHING
    RETURNING show_rating_key,imdb_id,tmdb_id,title,year`;

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
    FROM series_reference r
    JOIN plex_ids p ON p.rating_key=r.show_rating_key
    WHERE (p.imdb_id IS NOT NULL AND p.imdb_id IS DISTINCT FROM r.imdb_id)
       OR (p.tmdb_id IS NOT NULL AND p.tmdb_id IS DISTINCT FROM r.tmdb_id)
       OR (p.tvdb_id IS NOT NULL AND p.tvdb_id IS DISTINCT FROM r.tvdb_id)`;

  const changes=created.map(s=>({rating_key:s.show_rating_key,title:s.title,year:s.year,created:true,current:{imdb:s.imdb_id,tmdb:s.tmdb_id}}));
  for(const s of stale){
    await sql.transaction([
      sql`DELETE FROM series_reference_episodes WHERE show_rating_key=${s.show_rating_key}`,
      sql`DELETE FROM series_season_availability WHERE show_rating_key=${s.show_rating_key}`,
      sql`DELETE FROM series_diagnostics WHERE show_rating_key=${s.show_rating_key}`,
      sql`UPDATE series_reference SET
        imdb_id=COALESCE(${s.new_imdb},imdb_id),
        tmdb_id=COALESCE(${s.new_tmdb},tmdb_id),
        tvdb_id=COALESCE(${s.new_tvdb},tvdb_id),
        title=COALESCE(${s.plex_title},title),
        year=COALESCE(${s.plex_year},year),
        official_seasons=NULL,
        official_episodes=NULL,
        avg_runtime_minutes=NULL,
        reference_source='plex_identity_changed',
        refreshed_at='1970-01-01'::timestamptz
      WHERE show_rating_key=${s.show_rating_key}`
    ]);
    changes.push({rating_key:s.show_rating_key,title:s.plex_title,year:s.plex_year,created:false,old:{imdb:s.old_imdb,tmdb:s.old_tmdb,tvdb:s.old_tvdb},current:{imdb:s.new_imdb,tmdb:s.new_tmdb,tvdb:s.new_tvdb}});
  }
  return changes;
}
