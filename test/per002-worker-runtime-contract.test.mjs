import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const worker=fs.readFileSync('worker/batch-api-worker.mjs','utf8');

test('PER-002 Railway API worker can import canonical people runtime',()=>{
  assert.equal(pkg.dependencies['server-only'],'^0.0.1');
  assert.match(pkg.scripts['worker:batch-api'],/--conditions=react-server/);
  assert.match(worker,/refreshPersonFilmography/);
  assert.match(worker,/'PROC-PER-002'/);
});
