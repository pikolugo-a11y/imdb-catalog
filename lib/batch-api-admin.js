import 'server-only';
import {db} from './db';
import {clampSourceConfig} from './batch-api-governance.mjs';
export async function getBatchApiSources(){const sql=db();return sql`SELECT l.*,COALESCE(u.batch_calls,0)::int batch_calls,COALESCE(u.manual_calls,0)::int manual_calls,COALESCE(u.rate_limited,0)::int rate_limited,COALESCE(u.errors,0)::int errors,(SELECT count(*)::int FROM batch_api_source_leases x WHERE x.source=l.source AND x.expires_at>now()) active_leases FROM batch_api_source_limits l LEFT JOIN batch_api_source_usage u ON u.source=l.source AND u.usage_date=(now() AT TIME ZONE 'UTC')::date ORDER BY l.source`}
export async function updateBatchApiSource(source,input){const cfg=clampSourceConfig(source,input),sql=db();await sql`UPDATE batch_api_source_limits SET daily_limit=${cfg.dailyLimit},batch_share_percent=${cfg.batchSharePercent},max_concurrency=${cfg.maxConcurrency},updated_at=now() WHERE source=${source}`;return cfg}
export async function closeBatchApiBreaker(source){const sql=db();await sql`UPDATE batch_api_source_limits SET breaker_state='closed',blocked_until=NULL,consecutive_errors=0,updated_at=now() WHERE source=${source}`}
