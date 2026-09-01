export async function rebuildSeriesQualityReadModelForRatingKey(sql,ratingKey){
  const key=String(ratingKey||'').trim();
  if(!key)throw new Error('Falta ratingKey para refrescar el read model de Series');
  await sql`WITH ec AS (
    SELECT show_rating_key,
      count(*) FILTER(WHERE effective_status='present')::int present,
      count(*) FILTER(WHERE effective_status='missing_actionable')::int actionable_missing,
      count(*) FILTER(WHERE effective_status='availability_unknown')::int availability_unknown,
      count(*) FILTER(WHERE effective_status='not_available_es')::int not_available_es
    FROM series_episode_effective_status
    WHERE show_rating_key=${key}
    GROUP BY show_rating_key
  ), px AS (
    SELECT p.grandparent_rating_key show_rating_key,
      count(*)::int plex_episodes,
      count(*) FILTER(WHERE ref.show_rating_key IS NULL AND NOT EXISTS(
        SELECT 1 FROM series_diagnostics d
        WHERE d.show_rating_key=p.grandparent_rating_key
          AND p.rating_key=ANY(string_to_array(COALESCE(d.covered_by_rating_key,''),','))
      ))::int unmapped
    FROM plex_items p
    LEFT JOIN series_reference_episodes ref
      ON ref.show_rating_key=p.grandparent_rating_key
      AND ref.season_number=p.parent_index
      AND ref.episode_number=p.item_index
    WHERE p.active AND p.item_type='episode' AND p.grandparent_rating_key=${key}
    GROUP BY p.grandparent_rating_key
  )
  INSERT INTO series_quality_read_model(
    show_rating_key,imdb_id,title,year,poster_path,lifecycle_state,blocking_reason,
    has_reference,pre_quality_pending,plex_detail_trusted,plex_changed,refreshed_at,next_check_at,
    reference_invalidated,reference_invalid_reason,tmdb_status,first_air_date,last_air_date,next_air_date,
    official_seasons,official_episodes,present,actionable_missing,availability_unknown,not_available_es,
    unmapped_plex_episodes,plex_episodes,updated_at
  )
  SELECT p.rating_key,COALESCE(sr.imdb_id,x.external_id),COALESCE(sr.title,p.plex_title),COALESCE(sr.year,p.plex_year),
    crm.poster_path,cl.lifecycle_state,cl.blocking_reason,(sr.show_rating_key IS NOT NULL),(sr.show_rating_key IS NULL),
    (sr.plex_detail_refreshed_at IS NOT NULL AND sr.plex_invalidated_at IS NULL),(sr.plex_invalidated_at IS NOT NULL),
    sr.refreshed_at,sr.next_check_at,(sr.plex_invalidated_at IS NOT NULL),sr.plex_invalid_reason,sr.tmdb_status,
    sr.first_air_date,sr.last_air_date,sr.next_air_date,sr.official_seasons,sr.official_episodes,
    COALESCE(ec.present,0),COALESCE(ec.actionable_missing,0),COALESCE(ec.availability_unknown,0),COALESCE(ec.not_available_es,0),
    COALESCE(px.unmapped,0),COALESCE(px.plex_episodes,0),now()
  FROM plex_items p
  LEFT JOIN series_reference sr ON sr.show_rating_key=p.rating_key
  LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb'
  LEFT JOIN catalog_lifecycle cl ON cl.imdb_id=COALESCE(sr.imdb_id,x.external_id)
  LEFT JOIN catalog_read_model crm ON crm.imdb_id=COALESCE(sr.imdb_id,x.external_id)
  LEFT JOIN ec ON ec.show_rating_key=p.rating_key
  LEFT JOIN px ON px.show_rating_key=p.rating_key
  WHERE p.active AND p.item_type='show' AND p.rating_key=${key}
  ON CONFLICT(show_rating_key) DO UPDATE SET
    imdb_id=EXCLUDED.imdb_id,title=EXCLUDED.title,year=EXCLUDED.year,poster_path=EXCLUDED.poster_path,
    lifecycle_state=EXCLUDED.lifecycle_state,blocking_reason=EXCLUDED.blocking_reason,has_reference=EXCLUDED.has_reference,
    pre_quality_pending=EXCLUDED.pre_quality_pending,plex_detail_trusted=EXCLUDED.plex_detail_trusted,plex_changed=EXCLUDED.plex_changed,
    refreshed_at=EXCLUDED.refreshed_at,next_check_at=EXCLUDED.next_check_at,reference_invalidated=EXCLUDED.reference_invalidated,
    reference_invalid_reason=EXCLUDED.reference_invalid_reason,tmdb_status=EXCLUDED.tmdb_status,first_air_date=EXCLUDED.first_air_date,
    last_air_date=EXCLUDED.last_air_date,next_air_date=EXCLUDED.next_air_date,official_seasons=EXCLUDED.official_seasons,
    official_episodes=EXCLUDED.official_episodes,present=EXCLUDED.present,actionable_missing=EXCLUDED.actionable_missing,
    availability_unknown=EXCLUDED.availability_unknown,not_available_es=EXCLUDED.not_available_es,
    unmapped_plex_episodes=EXCLUDED.unmapped_plex_episodes,plex_episodes=EXCLUDED.plex_episodes,updated_at=now()`;
}
