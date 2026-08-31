import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const actions=read('app/calidad/pikoquality/actions.js');
const worker=read('worker/technical-snapshot-worker.mjs');
const bridge=read('lib/pikoquality-technical-observability.mjs');
const display=read('lib/process-display.js');

test('PQ-002 is created manually and executed by Railway as one canonical run',()=>{
  assert.match(actions,/TECH_PROCESS_CODE='PROC-PQ-002'/);
  assert.match(actions,/runKind:'batch'/);
  assert.match(actions,/executor:'railway'/);
  assert.match(actions,/triggerSource:'calidad_pikoquality_manual'/);
  assert.match(actions,/run_resumed/);
  assert.match(actions,/run_paused/);
  assert.match(actions,/run_cancelled/);
  assert.match(worker,/getActiveTechnicalProcessRun/);
  assert.match(display,/PROC-PQ-002/);
});

test('Railway reports compact scan, capture progress and first-class errors',()=>{
  assert.match(worker,/step:'technical_scan'/);
  assert.match(worker,/eventType:'batch_progress'/);
  assert.match(worker,/recordTechnicalProcessError/);
  assert.match(worker,/finishTechnicalProcessRun/);
  assert.doesNotMatch(worker,/eventType:'worker_heartbeat'/);
  assert.match(bridge,/process_run_errors/);
  assert.match(bridge,/error_count=error_count\+1/);
});

test('PQ-002 does not require a new Neon schema column',()=>{
  assert.doesNotMatch(actions,/process_run_id/);
  assert.doesNotMatch(worker,/process_run_id/);
  assert.doesNotMatch(bridge,/ALTER TABLE|CREATE TABLE|process_run_id/);
});
