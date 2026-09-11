import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const unitary=fs.readFileSync(new URL('../lib/series-unitary-core.mjs',import.meta.url),'utf8');
const reconcile=fs.readFileSync(new URL('../lib/series-reference-reconcile-core.mjs',import.meta.url),'utf8');
const qualityQuery=fs.readFileSync(new URL('../lib/series-quality-query.js',import.meta.url),'utf8');
const qualityPage=fs.readFileSync(new URL('../app/calidad/series/page.js',import.meta.url),'utf8');

test('SER-003 permite refrescar una serie TMDb-only sin depender de validación IMDb',()=>{
  assert.match(unitary,/identity_mode'='tmdb_only'/);
  assert.match(unitary,/m\.tmdb_id IS NOT NULL/);
  assert.match(unitary,/OR iv\.validation_status='valid'/);
  assert.match(unitary,/CASE WHEN m\.source_status->>'identity_mode'='tmdb_only' THEN m\.tmdb_id ELSE r\.tmdb_id END AS tmdb_id/);
  assert.match(unitary,/reference_source='tmdb_only_manual'/);
});

test('la reconciliación Plex no puede sustituir el TMDb manual de una serie TMDb-only',()=>{
  assert.match(reconcile,/m\.source_status->>'identity_mode'='tmdb_only'/);
  assert.match(reconcile,/THEN m\.tmdb_id ELSE p\.tmdb_id END new_tmdb/);
  assert.match(reconcile,/COALESCE\(m\.source_status->>'identity_mode','normal'\)<>'tmdb_only'/);
  assert.match(reconcile,/tmdb_only_manual/);
});

test('una alta Plex TMDb-only sin IMDb se enlaza por TMDb y puede crear series_reference',()=>{
  assert.match(reconcile,/m\.tmdb_id=p\.tmdb_id/);
  assert.match(reconcile,/m\.source_status->>'identity_mode'='tmdb_only'/);
  assert.match(reconcile,/m\.imdb_id=p\.imdb_id/);
  assert.match(reconcile,/INSERT INTO series_reference/);
});

test('Calidad de Series expone el refresco TMDb aunque la referencia aún no exista',()=>{
  assert.match(qualityQuery,/LEFT JOIN plex_show_effective_ids pe ON pe\.rating_key=rm\.show_rating_key/);
  assert.match(qualityQuery,/tm\.source_status->>'identity_mode'='tmdb_only'/);
  assert.match(qualityQuery,/tm\.tmdb_id=pe\.tmdb_id/);
  assert.match(qualityQuery,/COALESCE\(tm\.imdb_id,rm\.imdb_id\) effective_imdb_id/);
  assert.match(qualityPage,/const imdbId=r\.effective_imdb_id\|\|r\.imdb_id/);
  assert.match(qualityPage,/action=\{refreshOneSeriesAction\}/);
  assert.doesNotMatch(qualityPage,/r\.has_reference&&r\.imdb_id\?<ActionButton[^\n]+refreshOneSeriesAction/);
});
