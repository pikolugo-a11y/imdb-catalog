import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('lib/batch-worker-runtime.mjs','utf8');

test('cancel_requested tiene prioridad sobre requeue de lease vencida',()=>{
  assert.match(runtime,/c\.desired_state/);
  assert.match(runtime,/item\.desired_state==='cancel_requested'/);
  assert.match(runtime,/next=cancelling\?'cancelled'/);
  assert.match(runtime,/cancel_requested:cancelling/);
});

test('un error de item no se reencola si el Batch fue cancelado mientras corría',()=>{
  assert.match(runtime,/SELECT desired_state FROM batch_run_control WHERE run_id=\$\{item\.batch_run_id\}::uuid/);
  assert.match(runtime,/cancelling=control\?\.desired_state==='cancel_requested'/);
  assert.match(runtime,/requeue=!cancelling/);
  assert.match(runtime,/cancelled:cancelling/);
});

test('heartbeat reconcilia items queued de Batches cancelados y permite cerrar el padre',()=>{
  assert.match(runtime,/async function finalizeRequestedCancellations/);
  assert.match(runtime,/c\.desired_state='cancel_requested' AND i\.status='queued'/);
  assert.match(runtime,/SET status='cancelled'/);
  assert.match(runtime,/await finalizeRequestedCancellations\(pool\)/);
  assert.match(runtime,/await refreshParent\(r\.batch_run_id\)/);
});
