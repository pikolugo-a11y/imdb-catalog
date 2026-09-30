import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('procesos API gobernados usan capacidad 8 sin topes heredados 2 o 3',()=>{
  const data1=read('lib/data001-batch.js');
  const data2=read('lib/data002-batch.js');
  const id=read('lib/id001-batch.js');
  const iv=read('lib/identity-validation-batch.js');
  const people=read('lib/people-batch.js');
  const saga=read('lib/saga-batch.js');
  const series=read('lib/series-batch.js');
  const planner=read('lib/process-planning.js');

  assert.match(data1,/startData001Batch\(\{limit=null,concurrency=8\}/);
  assert.match(data1,/Math\.min\(Number\(concurrency\)\|\|8,8\)/);

  assert.match(data2,/startData002Batch\(\{limit=null,concurrency=8/);
  assert.match(data2,/Math\.min\(Number\(concurrency\)\|\|8,8\)/);

  assert.match(id,/startId001Batch\(\{concurrency=8,limit=null\}/);
  assert.match(id,/Math\.min\(Number\(concurrency\)\|\|8,8\)/);

  assert.match(iv,/'PROC-IV-001':\{pool:'api',concurrency:8/);
  assert.match(people,/startPeopleBatch\(\{limit=null,concurrency=8/);
  assert.match(people,/Math\.min\(Number\(concurrency\)\|\|8,8\)/);
  assert.match(saga,/startSagaFullRefreshBatch\(\{concurrency=8\}/);
  assert.match(series,/'PROC-SER-003':\{pool:'api',concurrency:8/);
  assert.match(series,/'PROC-SER-007':\{pool:'api',concurrency:8/);

  assert.match(planner,/startData002Batch\(\{limit:n,concurrency:8/);
  assert.match(planner,/startPeopleBatch\(\{limit:n,concurrency:8/);
});

test('límites externos deliberados permanecen donde la API realmente los exige',()=>{
  const series=read('lib/series-batch.js');
  const relevance=read('lib/pikorelevancia-batch.js');
  const plex=read('worker/batch-plex-worker.mjs');

  assert.match(series,/'PROC-SER-004':\{pool:'api',concurrency:2/);
  assert.match(relevance,/requested_concurrency:1/);
  assert.match(relevance,/VALUES\([^\n]*'api','running',1\)/);
  assert.match(plex,/BATCH_PLEX_CAPACITY\)\|\|1/);
});
