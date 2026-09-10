import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('app/sagas/page.js','utf8');
const detail=fs.readFileSync('app/sagas/[name]/page.js','utf8');
const model=fs.readFileSync('lib/sagas-v3.js','utf8');
const css=fs.readFileSync('app/sagas/sagas-v4.css','utf8');
const docs=fs.readFileSync('docs/V4_FUNCTIONAL_SPEC.md','utf8');

test('Sagas V4 uses collection/Plex language and table-first browse',()=>{
  assert.match(page,/sagas-v4\.css/);
  assert.match(page,/Completa en Plex/);
  assert.match(page,/Parcial en Plex/);
  assert.match(page,/Sin Plex/);
  assert.match(page,/A una película/);
  assert.match(page,/sv4-table/);
  assert.match(page,/50 por página/);
  assert.doesNotMatch(page,/Sin empezar|Ya has empezado|En progreso/);
  assert.match(css,/\.sv4-mobile-list/);
});

test('Default saga priority is almost complete then partial then complete then no Plex',()=>{
  assert.match(model,/sort\|\|'priority'/);
  assert.match(model,/n\(r\.missing\)===1&&n\(r\.owned\)>0\?0/);
  assert.match(model,/n\(r\.owned\)>0&&n\(r\.missing\)>0\?1/);
  assert.match(model,/n\(r\.actionable_total\)>0&&n\(r\.missing\)===0\?2:3/);
  assert.match(page,/casi completas → parciales → completas → sin Plex/);
});

test('Availability separates upcoming and cinema window and Plex proves material availability',()=>{
  assert.match(model,/effective_status='in_plex' THEN 'available'/);
  assert.match(model,/THEN 'upcoming'/);
  assert.match(model,/interval '90 days' THEN 'cinema'/);
  assert.match(model,/upcoming_count/);
  assert.match(model,/cinema_count/);
  assert.match(detail,/En cines/);
  assert.match(detail,/Próximamente/);
  assert.match(docs,/fallback conservador de 90 días/);
});

test('Saga score excludes outside and non-actionable works',()=>{
  assert.match(model,/avg\(m\.current_score\) FILTER\(WHERE m\.in_catalog AND m\.availability_phase='available'/);
  assert.match(detail,/const scored=actionable\.filter/);
  assert.match(docs,/Independiente de Plex|PikoScore de saga/i);
});

test('Detail keeps chronological composition and discovery through Novedades',()=>{
  assert.match(model,/ORDER BY sm\.year ASC NULLS LAST,sm\.position ASC/);
  assert.match(detail,/Fuera de PikoFilm/);
  assert.match(detail,/\+ Novedades/);
  assert.match(detail,/addSagaMemberToNewsAction/);
  assert.match(detail,/refreshSagaCollectionAction/);
  assert.match(detail,/Abrir ficha/);
});

test('Normal saga reads stay persisted and heavy refresh stays explicit',()=>{
  assert.doesNotMatch(model,/fetch\(|themoviedb\.org/);
  assert.match(page,/refreshAllSagasAction/);
  assert.match(detail,/refreshSagaCollectionAction/);
  assert.match(docs,/navegación normal.*nunca dispara TMDb/i);
});
