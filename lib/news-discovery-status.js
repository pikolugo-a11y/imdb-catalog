import 'server-only';
import {db} from './db';

const WEEK_MS=7*24*60*60*1000;

export async function getNewsDiscoveryStatus(){
  const sql=db();
  const [latestRun]=await sql`SELECT run_id,technical_status,functional_result,requested_at,started_at,finished_at,metrics,error_count FROM process_runs WHERE process_code='PROC-NOV-001' ORDER BY requested_at DESC LIMIT 1`;
  const [lastSuccess]=await sql`SELECT run_id,finished_at FROM process_runs WHERE process_code='PROC-NOV-001' AND technical_status='succeeded' AND COALESCE(functional_result,'')<>'blocked' AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
  const nextAllowedAt=lastSuccess?.finished_at?new Date(new Date(lastSuccess.finished_at).getTime()+WEEK_MS):null;
  const [active]=await sql`SELECT run_id,technical_status,requested_at,started_at FROM process_runs WHERE process_code='PROC-NOV-001' AND technical_status IN('queued','running') ORDER BY requested_at DESC LIMIT 1`;
  return{latestRun:latestRun||null,lastSuccess:lastSuccess||null,nextAllowedAt,discoveryAllowed:!active&&(!nextAllowedAt||nextAllowedAt<=new Date()),activeRun:active||null};
}
