CREATE OR REPLACE VIEW series_episode_effective_status AS
WITH base AS (
  SELECT
    d.show_rating_key,
    d.season_number,
    d.episode_number,
    d.status AS plex_diagnostic_status,
    d.confidence AS plex_confidence,
    d.reason,
    d.covered_by_rating_key,
    d.expected_name,
    d.expected_runtime_minutes,
    d.actual_duration_minutes,
    r.air_date,
    ea.country_code AS episode_country_code,
    ea.availability_status AS episode_status,
    ea.available_from AS episode_available_from,
    ea.source AS episode_source,
    ea.confidence AS episode_confidence,
    ea.checked_at AS episode_checked_at,
    sa.status AS season_status,
    sa.available_from AS season_available_from,
    sa.source AS season_source,
    sa.confidence AS season_confidence,
    sa.checked_at AS season_checked_at,
    o.decision AS episode_override_decision,
    o.note AS episode_override_note,
    o.updated_at AS episode_override_updated_at
  FROM series_diagnostics d
  LEFT JOIN series_reference_episodes r
    ON r.show_rating_key=d.show_rating_key
   AND r.season_number=d.season_number
   AND r.episode_number=d.episode_number
  LEFT JOIN series_episode_availability ea
    ON ea.show_rating_key=d.show_rating_key
   AND ea.season_number=d.season_number
   AND ea.episode_number=d.episode_number
   AND ea.country_code='ES'
  LEFT JOIN series_season_availability sa
    ON sa.show_rating_key=d.show_rating_key
   AND sa.season_number=d.season_number
   AND sa.country_code='ES'
  LEFT JOIN series_episode_overrides o
    ON o.show_rating_key=d.show_rating_key
   AND o.season_number=d.season_number
   AND o.episode_number=d.episode_number
), resolved AS (
  SELECT
    b.*,
    COALESCE(
      b.episode_status,
      CASE b.season_status
        WHEN 'ES_AVAILABLE' THEN 'available'
        WHEN 'EXCEPTION_AVAILABLE' THEN 'available'
        WHEN 'ES_NOT_YET' THEN 'not_yet_available'
        WHEN 'EXCEPTION_NOT_AVAILABLE' THEN 'not_yet_available'
        WHEN 'ES_PARTIAL' THEN CASE WHEN b.air_date IS NOT NULL AND b.air_date<=CURRENT_DATE THEN 'available' ELSE 'not_yet_available' END
        ELSE 'unknown'
      END,
      'unknown'
    ) AS effective_availability,
    COALESCE(b.episode_available_from,b.season_available_from) AS effective_available_from,
    COALESCE(b.episode_source,b.season_source) AS effective_source,
    COALESCE(b.episode_confidence,b.season_confidence,'unknown') AS effective_confidence,
    COALESCE(b.episode_checked_at,b.season_checked_at) AS effective_checked_at
  FROM base b
)
SELECT
  show_rating_key,
  season_number,
  episode_number,
  plex_diagnostic_status,
  plex_confidence,
  reason,
  covered_by_rating_key,
  expected_name,
  expected_runtime_minutes,
  actual_duration_minutes,
  air_date,
  'ES'::text AS country_code,
  effective_availability AS availability_status,
  effective_available_from AS available_from,
  effective_source AS availability_source,
  effective_confidence AS availability_confidence,
  effective_checked_at AS availability_checked_at,
  CASE
    WHEN episode_override_decision='unavailable' THEN 'present'
    WHEN plex_diagnostic_status IN ('present','covered_combined') THEN 'present'
    WHEN plex_diagnostic_status='missing' AND effective_availability='available' THEN 'missing_actionable'
    WHEN plex_diagnostic_status='missing' AND effective_availability='not_yet_available' THEN 'not_available_es'
    WHEN plex_diagnostic_status='missing' THEN 'availability_unknown'
    ELSE 'review'
  END AS effective_status,
  episode_override_decision,
  episode_override_note,
  episode_override_updated_at
FROM resolved;
