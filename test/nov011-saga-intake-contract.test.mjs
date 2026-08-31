import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/sagas/saga-news-actions.js','utf8');
const sagaPage=fs.readFileSync('app/sagas/[name]/page.js','utf8');
const news=fs.readFileSync('lib/news-v1.js','utf8');
const newsPage=fs.readFileSync('app/novedades/page.js','utf8');
const admission=fs.readFileSync('app/novedades/catalog-admission-actions.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-011 routes Saga titles directly as eligible minimum candidates',()=>{
  assert.match(action,/processCode:'PROC-NOV-011'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/origin:'saga'/);
  assert.match(action,/matchedRule:'saga_manual'/);
  assert.match(action,/eligibility_status[^\n]*'eligible'/);
  assert.doesNotMatch(action,/omdb|enrichTitle|Wikidata|FilmAffinity|imdbRatingsFromOfficialDataset/i);
  assert.match(sagaPage,/addSagaMemberToNewsAction/);
  assert.doesNotMatch(sagaPage,/addSagaMemberToNews from '@\/app\/actions'/);
});

test('Novedades exposes Saga as a first-class origin',()=>{
  assert.match(news,/s\.origin==='saga'/);
  assert.match(news,/\['manual','plex','saga','discovery'\]/);
  assert.match(newsPage,/v==='saga'\?'Saga'/);
  assert.match(newsPage,/<option value="saga">Saga<\/option>/);
});

test('NOV-007 preserves Saga origin but keeps TMDb as unvalidated evidence',()=>{
  assert.match(admission,/isSaga/);
  assert.match(admission,/origin==='saga'\?'saga'/);
  assert.match(admission,/tmdb_origin_evidence/);
  assert.match(admission,/tmdb_identity_validated:false/);
  assert.doesNotMatch(admission,/tmdb_id=|INSERT INTO movies\([^\n]*tmdb_id/);
  assert.match(display,/'PROC-NOV-011':\{name:'Añadir película de Saga a Novedades'\}/);
});
