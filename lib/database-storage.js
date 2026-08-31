import 'server-only';
import {unstable_cache} from 'next/cache';
import {db} from './db';

const OPS_TABLES=['process_runs','process_run_events','process_run_errors'];
const toNumber=v=>Number(v||0);

async function loadDatabaseStorage(){
  const sql=db();
  const [[database],tables]=await Promise.all([
    sql`SELECT pg_database_size(current_database())::bigint AS total_bytes`,
    sql`
      SELECT c.relname AS table_name,
             pg_total_relation_size(c.oid)::bigint AS total_bytes,
             pg_relation_size(c.oid)::bigint AS data_bytes,
             pg_indexes_size(c.oid)::bigint AS index_bytes,
             COALESCE(s.n_live_tup,0)::bigint AS approx_rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
      WHERE n.nspname='public' AND c.relkind IN ('r','p')
      ORDER BY pg_total_relation_size(c.oid) DESC
    `
  ]);
  const normalized=tables.map(r=>({tableName:r.table_name,totalBytes:toNumber(r.total_bytes),dataBytes:toNumber(r.data_bytes),indexBytes:toNumber(r.index_bytes),approxRows:toNumber(r.approx_rows)}));
  const operationsBytes=normalized.filter(r=>OPS_TABLES.includes(r.tableName)).reduce((sum,r)=>sum+r.totalBytes,0);
  return{totalBytes:toNumber(database?.total_bytes),operationsBytes,operationsTables:normalized.filter(r=>OPS_TABLES.includes(r.tableName)),topTables:normalized.slice(0,12),capturedAt:new Date().toISOString()};
}

const cached=unstable_cache(loadDatabaseStorage,['database-storage-v1'],{revalidate:300,tags:['database-storage']});
export async function getDatabaseStorage(){return cached()}

export async function appendDatabaseStorageSnapshot(){
  const sql=db(),storage=await loadDatabaseStorage();
  const patch={db_total_bytes:storage.totalBytes,db_operations_bytes:storage.operationsBytes};
  await sql`UPDATE dashboard_snapshots SET metrics=COALESCE(metrics,'{}'::jsonb)||${JSON.stringify(patch)}::jsonb WHERE snapshot_date=current_date`;
  return patch;
}
