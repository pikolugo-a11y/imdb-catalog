import 'server-only';
import {db} from './db';

export const PROCESS_PLAN_RETENTION_DAYS=30;

export async function purgeTerminalProcessPlans(){
  const sql=db();
  const rows=await sql.query(`DELETE FROM process_plans WHERE status IN ('completed','cancelled','expired') AND updated_at<now()-($1::int*interval '1 day') RETURNING plan_id`,[PROCESS_PLAN_RETENTION_DAYS]);
  return rows.length;
}
