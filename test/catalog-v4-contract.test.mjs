import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('app/catalogo/page.js','utf8');
const query=fs.readFileSync('lib/catalog-v4-queries.js','utf8');
const excluded=fs.readFileSync('app/catalogo/excluidas/page.js','utf8');
const excludedQuery=fs.readFileSync('lib/excluded-v4-queries.js','utf8');
const filters=fs.readFileSync('components/CatalogFiltersV4.js','utf8');
const css=fs.readFileSync('app/catalogo/catalog-v4.css','utf8');

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

test('Catalog V4 supports multi-genre OR and AND filtering on canonical genre schema',()=>{
  assert.match(query,/genreMode==='all'/);
  assert.match(query,/count\(DISTINCT g\.name_es\)/);
  assert.match(query,/movie_genres_canonical mgc JOIN genres g ON g\.id=mgc\.genre_id/);
  assert.match(query,/SELECT name_es value FROM genres/);
  assert.doesNotMatch(query,/g\.genre/);
  assert.match(page,/className="more">\+\{more\}/);
});

test('Catalog V4 supports multi-country filtering like genres',()=>{
  assert.match(page,/País/);
  assert.match(page,/countryPreview\(r\.countries\)/);
  assert.match(page,/getCatalogV4Countries/);
  assert.match(filters,/selectedCountries/);
  assert.match(filters,/countryMode/);
  assert.match(filters,/toggleCountry/);
  assert.match(filters,/countries\.map/);
  assert.match(query,/countryMode==='all'/);
  assert.match(query,/@>|&&/);
  assert.match(query,/movie_countries mc JOIN countries ctry/);
  assert.match(query,/getCatalogV4Countries/);
  assert.match(query,/array_agg\(DISTINCT ctry\.name_es ORDER BY ctry\.name_es\)/);
  assert.match(query,/regexp_split_to_array\(mv\.country/);
});

test('Excluidas V4 is a simple searchable reversible history',()=>{
  assert.match(excludedQuery,/EXCLUDED_V4_PAGE_SIZE=50/);
  assert.match(excludedQuery,/excluded_at DESC NULLS LAST/);
  assert.match(excluded,/Título/);assert.match(excluded,/Año/);assert.match(excluded,/Tipo/);assert.match(excluded,/Fecha de exclusión/);assert.match(excluded,/Restaurar/);
  assert.doesNotMatch(excluded,/PikoScore|PikoQuality|Motivo contiene|Ordenar|imdb_rating/);
  assert.doesNotMatch(excluded,/<th>IMDb<\/th>/);
  assert.match(excluded,/No hay títulos excluidos que coincidan con esta búsqueda/);
});


test('Catalogo Series integra PikoRelevancia como orden principal',()=>{
  assert.match(query,/SORTS=new Set\(\['score','relevance','quality','spain','year','title'\]\)/);
  assert.match(query,/scope==='series'\?'relevance':'score'/);
  assert.match(query,/series_relevance_assessments sra/);
  assert.match(query,/sra\.score pikorelevancia/);
  assert.match(page,/PikoRelevancia/);
  assert.match(page,/scoreSortHref\(s,'relevance'\)/);
});


test('Catalogo usa los contadores Plex como filtro y elimina combos redundantes',()=>{
  assert.match(page,/aria-label="Filtrar por presencia en Plex"/);
  assert.match(page,/plex:'in_plex'/);
  assert.match(page,/plex:'without_plex'/);
  assert.doesNotMatch(filters,/<span>Plex<\/span>/);
  assert.doesNotMatch(filters,/<span>Orden<\/span>/);
  assert.doesNotMatch(page,/<th>Plex<\/th>/);
});

test('la ordenación por cabeceras es global, server-side y vuelve a página uno',()=>{
  assert.match(page,/scoreSortHref\(s,'title'\)/);
  assert.match(page,/scoreSortHref\(s,'year'\)/);
  assert.match(page,/scoreSortHref\(s,'score'\)/);
  assert.match(page,/scoreSortHref\(s,'quality'\)/);
  assert.match(page,/scoreSortHref\(s,'relevance'\)/);
  assert.match(page,/sort:key,dir,page:1/);
  assert.match(query,/ORDER BY \$\{order\} LIMIT \$\{CATALOG_V4_PAGE_SIZE\} OFFSET \$\{offset\}/);
});

test('Tipo sólo se muestra como columna cuando el alcance es Todo',()=>{
  assert.match(page,/s\.scope==='all'&&<th className="col-type">Tipo<\/th>/);
  assert.match(page,/s\.scope==='all'&&<td>\{typeLabel\(r\.type\)\}<\/td>/);
});

test('PikoRelevancia usa escala visual de muy alta a muy baja',()=>{
  assert.match(page,/Number\(v\)>=80\?'very-high'/);
  assert.match(page,/Number\(v\)>=65\?'high'/);
  assert.match(page,/Number\(v\)>=50\?'medium'/);
  assert.match(page,/Number\(v\)>=35\?'low':'very-low'/);
});


test('Catálogo muestra resultados filtrados frente al universo del alcance',()=>{
  assert.match(query,/universeTotal/);
  assert.match(query,/universeWhere=scopeWhereSql/);
  assert.match(page,/de \$\{universeTotal\.toLocaleString\('es-ES'\)\}/);
  assert.match(page,/series':s\.scope==='movies'\?'películas':'títulos'/);
});

test('filtros activos son visibles y se pueden retirar uno a uno',()=>{
  assert.match(filters,/cv4-active-filters/);
  assert.match(filters,/Filtros activos/);
  assert.match(filters,/removeCountry/);
  assert.match(filters,/removeGenre/);
  assert.match(filters,/clearYears/);
  assert.match(filters,/Plex:/);
});

test('País y Géneros tienen búsqueda interna',()=>{
  assert.match(filters,/countrySearch/);
  assert.match(filters,/genreSearch/);
  assert.match(filters,/placeholder="Buscar país…"/);
  assert.match(filters,/placeholder="Buscar género…"/);
  assert.match(filters,/visibleCountries/);
  assert.match(filters,/visibleGenres/);
});

test('cabecera de tabla es sticky y el orden activo queda destacado',()=>{
  assert.match(css,/position:sticky;top:0/);
  assert.match(css,/\.cv4-table th\.sort-active/);
  assert.match(page,/sortClass\(s,'title'\)/);
  assert.match(page,/sortClass\(s,'relevance'\)/);
  assert.match(page,/cv4-sort-idle/);
});

test('ordenación por columna alterna dirección y vuelve al orden por defecto',()=>{
  assert.match(page,/const defaultKey=s\.scope==='series'\?'relevance':'score'/);
  assert.match(page,/if\(s\.sort!==key\)return catalogV4Href/);
  assert.match(page,/if\(s\.dir===initialDir\)return catalogV4Href/);
  assert.match(page,/return catalogV4Href\(s,\{sort:defaultKey,dir:'desc',page:1\}\)/);
});

test('PikoRelevancia explica escala y pendientes y usa formato español',()=>{
  assert.match(page,/Intl\.NumberFormat\('es-ES'/);
  assert.match(page,/PikoRelevancia todavía no calculada/);
  assert.match(page,/Pendiente/);
  assert.match(page,/Escala PikoRelevancia de 0 a 100/);
  assert.match(page,/0–100 ⓘ/);
});

test('móvil prioriza PikoRelevancia antes de PikoScore en Series',()=>{
  const rel=page.indexOf('cv4-mobile-rel');
  const score=page.indexOf('cv4-mobile-score');
  assert.ok(rel>-1&&score>-1&&rel<score);
  assert.match(page,/cv4-mobile-quality/);
});

test('volver desde una ficha conserva el estado completo del Catálogo',()=>{
  assert.match(page,/returnTo=catalogV4Href\(s\)/);
  assert.match(page,/encodeURIComponent\(returnTo\)/);
  assert.match(page,/titleHref\(r,returnTo\)/);
});
