import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('PikoRelevancia productiva mantiene una sola operación canónica',()=>{
  const wrapper=read('lib/pikorelevance.js');
  const batch=read('lib/pikorelevancia-batch.js');
  const worker=read('worker/batch-api-worker.mjs');
  assert.match(wrapper,/startPikoRelevanceBatch/);
  assert.match(batch,/PROC-REL-001/);
  assert.match(worker,/computePikoRelevanceCanonical/);
  assert.match(worker,/'PROC-REL-001':executeRel001/);
});

test('deuda inicial y mantenimiento automático están separados',()=>{
  const batch=read('lib/pikorelevancia-batch.js');
  assert.match(batch,/selectPikoRelevanceMissingEligibleIds/);
  assert.match(batch,/selectPikoRelevanceDueEligibleIds/);
  assert.match(batch,/targeted=entityIds!==null/);
  assert.match(batch,/ids=targeted\?await selectExplicit\(sql,entityIds\):await selectPikoRelevanceDueEligibleIds\(sql\)/);
});
