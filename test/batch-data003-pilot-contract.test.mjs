import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const batch=await readFile(new URL('../lib/batch-engine.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../lib/batch-worker-runtime.mjs',import.meta.url),'utf8');
const fast=await readFile(new URL('../worker/batch-fast-worker.mjs',import.meta.url),'utf8');
const canonical=await readFile(new URL('../lib/data003-canonical.mjs',import.meta.url),'utf8');
const manual=await readFile(new URL('../app/calidad/datos/pikoscore-actions.js',import.meta.url),'utf8');
const page=await readFile(new URL('../app/calidad/datos/page.js',import.meta.url),'utf8');
const panel=await readFile(new URL('../components/Data003BatchPanel.js',import.meta.url),'utf8');

test('DATA-003 individual and Batch execute one canonical operation',()=>{
  assert.match(canonical,/executeData003Canonical/);
  assert.match(manual,/executeData003Canonical\(db\(\),imdbId,\{trace\}\)/);
  assert.match(fast,/executeData003Canonical/);
  assert.match(fast,/\['PROC-DATA-003',\{execute:executeData003Canonical\}\]/);
});

test('Batch parent snapshots queue without precreating child runs',()=>{
  assert.match(batch,/runKind:'batch'/);
  assert.match(batch,/INSERT INTO batch_run_items/);
  assert.doesNotMatch(batch,/parent_run_id.*run_kind.*individual/s);
  assert.match(worker,/INSERT INTO process_runs\(parent_run_id,process_code,run_kind/);
  assert.match(worker,/createChild\(item,workerId,executor\)/);
  assert.match(worker,/executor='railway_batch_fast'/);
});

test('one active Batch per process is respected and active run is reused',()=>{
  assert.match(batch,/getActiveBatch\(DATA003/);
  assert.match(batch,/if\(active\)return\{run:active,reused:true/);
  assert.match(batch,/error\?\.code==='23505'/);
});

test('pause resume cancel and global pause are operational states outside process_runs',()=>{
  assert.match(batch,/desired_state='paused'/);
  assert.match(batch,/desired_state='running'/);
  assert.match(batch,/desired_state='cancel_requested'/);
  assert.match(worker,/batch_engine_control/);
  assert.match(worker,/engine\?\.desired_state!=='running'/);
  assert.doesNotMatch(batch,/technical_status='paused'/);
});

test('worker uses leases and new child run per attempt',()=>{
  assert.match(worker,/FOR UPDATE SKIP LOCKED/);
  assert.match(worker,/lease_until/);
  assert.match(worker,/attempt_count=attempt_count\+1/);
  assert.match(worker,/attempt:\$\{item\.attempt_count\}/);
  assert.match(worker,/Lease vencida: worker interrumpido/);
});

test('Datos owns the Batch UX and legacy generic Batch copy is gone from the surface',()=>{
  assert.match(page,/Data003BatchPanel/);
  assert.match(page,/getData003BatchPanelState/);
  assert.match(page,/procesos masivos disponibles se controlan desde esta misma pantalla/);
  assert.doesNotMatch(page,/exclusivamente desde BATCH/);
  assert.match(panel,/Iniciar Batch/);
  assert.match(panel,/Pausar/);
  assert.match(panel,/Continuar/);
  assert.match(panel,/Cancelar/);
  assert.match(panel,/Centro de Operaciones/);
});
