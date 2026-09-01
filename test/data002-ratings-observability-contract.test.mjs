import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ratings=await readFile(new URL('../lib/ratings-refresh.js',import.meta.url),'utf8');
const core=await readFile(new URL('../lib/ratings-refresh-core.mjs',import.meta.url),'utf8');
const actions=await readFile(new URL('../app/calidad/datos/actions.js',import.meta.url),'utf8');
const display=await readFile(new URL('../lib/process-display.js',import.meta.url),'utf8');
const quality=await readFile(new URL('../lib/data-quality.js',import.meta.url),'utf8');
const qualityPage=await readFile(new URL('../lib/data-quality-page.js',import.meta.url),'utf8');

test('DATA-002 keeps approved rescue order',()=>{
  assert.match(ratings,/refreshRatingsCanonical/);
  assert.match(core,/fetchMdblist/);
  assert.match(core,/count<2[\s\S]*rescueOmdb/);
  assert.match(core,/count<2[\s\S]*rescueTmdb/);
  assert.match(core,/step_skipped/);
});

test('DATA-002 never overwrites rescue sources already present',()=>{
  assert.match(core,/!have\.has\(RATING_SOURCES\.IMDB\)/);
  assert.match(core,/!have\.has\(RATING_SOURCES\.RT_CRITICS\)/);
  assert.match(core,/!have\.has\(RATING_SOURCES\.METACRITIC\)/);
  assert.match(core,/sourceSet\(existing\)\.has\(RATING_SOURCES\.TMDB\)/);
});

test('DATA-002 treats MDBList 404 as expected provider miss and continues rescue',()=>{
  assert.match(core,/notFoundExpected:true/);
  assert.match(core,/provider_not_found/);
  assert.match(core,/MDBList no conoce el título; se activa la cascada de rescate/);
  assert.match(core,/expected:true/);
  assert.match(actions,/x\.status==='warning'&&x\.expected!==true/);
  assert.match(actions,/expected_provider_misses/);
});

test('DATA-002 is observed as canonical individual operation',()=>{
  assert.match(actions,/processCode:'PROC-DATA-002'/);
  assert.match(actions,/runKind:'individual'/);
  assert.match(actions,/refreshRatingsForTitle\(imdbId,\{trace\}\)/);
  assert.match(display,/PROC-DATA-002/);
  assert.match(display,/Refrescar ratings/);
});

test('ratings without fetched_at are always pending in Data frontend',()=>{
  assert.match(quality,/missingDate=!hasFetched/);
  assert.match(quality,/expired=missingDate\|\|!Number\.isFinite\(due\)\|\|due<=now/);
  assert.match(quality,/Hay ratings caducados o sin fecha válida/);
  assert.match(qualityPage,/tr\.fetched_at IS NOT NULL/);
  assert.match(qualityPage,/NOT s\.ratings_ready OR NOT s\.ratings_fresh/);
});
