import 'server-only';
import {db} from './db';
import {PIKOQUALITY_ACTIVE_VERSION} from './pikoquality-version.mjs';

export async function getMovieDetailExtras(imdbId){
  const sql=db();
  const [copy]=await sql`
    SELECT pcs.rating_key,p.plex_title,p.added_at,
      pq.score,
      CASE pq.band
        WHEN 'honors' THEN 'excellent'
        WHEN 'outstanding' THEN 'excellent'
        WHEN 'notable' THEN 'very_good'
        WHEN 'good' THEN 'correct'
        WHEN 'sufficient' THEN 'improvable'
        WHEN 'fail' THEN 'deficient'
        ELSE pq.band
      END band,
      pq.band canonical_band,pq.formula_version,
      pm.resolution,pm.bitrate,pm.width,pm.height,pm.video_codec,pm.audio_codec,pm.audio_channels,
      pf.file_size_bytes,pf.file_path
    FROM plex_catalog_status pcs
    JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active AND p.item_type='movie'
    LEFT JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready'
    LEFT JOIN piko_quality pq ON pq.rating_key=p.rating_key
      AND pq.status='evaluated'
      AND pq.formula_version=${PIKOQUALITY_ACTIVE_VERSION}
      AND pq.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
    LEFT JOIN LATERAL(SELECT * FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1) pm ON true
    LEFT JOIN LATERAL(SELECT * FROM plex_files z WHERE z.rating_key=p.rating_key ORDER BY media_index,part_index LIMIT 1) pf ON true
    WHERE pcs.imdb_id=${imdbId} AND pcs.status='in_plex'
    ORDER BY p.added_at DESC NULLS LAST
    LIMIT 1`;
  return copy||null;
}
