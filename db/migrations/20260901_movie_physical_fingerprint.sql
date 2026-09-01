-- Canonical physical-file fingerprint for MOV-001 freshness checks.
-- Keep this calculation inside PostgreSQL so persisted validations, Lifecycle
-- and Plex Sync use exactly the same Unicode/collation semantics.

CREATE OR REPLACE FUNCTION movie_physical_fingerprint(target_rating_key text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT md5(
    string_agg(
      lower(trim(COALESCE(pf.file_path, ''))) || '|' ||
      COALESCE(pf.file_size_bytes::text, '') || '|' ||
      COALESCE(
        pf.duration_ms::text,
        (
          SELECT pm.duration_ms::text
          FROM plex_media pm
          WHERE pm.rating_key = pf.rating_key
            AND pm.media_index = pf.media_index
          ORDER BY pm.media_index
          LIMIT 1
        ),
        ''
      ) || '|' ||
      COALESCE(pf.plex_part_id, ''),
      ','
      ORDER BY
        pf.media_index,
        pf.part_index,
        lower(trim(COALESCE(pf.file_path, ''))) || '|' ||
        COALESCE(pf.file_size_bytes::text, '') || '|' ||
        COALESCE(
          pf.duration_ms::text,
          (
            SELECT pm.duration_ms::text
            FROM plex_media pm
            WHERE pm.rating_key = pf.rating_key
              AND pm.media_index = pf.media_index
            ORDER BY pm.media_index
            LIMIT 1
          ),
          ''
        ) || '|' ||
        COALESCE(pf.plex_part_id, '')
    )
  )
  FROM plex_files pf
  WHERE pf.rating_key = target_rating_key
    AND COALESCE(pf.exists_on_server, true) <> false;
$$;
