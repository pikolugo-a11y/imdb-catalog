import 'server-only';
import {db} from './db';

export const PROCESS_OBSERVABILITY_RETENTION_DAYS=30;

export async function purgeTerminalProcessObservability(){
  const sql=db();
  const rows=await sql.query(`
    DELETE FROM process_runs r
    WHERE r.requested_at<now()-($1::int*interval '1 day')
      AND r.technical_status IN ('succeeded','failed','partial','cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM batch_run_control brc
        WHERE brc.run_id=r.run_id AND brc.closed_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM batch_run_items bi
        WHERE bi.batch_run_id=r.run_id
          AND bi.status IN ('queued','retry_wait','leased','running')
      )
      AND NOT EXISTS (
        SELECT 1 FROM batch_run_items bi
        WHERE bi.child_run_id=r.run_id
          AND bi.status IN ('queued','retry_wait','leased','running')
      )
      AND NOT EXISTS (
        SELECT 1 FROM process_runs child
        WHERE child.parent_run_id=r.run_id
          AND child.technical_status IN ('queued','running')
      )
    RETURNING r.run_id
  `,[PROCESS_OBSERVABILITY_RETENTION_DAYS]);
  return rows.length;
}
