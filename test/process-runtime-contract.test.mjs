import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const runtime=read('../lib/process-runtime.js');
const identity=read('../lib/identity-unitary.js');
const correction=read('../lib/identity-correction.js');
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

test('idempotencia se resuelve por proceso y no solo por clave',()=>{
  assert.match(runtime,/WHERE process_code=\$\{processCode\} AND idempotency_key=\$\{idempotencyKey\}/);
});

test('ID-001 usa la infraestructura común y conserva una única operación funcional',()=>{
  assert.match(actions,/executeObservedProcess/);
  assert.match(actions,/processCode:'PROC-ID-001'/);
  assert.match(actions,/triggerSource:'calidad_identidad_manual'/);
  assert.match(actions,/executor:'vercel'/);
  assert.match(actions,/resolveIdentityUnitary\(id,trace\)/);
});

test('doble clic no se interpreta como TMDb no encontrado',()=>{
  assert.match(actions,/if\(observed\.reused\)/);
  assert.match(actions,/status:'duplicate'/);
  const reusedIndex=actions.indexOf('if(observed.reused)');
  const notFoundIndex=actions.indexOf("status:'not_found'");
  assert.ok(reusedIndex>=0&&notFoundIndex>reusedIndex);
});

test('ID-001 no escribe estado residual del Batch legacy',()=>{
  const start=actions.indexOf('export async function obtainIdentityAction');
  const end=actions.indexOf('export async function saveIdentityPageAction');
  const body=actions.slice(start,end);
  assert.doesNotMatch(body,/recordOutcome\(|batch_process_state/);
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

test('ID-002 usa el núcleo canónico compartido y observabilidad común',()=>{
  const start=actions.indexOf('export async function saveIdentityPageAction');
  const end=actions.indexOf('export async function refreshIdentityDataAction');
  const body=actions.slice(start,end);
  assert.match(body,/processCode:'PROC-ID-002'/);
  assert.match(body,/correctIdentityIds\(/);
  assert.doesNotMatch(body,/validateTmdbIdentity|saveIdentity\(/);
  assert.doesNotMatch(body,/batch_process_state|recordOutcome/);
});

test('núcleo de corrección exige verificación TMDb real antes de guardar',()=>{
  assert.match(correction,/validateTmdbIdentity/);
  assert.match(correction,/if\(!verification\.actualImdbId\)return\{changed:false,blocked:true,reason:'unverifiable'/);
  assert.match(correction,/if\(!verification\.ok\)return\{changed:false,blocked:true,reason:'mismatch'/);
  const verify=correction.indexOf('validateTmdbIdentity');
  const save=correction.indexOf('saveIdentity(oldId');
  assert.ok(verify>=0&&save>verify);
});

test('fallo técnico TMDb corta la corrección y queda clasificado para retry',()=>{
  assert.match(correction,/e\.processStep='validate_tmdb_identity'/);
  assert.match(correction,/e\.source='tmdb'/);
  assert.match(correction,/e\.retryable=true/);
});
