import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const storage=await readFile(new URL('../lib/database-storage.js',import.meta.url),'utf8');
const home=await readFile(new URL('../app/page.js',import.meta.url),'utf8');
const system=await readFile(new URL('../app/admin/sistema/page.js',import.meta.url),'utf8');
const cron=await readFile(new URL('../app/api/cron/dashboard-snapshot/route.js',import.meta.url),'utf8');

test('PikoFilm measures PostgreSQL storage using metadata functions',()=>{
  assert.match(storage,/pg_database_size\(current_database\(\)\)/);
  assert.match(storage,/pg_total_relation_size/);
  assert.match(storage,/pg_stat_user_tables/);
  assert.match(storage,/process_run_events/);
  assert.match(storage,/process_run_errors/);
  assert.match(storage,/process_runs/);
});

test('V4 moves database storage from Inicio to Operaciones Sistema and keeps growth snapshots',()=>{
  assert.doesNotMatch(home,/DatabaseStoragePanel/);
  assert.match(system,/DatabaseStoragePanel/);
  assert.match(system,/history=/);
  assert.match(cron,/appendDatabaseStorageSnapshot/);
  assert.match(storage,/db_total_bytes/);
  assert.match(storage,/db_operations_bytes/);
});
