import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ratings=await readFile(new URL('../lib/ratings-refresh.js',import.meta.url),'utf8');
const actions=await readFile(new URL('../app/calidad/datos/actions.js',import.meta.url),'utf8');
const display=await readFile(new URL('../lib/process-display.js',import.meta.url),'utf8');

test('DATA-002 keeps approved rescue order',()=>{
  assert.match(ratings,/fetchMDBListRatings/);
  assert.match(ratings,/count<2[\s\S]*rescueOmdb/);
  assert.match(ratings,/count<2[\s\S]*rescueTmdb/);
  assert.match(ratings,/step_skipped/);
});

test('DATA-002 never overwrites rescue sources already present',()=>{
  assert.match(ratings,/!have\.has\(RATING_SOURCES\.IMDB\)/);
  assert.match(ratings,/!have\.has\(RATING_SOURCES\.RT_CRITICS\)/);
  assert.match(ratings,/!have\.has\(RATING_SOURCES\.METACRITIC\)/);
  assert.match(ratings,/sourceSet\(existing\)\.has\(RATING_SOURCES\.TMDB\)/);
});

test('DATA-002 treats MDBList 404 as expected provider miss and continues rescue',()=>{
  assert.match(ratings,/providerMiss/);
  assert.match(ratings,/provider_not_found/);
  assert.match(ratings,/MDBList no conoce el título; se activa la cascada de rescate/);
  assert.match(ratings,/expected:true/);
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
