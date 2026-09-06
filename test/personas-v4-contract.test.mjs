import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('app/personas/page.js','utf8');
const detail=fs.readFileSync('app/personas/[id]/page.js','utf8');
const dashboard=fs.readFileSync('lib/people-dashboard.js','utf8');
const people=fs.readFileSync('lib/people-v2.js','utf8');
const css=fs.readFileSync('app/personas/personas-v4.css','utf8');

test('Personas V4 is relevance-first and keeps the approved discovery table',()=>{
  assert.match(page,/personas-v4\.css/);
  assert.match(page,/Destacados · Relevancia/);
  assert.match(page,/Filmografía relevante/);
  assert.match(page,/PikoScore medio/);
  assert.match(page,/En Plex/);
  assert.match(page,/Fuera de PikoFilm/);
  assert.doesNotMatch(page,/Cobertura|Pendientes/);
  assert.match(css,/\.pv4-mobile-list/);
});

test('Person relevance uses quality and diminishing returns instead of raw credits',()=>{
  assert.match(dashboard,/sort\):'relevance'/);
  assert.match(dashboard,/relevance_score/);
  assert.match(dashboard,/ln\(1\+GREATEST\(b\.role_movies/);
  assert.match(dashboard,/COALESCE\(b\.avg_score,0\)\*12/);
  assert.match(dashboard,/mc\.credit_type='cast'/);
  assert.match(dashboard,/lower\(COALESCE\(mc\.job,''\)\)='director'/);
  assert.match(dashboard,/outside_relevant/);
});

test('Personas keeps the bounded read-path performance contract',()=>{
  assert.doesNotMatch(dashboard,/ensurePeopleSchema|CREATE TABLE/i);
  assert.match(dashboard,/paged AS/);
  assert.match(dashboard,/LIMIT \$\{pageSize\} OFFSET \$\{offset\}/);
  assert.match(dashboard,/WHERE f\.tmdb_person_id=ANY/);
  assert.match(dashboard,/count\(\*\) OVER\(\)::int total_count/);
});

test('Person detail separates relevant and secondary credits and preserves explicit refresh',()=>{
  assert.match(detail,/getPersonV2\(id\)/);
  assert.match(detail,/refreshPersonFilmographyAction/);
  assert.match(detail,/Filmografía relevante/);
  assert.match(detail,/Otros créditos/);
  assert.match(detail,/Fuera de PikoFilm/);
  assert.match(detail,/\+ Novedades/);
  assert.match(detail,/Corto \(<60 min\)/);
  assert.match(detail,/Self \/ archivo/);
  assert.match(detail,/Making-of \/ especial/);
  assert.doesNotMatch(detail,/Pendientes/);
});

test('Filmography stays newest-first and catalog links never emit null ids',()=>{
  assert.match(people,/ORDER BY f\.year DESC NULLS LAST,f\.popularity DESC NULLS LAST/);
  assert.match(detail,/x\.in_catalog&&x\.imdb_id/);
  assert.doesNotMatch(detail,/x\.in_catalog\?<Link/);
});
