import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const actions=fs.readFileSync('app/calidad/series/actions.js','utf8');
const apiWorker=fs.readFileSync('worker/batch-api-worker.mjs','utf8');

test('SER-003 and SER-004 keep Series read model refreshed in manual and Batch lanes',()=>{
  assert.match(actions,/async function runTracked\([\s\S]*await rebuildSeriesQualityReadModel\(sql\)/);
  assert.match(actions,/runTracked\('tmdb_refresh'/);
  assert.match(actions,/runTracked\('es_availability'/);
  assert.match(apiWorker,/async function executeSer003[\s\S]*rebuildSeriesQualityReadModelForRatingKey\(sql,r\.ratingKey\)/);
  assert.match(apiWorker,/async function executeSer004[\s\S]*rebuildSeriesQualityReadModelForRatingKey\(sql,r\.ratingKey\)/);
});
