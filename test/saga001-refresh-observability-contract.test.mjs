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
  assert.match(saga,/sc\.refreshed_at ASC NULLS FIRST/);
  assert.match(saga,/Math\.min\(120/);
  assert.match(saga,/pool\(ids,6/);
  assert.match(page,/getSagasDashboard/);
  assert.match(detail,/getSagaDetailV3/);
});

test('SAGA-001 resolves IMDb without the removed tmdb_external_ids relation',()=>{
  assert.doesNotMatch(saga,/tmdb_external_ids/);
  assert.match(saga,/SELECT imdb_id FROM saga_collection_members WHERE tmdb_movie_id=/);
  assert.match(saga,/\/external_ids/);
  assert.match(saga,/recordProcessError\(trace\.runId/);
  assert.match(saga,/step:'resolve_imdb'/);
  assert.match(saga,/step:'refresh_collection'/);
  assert.match(saga,/externalCall/);
  assert.match(detail,/external_imdb_id/);
  assert.match(detail,/addSagaMemberToNewsAction/);
});

test('SAGA-001 refresh is atomic per collection and prioritizes inconsistent collections for self-healing',()=>{
  assert.match(saga,/actual_member_count/);
  assert.match(saga,/COALESCE\(sm\.actual_member_count,0\)<>COALESCE\(sc\.member_count,0\)/);
  const transaction=saga.indexOf('await sql.transaction(ops);');
  const countSuccess=saga.indexOf('if(exists.length)updated++;else added++;');
  assert.ok(transaction>=0&&countSuccess>transaction,'success counters must run only after the collection transaction commits');
  const ops=saga.indexOf('const ops=[');
  const collectionWrite=saga.indexOf('INSERT INTO saga_collections',ops);
  const memberDelete=saga.indexOf('DELETE FROM saga_collection_members',ops);
  assert.ok(ops>=0&&collectionWrite>ops&&memberDelete>collectionWrite,'collection metadata and members must share the transaction ops');
});

test('SAGA-001 deduplicates provider members by TMDb movie id before writing',()=>{
  assert.match(saga,/function uniqueMovieParts\(parts\)/);
  assert.match(saga,/seen\.has\(id\)/);
  assert.match(saga,/const rawParts=/);
  assert.match(saga,/const parts=uniqueMovieParts\(rawParts\)/);
  assert.match(saga,/duplicate_members_ignored/);
  assert.match(saga,/member_count,refreshed_at\).*\$\{parts\.length\}/s);
});
