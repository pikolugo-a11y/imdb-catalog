import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const runtime=read('../lib/process-runtime.js');
const identity=read('../lib/identity-unitary.js');
const actions=read('../app/calidad/identidad/actions.js');

test('runtime común escribe exclusivamente el modelo nuevo de observabilidad',()=>{
  assert.match(runtime,/process_runs/);
  assert.match(runtime,/process_run_events/);
  assert.match(runtime,/process_run_errors/);
  assert.doesNotMatch(runtime,/pipeline_runs|batch_jobs|admin_events/);
});

test('runtime separa origen, executor, estado técnico y resultado funcional',()=>{
  assert.match(runtime,/trigger_source/);
  assert.match(runtime,/executor/);
  assert.match(runtime,/technical_status/);
  assert.match(runtime,/functional_result/);
  assert.match(runtime,/idempotency_key/);
  assert.match(runtime,/correlation_key/);
});

test('ID-001 usa la infraestructura común y conserva una única operación funcional',()=>{
  assert.match(actions,/executeObservedProcess/);
  assert.match(actions,/processCode:'PROC-ID-001'/);
  assert.match(actions,/triggerSource:'calidad_identidad_manual'/);
  assert.match(actions,/executor:'vercel'/);
  assert.match(actions,/resolveIdentityUnitary\(id,trace\)/);
});

test('ID-001 solo resuelve TMDb y recalcula Lifecycle',()=>{
  assert.match(identity,/resolveTmdbOnly/);
  assert.match(identity,/recomputeLifecycleForIds/);
  assert.doesNotMatch(identity,/FilmAffinity|Wikidata|fa_/i);
});

test('ID-001 distingue updated no_change y not_found',()=>{
  assert.match(identity,/before\.tmdb_id\?'no_change':'updated'/);
  assert.match(identity,/:\s*'not_found'/);
});
