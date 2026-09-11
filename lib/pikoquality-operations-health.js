import 'server-only';
import {db} from './db';

export async function getPikoQualityOperationsHealth(sql=db()){
  const [row]=await sql`
    SELECT
      count(*)::int AS physical_total,
      count(*) FILTER(WHERE s.snapshot_status='ready' AND s.technical_fingerprint IS NOT NULL)::int AS technical_ready,
      count(*) FILTER(WHERE NOT COALESCE(s.snapshot_status='ready' AND s.technical_fingerprint IS NOT NULL,false))::int AS capture_pending,
      count(*) FILTER(WHERE s.snapshot_status='error')::int AS capture_errors
    FROM plex_items p
    LEFT JOIN plex_technical_state s USING(rating_key)
    WHERE p.active AND p.item_type IN('movie','episode')
  `;
  return{
    physicalTotal:Number(row?.physical_total||0),
    technicalReady:Number(row?.technical_ready||0),
    capturePending:Number(row?.capture_pending||0),
    captureErrors:Number(row?.capture_errors||0),
  };
}
