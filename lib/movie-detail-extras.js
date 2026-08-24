import 'server-only';
import {db} from './db';

export async function getMovieDetailExtras(imdbId){
  const sql=db();
  const [copy]=await sql`
    SELECT pcs.rating_key,p.plex_title,p.added_at,
      pq.score,pq.band,
      pm.resolution,pm.bitrate,pm.width,pm.height,pm.video_codec,pm.audio_codec,pm.audio_channels,
      pf.file_size_bytes,pf.file_path
    FROM plex_catalog_status pcs
    JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active AND p.item_type='movie'
    LEFT JOIN piko_quality pq ON pq.rating_key=p.rating_key
    LEFT JOIN LATERAL(SELECT * FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1) pm ON true
    LEFT JOIN LATERAL(SELECT * FROM plex_files z WHERE z.rating_key=p.rating_key ORDER BY media_index,part_index LIMIT 1) pf ON true
    WHERE pcs.imdb_id=${imdbId} AND pcs.status='in_plex'
    ORDER BY p.added_at DESC NULLS LAST
    LIMIT 1`;
  return copy||null;
}
