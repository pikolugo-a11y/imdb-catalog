import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const people=fs.readFileSync('lib/people-v2.js','utf8');
const core=fs.readFileSync('lib/people-refresh-core.mjs','utf8');
const worker=fs.readFileSync('worker/batch-api-worker.mjs','utf8');
const actions=fs.readFileSync('app/personas/actions.js','utf8');
const page=fs.readFileSync('app/personas/[id]/page.js','utf8');
const list=fs.readFileSync('app/personas/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('PER-001 manual wrapper owns the individual process_run boundary',()=>{
  assert.match(people,/processCode:'PROC-PER-001'/);
  assert.match(people,/executeObservedProcess/);
  assert.match(people,/runKind:'individual'/);
  assert.match(people,/triggerSource:'personas_manual'/);
  assert.match(people,/entityType:'person'/);
  assert.match(people,/operation:'refresh_person_profile_filmography'/);
  assert.match(people,/refreshPersonFilmographyCanonical\(db\(\),personId,\{trace\}\)/);
  assert.match(display,/'PROC-PER-001':\{name:'Actualizar perfil y filmografía'\}/);
});

test('PER-001 Batch executes the same core inside the child process_run without nested observability',()=>{
  assert.match(worker,/import \{refreshPersonFilmographyCanonical\} from '\.\.\/lib\/people-refresh-core\.mjs'/);
  assert.match(worker,/return refreshPersonFilmographyCanonical\(sql,id,\{trace,apiGate:createApiGate/);
  assert.doesNotMatch(worker,/refreshPersonFilmography\(id/);
  assert.doesNotMatch(worker,/canonical_run_id/);
  assert.match(core,/export async function refreshPersonFilmographyCanonical/);
});

test('opening a person is read-only and never triggers refresh implicitly',()=>{
  assert.match(people,/export async function getPersonV2\(id\)/);
  const readStart=people.indexOf('export async function getPersonV2');
  assert.ok(readStart>=0);
  assert.doesNotMatch(people.slice(readStart),/refreshPersonFilmography\(/);
  assert.match(page,/getPersonV2\(id\)/);
});

test('PER-001 keeps explicit manual action and removes people-lite legacy path',()=>{
  assert.match(actions,/refreshPersonFilmographyAction/);
  assert.match(actions,/refreshPersonFilmography\(id,\{requestKey\}\)/);
  assert.doesNotMatch(actions,/refreshPeopleLite/);
  assert.doesNotMatch(people,/refreshPeopleLite/);
  assert.doesNotMatch(list,/\/admin\/batch\/personas/);
});

test('PER-001 canonical core observes TMDb and persists profile plus filmography atomically',()=>{
  assert.match(core,/trace\?\.externalCall\?\.\(1\)/);
  assert.match(core,/step:'fetch_person'/);
  assert.match(core,/step:'resolve_movies'/);
  assert.match(core,/const ops=\[\]/);
  assert.match(core,/INSERT INTO people/);
  assert.match(core,/DELETE FROM person_filmography/);
  assert.match(core,/INSERT INTO person_refresh_state/);
  assert.match(core,/await sql\.transaction\(ops\)/);
  assert.match(core,/metrics:\{credits:entries\.length,relevant,other,imdb_resolved:imdbIds\.length,catalog_matches:owned\.size\}/);
});
