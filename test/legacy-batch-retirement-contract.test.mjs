import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const oldRouteFiles=[
  '../app/admin/batch/layout.js',
  '../app/admin/batch/page.js',
  '../app/admin/batch/actions.js',
  '../app/admin/batch/job/[id]/page.js',
  '../app/admin/batch/personas/page.js',
];
const oldHelpers=[
  '../lib/batch-control.js',
  '../lib/batch-ui-metrics.js',
  '../lib/batch-source-control.js',
];

async function exists(relative){
  try{await access(new URL(relative,import.meta.url));return true}catch{return false}
}

test('first-generation Admin/Batch is physically retired',async()=>{
  for(const path of [...oldRouteFiles,...oldHelpers]){
    assert.equal(await exists(path),false,`${path} must stay retired`);
  }
});

test('canonical Operations keeps the current Batch Engine control',async()=>{
  const page=await readFile(new URL('../app/admin/page.js',import.meta.url),'utf8');
  const control=await readFile(new URL('../components/OperationsBatchControl.js',import.meta.url),'utf8');
  const runtime=await readFile(new URL('../lib/batch-worker-runtime.mjs',import.meta.url),'utf8');
  assert.match(page,/OperationsBatchControl/);
  assert.match(control,/batch_engine_control/);
  assert.match(control,/batch_run_control/);
  assert.match(runtime,/process_runs/);
  assert.match(runtime,/batch_run_items/);
  assert.doesNotMatch(runtime,/batch_jobs|batch_runtime_control/);
});
