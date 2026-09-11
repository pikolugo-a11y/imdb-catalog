export async function reconcileSeriesReferencesFromPlexCore(sql){
  const created=await sql`
    WITH plex_ids AS (
      SELECT p.rating_key,p.plex_title,p.plex_year,
        max(x.external_id) FILTER(WHERE x.provider='imdb') imdb_id,
        max(x.external_id) FILTER(WHERE x.provider='tmdb') tmdb_id,
        max(x.external_id) FILTER(WHERE x.provider='tvdb') tvdb_id
      FROM plex_items p LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key
      WHERE p.active AND p.item_type='show' GROUP BY p.rating_key,p.plex_title,p.plex_year
    )
    INSERT INTO series_reference(show_rating_key,tmdb_id,imdb_id,tvdb_id,title,original_title,year,reference_source,refreshed_at)
    SELECT p.rating_key,COALESCE(m.tmdb_id,p.tmdb_id),m.imdb_id,p.tvdb_id,COALESCE(m.title_es,m.title,p.plex_title),m.original_title,COALESCE(m.year,p.plex_year),CASE WHEN m.source_status->>'identity_mode'='tmdb_only' THEN 'tmdb_only_manual' ELSE 'lifecycle_intake' END,'1970-01-01'::timestamptz
    FROM plex_ids p
    JOIN movies m ON m.imdb_id=p.imdb_id AND m.type IN('Serie','Miniserie')
    LEFT JOIN identity_validation iv ON iv.imdb_id=m.imdb_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=m.imdb_id
    LEFT JOIN series_reference r ON r.show_rating_key=p.rating_key
    WHERE ex.imdb_id IS NULL AND r.show_rating_key IS NULL AND COALESCE(m.tmdb_id,p.tmdb_id) IS NOT NULL
      AND (m.source_status->>'identity_mode'='tmdb_only' OR iv.validation_status='valid')
    ON CONFLICT(show_rating_key) DO NOTHING
    RETURNING show_rating_key,imdb_id,tmdb_id,title,year`;

  const stale=await sql`
    WITH plex_ids AS (
      SELECT p.rating_key,p.plex_title,p.plex_year,
        max(x.external_id) FILTER(WHERE x.provider='imdb') imdb_id,
        max(x.external_id) FILTER(WHERE x.provider='tmdb') tmdb_id,
        max(x.external_id) FILTER(WHERE x.provider='tvdb') tvdb_id
      FROM plex_items p LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key
      WHERE p.active AND p.item_type='show' GROUP BY p.rating_key,p.plex_title,p.plex_year
    )
    SELECT r.show_rating_key,r.imdb_id old_imdb,r.tmdb_id old_tmdb,r.tvdb_id old_tvdb,
      CASE WHEN m.source_status->>'identity_mode'='tmdb_only' THEN r.imdb_id ELSE p.imdb_id END new_imdb,
      CASE WHEN m.source_status->>'identity_mode'='tmdb_only' THEN m.tmdb_id ELSE p.tmdb_id END new_tmdb,
      p.tvdb_id new_tvdb,p.plex_title,p.plex_year,m.source_status->>'identity_mode' identity_mode
    FROM series_reference r JOIN plex_ids p ON p.rating_key=r.show_rating_key
    JOIN movies m ON m.imdb_id=r.imdb_id
    WHERE (m.source_status->>'identity_mode'='tmdb_only' AND m.tmdb_id IS NOT NULL AND m.tmdb_id IS DISTINCT FROM r.tmdb_id)
       OR (COALESCE(m.source_status->>'identity_mode','normal')<>'tmdb_only' AND ((p.imdb_id IS NOT NULL AND p.imdb_id IS DISTINCT FROM r.imdb_id) OR (p.tmdb_id IS NOT NULL AND p.tmdb_id IS DISTINCT FROM r.tmdb_id)))
       OR (p.tvdb_id IS NOT NULL AND p.tvdb_id IS DISTINCT FROM r.tvdb_id)`;

  const changes=created.map(s=>({rating_key:s.show_rating_key,title:s.title,year:s.year,created:true,current:{imdb:s.imdb_id,tmdb:s.tmdb_id}}));
  for(const s of stale){
    await sql.transaction([
      sql`DELETE FROM series_reference_episodes WHERE show_rating_key=${s.show_rating_key}`,
      sql`DELETE FROM series_season_availability WHERE show_rating_key=${s.show_rating_key}`,
      sql`DELETE FROM series_diagnostics WHERE show_rating_key=${s.show_rating_key}`,
      sql`UPDATE series_reference SET imdb_id=COALESCE(${s.new_imdb},imdb_id),tmdb_id=COALESCE(${s.new_tmdb},tmdb_id),tvdb_id=COALESCE(${s.new_tvdb},tvdb_id),title=COALESCE(${s.plex_title},title),year=COALESCE(${s.plex_year},year),official_seasons=NULL,official_episodes=NULL,avg_runtime_minutes=NULL,reference_source=${s.identity_mode==='tmdb_only'?'tmdb_only_manual':'plex_identity_changed'},refreshed_at='1970-01-01'::timestamptz WHERE show_rating_key=${s.show_rating_key}`
    ]);
    changes.push({rating_key:s.show_rating_key,title:s.plex_title,year:s.plex_year,created:false,old:{imdb:s.old_imdb,tmdb:s.old_tmdb,tvdb:s.old_tvdb},current:{imdb:s.new_imdb,tmdb:s.new_tmdb,tvdb:s.new_tvdb}});
  }
  return changes;
}
