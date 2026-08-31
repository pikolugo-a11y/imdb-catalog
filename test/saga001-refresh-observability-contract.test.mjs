import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const saga=fs.readFileSync('lib/sagas-v2.js','utf8');
const page=fs.readFileSync('app/sagas/page.js','utf8');
const detail=fs.readFileSync('app/sagas/[name]/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('SAGA-001 is the canonical observed manual TMDb saga refresh',()=>{
  assert.match(saga,/processCode:'PROC-SAGA-001'/);
  assert.match(saga,/executeObservedProcess/);
  assert.match(saga,/triggerSource:'sagas_manual'/);
  assert.match(saga,/operation:'refresh_sagas_tmdb'/);
  assert.match(saga,/runKind:'system'/);
  assert.doesNotMatch(saga,/startRun\('saga_refresh'/);
  assert.match(display,/'PROC-SAGA-001':\{name:'Actualizar sagas desde TMDb'\}/);
});

test('SAGA-001 keeps the existing writer/read-model contract and bounded refresh policy',()=>{
  assert.match(saga,/saga_collections/);
  assert.match(saga,/saga_collection_members/);
  assert.match(saga,/ORDER BY sc\.refreshed_at ASC NULLS FIRST/);
  assert.match(saga,/Math\.min\(120/);
  assert.match(saga,/pool\(ids,6/);
  assert.match(page,/getSagasDashboard/);
  assert.match(detail,/getSagaDetailV3/);
});

test('SAGA-001 preserves IMDb resolution required by Saga to Novedades intake and traces failures',()=>{
  assert.match(saga,/\/external_ids/);
  assert.match(saga,/recordProcessError\(trace\.runId/);
  assert.match(saga,/step:'resolve_imdb'/);
  assert.match(saga,/step:'refresh_collection'/);
  assert.match(saga,/externalCall/);
  assert.match(detail,/external_imdb_id/);
  assert.match(detail,/addSagaMemberToNewsAction/);
});
