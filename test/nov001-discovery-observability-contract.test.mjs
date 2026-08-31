import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/discovery-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const worker=fs.readFileSync('worker/imdb-discovery.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/imdb-discovery.yml','utf8');
const runtime=fs.readFileSync('lib/process-worker-runtime.mjs','utf8');
const status=fs.readFileSync('lib/news-discovery-status.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-001 crea un único run queued y pasa run_id al worker',()=>{
  assert.match(action,/PROC-NOV-001/);
  assert.match(action,/technical_status[^\n]*'queued'/);
  assert.match(action,/inputs:\{run_id:runId\}/);
  assert.match(workflow,/run_id:/);
  assert.match(workflow,/PROCESS_RUN_ID/);
  assert.match(worker,/claimObservedWorkerRun\(RUN_ID/);
  assert.match(runtime,/technical_status='running'/);
});

test('NOV-001 elimina prueba única y conserva cooldown semanal real',()=>{
  assert.doesNotMatch(page,/Prueba única/);
  assert.doesNotMatch(workflow,/force_once|FORCE_DISCOVERY_ONCE/);
  assert.doesNotMatch(action,/imdb_discovery_test_override|forceOnce/);
  assert.match(action,/WEEK_MS=7\*24\*60\*60\*1000/);
  assert.match(status,/process_code='PROC-NOV-001'/);
});

test('NOV-001 recupera pendientes de país y no limita TMDb a 800',()=>{
  assert.match(worker,/historicalPending/);
  assert.match(worker,/countryStatus!=='pending'/);
  assert.doesNotMatch(worker,/unresolved\.slice\(0,800\)/);
  assert.match(worker,/pool\(unresolved,8/);
});

test('NOV-001 no retira automáticamente discoveries anteriores',()=>{
  assert.doesNotMatch(worker,/last_seen_at < to_timestamp/);
  assert.match(worker,/Candidatos persistidos sin retirar discoveries anteriores/);
});

test('NOV-001 queda visible con nombres humanos en Operaciones',()=>{
  assert.match(display,/PROC-NOV-001/);
  assert.match(display,/Descubrir novedades IMDb/);
  assert.match(display,/github_actions:'GitHub Actions'/);
});
