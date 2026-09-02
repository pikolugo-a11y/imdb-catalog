import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

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
async function sourceFiles(root){
  const out=[];
  for(const entry of await readdir(root,{withFileTypes:true})){
    const path=join(root,entry.name);
    if(entry.isDirectory())out.push(...await sourceFiles(path));
    else if(/\.(?:js|mjs|cjs|ts|tsx)$/.test(entry.name))out.push(path);
  }
  return out;
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

test('live application code cannot depend on retired Batch V1 relations',async()=>{
  const repo=fileURLToPath(new URL('..',import.meta.url));
  for(const area of ['app','components','lib','worker']){
    for(const path of await sourceFiles(join(repo,area))){
      const source=await readFile(path,'utf8');
      assert.doesNotMatch(source,/\bbatch_process_state\b|\bbatch_jobs\b|\bbatch_runtime_control\b|\bbatch_source_limits\b/,`${path} references a retired Batch V1 relation`);
    }
  }
});
