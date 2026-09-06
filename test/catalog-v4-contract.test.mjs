import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('app/catalogo/page.js','utf8');
const query=fs.readFileSync('lib/catalog-v4-queries.js','utf8');
const excluded=fs.readFileSync('app/catalogo/excluidas/page.js','utf8');
const excludedQuery=fs.readFileSync('lib/excluded-v4-queries.js','utf8');

test('Catalog V4 is list-first and exposes only approved primary data',()=>{
  assert.match(query,/VIEWS=new Set\(\['list','posters'\]\)/);
  assert.match(query,/VIEWS\.has\(legacyView\)\?legacyView:'list'/);
  assert.match(page,/Título/);assert.match(page,/PikoScore/);assert.match(page,/PikoQuality/);assert.match(page,/En Plex/);assert.match(page,/Sin Plex/);
  assert.doesNotMatch(page,/IMDb|Votos|Duración|Flujo|Lifecycle|Excluir/);
  assert.doesNotMatch(page,/excludeTitle|restoreTitle/);
});

test('Catalog V4 keeps server pagination, stable URL state and neutral Plex semantics',()=>{
  assert.match(query,/CATALOG_V4_PAGE_SIZE=50/);
  assert.match(query,/NULLS LAST/);
  assert.match(query,/effective_status='in_plex'/);
  assert.match(page,/catalogV4Href/);
  assert.match(page,/No hay títulos que coincidan con estos filtros/);
  assert.match(page,/El año inicial no puede ser posterior/);
  assert.doesNotMatch(page,/Falta|Faltan/);
});

test('Catalog V4 supports multi-genre OR and AND filtering on complete genre data',()=>{
  assert.match(query,/genreMode==='all'/);
  assert.match(query,/count\(DISTINCT g\.genre\)/);
  assert.match(query,/EXISTS\(SELECT 1 FROM movie_genres_canonical/);
  assert.match(page,/className="more">\+\{more\}/);
});

test('Excluidas V4 is a simple searchable reversible history',()=>{
  assert.match(excludedQuery,/EXCLUDED_V4_PAGE_SIZE=50/);
  assert.match(excludedQuery,/excluded_at DESC NULLS LAST/);
  assert.match(excluded,/Título/);assert.match(excluded,/Año/);assert.match(excluded,/Tipo/);assert.match(excluded,/Fecha de exclusión/);assert.match(excluded,/Restaurar/);
  assert.doesNotMatch(excluded,/PikoScore|PikoQuality|IMDb|Motivo contiene|Ordenar/);
  assert.match(excluded,/No hay títulos excluidos que coincidan con esta búsqueda/);
});
