import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/catalog-admission-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const seed=fs.readFileSync('lib/plex-news-seed.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-007 is observed minimal admission with no enrichment calls',()=>{
  assert.match(action,/processCode:'PROC-NOV-007'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/operation:'admit_candidate_to_catalog'/);
  assert.match(action,/recomputeLifecycleForIds\(\[imdbId\]\)/);
  assert.doesNotMatch(action,/enrichTitle|TMDb|FilmAffinity|Wikidata|PikoScore/);
  assert.match(action,/external_calls:0/);
});

test('NOV-007 requires only real title and valid type before insert',()=>{
  assert.match(action,/!type\|\|!title\|\|title===imdbId/);
  assert.match(action,/INSERT INTO movies/);
  assert.match(action,/eligibility_status='catalogued'/);
});

test('Plex seed does not require rating votes or year to become ready',()=>{
  assert.match(seed,/const hasMinimums=r=>Boolean\(r\.imdb_id&&r\.title&&r\.title!==r\.imdb_id&&r\.candidate_type\)/);
  assert.doesNotMatch(seed,/imdbRatingsFromOfficialDataset/);
});

test('Novedades UI uses canonical admission action and Operations has human name',()=>{
  assert.match(page,/admitNewsCandidateAction/);
  assert.doesNotMatch(page,/form action=\{enrichNewsCandidateAction\}/);
  assert.match(display,/'PROC-NOV-007':\{name:'Añadir candidato de Novedades al catálogo'\}/);
});
