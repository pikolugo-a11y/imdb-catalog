import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const people=fs.readFileSync('lib/people-v2.js','utf8');
const actions=fs.readFileSync('app/personas/actions.js','utf8');
const page=fs.readFileSync('app/personas/[id]/page.js','utf8');
const list=fs.readFileSync('app/personas/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('PER-001 is the canonical observed manual person refresh',()=>{
  assert.match(people,/processCode:'PROC-PER-001'/);
  assert.match(people,/executeObservedProcess/);
  assert.match(people,/runKind:'individual'/);
  assert.match(people,/triggerSource:'personas_manual'/);
  assert.match(people,/entityType:'person'/);
  assert.match(people,/operation:'refresh_person_profile_filmography'/);
  assert.match(display,/'PROC-PER-001':\{name:'Actualizar perfil y filmografía'\}/);
  assert.match(display,/personas_manual:'Manual desde Personas'/);
});

test('opening a person is read-only and never triggers refresh implicitly',()=>{
  assert.match(people,/export async function getPersonV2\(id\)/);
  assert.doesNotMatch(people,/getPersonV2\(id,\{refresh=true\}/);
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

test('PER-001 observes TMDb calls and persists profile plus filmography atomically',()=>{
  assert.match(people,/trace\?\.externalCall\?\.\(1\)/);
  assert.match(people,/step:'fetch_person'/);
  assert.match(people,/step:'resolve_movies'/);
  assert.match(people,/const ops=\[\]/);
  assert.match(people,/INSERT INTO people/);
  assert.match(people,/DELETE FROM person_filmography/);
  assert.match(people,/INSERT INTO person_refresh_state/);
  assert.match(people,/await sql\.transaction\(ops\)/);
  assert.match(people,/metrics:\{credits:entries\.length,relevant,other,imdb_resolved:imdbIds\.length,catalog_matches:owned\.size\}/);
});
