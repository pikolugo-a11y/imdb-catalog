import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('app/catalogo/[imdbId]/page.js','utf8');
const extras=fs.readFileSync('lib/movie-detail-extras.js','utf8');
const layout=fs.readFileSync('app/catalogo/[imdbId]/layout.js','utf8');
const confirm=fs.readFileSync('app/catalogo/[imdbId]/ExcludeTitleForm.js','utf8');
const css=fs.readFileSync('app/catalogo/[imdbId]/ficha-v4.css','utf8');
const error=fs.readFileSync('app/catalogo/[imdbId]/error.js','utf8');

test('Ficha V4 keeps PikoScore primary and external ratings secondary',()=>{
  assert.match(page,/★ PikoScore/);
  assert.match(page,/Contexto externo/);
  assert.match(page,/Valoraciones de origen/);
  assert.match(page,/Confianza/);
  assert.doesNotMatch(page,/formula_version|3\.0\.0-experimental/);
});

test('Ficha V4 uses Plex only as physical inventory and quality context',()=>{
  assert.match(page,/Disponible físicamente/);
  assert.match(page,/Sin Plex/);
  assert.match(page,/Copia física/);
  assert.match(page,/PikoQuality/);
  assert.doesNotMatch(page,/Visto|No visto|Continuar viendo|Recomendad|pendiente de ver/i);
});

test('Ficha V4 never exposes technical Lifecycle pipeline status',()=>{
  assert.doesNotMatch(layout,/getLifecycleForIds|TECH_PENDING|PikoQuality pendiente|ESTADO DEL CICLO DE VIDA/);
  assert.match(layout,/return children/);
});

test('Series show compact season integrity without viewing semantics',()=>{
  assert.match(page,/Integridad física/);
  assert.match(page,/✓ Completa/);
  assert.match(page,/× Pendiente/);
  assert.match(page,/capítulos/);
  assert.match(page,/PikoQuality/);
  assert.match(page,/sin seguimiento de visionado/i);
});

test('Saga context is compact, secondary and counts real PikoFilm membership',()=>{
  assert.match(page,/Saga \/ colección/);
  assert.match(page,/en PikoFilm/);
  assert.match(page,/en Plex/);
  assert.match(page,/Boolean\(x\.display_title\)/);
  assert.match(css,/\.fv4-saga-strip/);
  assert.doesNotMatch(page,/te faltan|completar la saga|por ver/i);
});

test('Only active human quality cases surface as contextual attention',()=>{
  assert.match(extras,/movie_quality_findings/);
  assert.match(extras,/JOIN catalog_lifecycle cl ON cl\.imdb_id=f\.imdb_id AND cl\.lifecycle_state='MOVIE_FILE_REVIEW'/);
  assert.match(extras,/f\.rating_key=p\.rating_key/);
  assert.match(extras,/f\.status='pending'/);
  assert.match(extras,/f\.finding_type IN\('duration','filename','duplicate'\)/);
  assert.match(page,/⚠ Requiere tu atención/);
  assert.match(page,/Abrir en Calidad/);
  assert.match(page,/fallos técnicos y reintentos siguen perteneciendo a Operaciones/i);
  assert.match(css,/\.fv4-attention/);
});

test('Source identifiers link out in a new tab when an origin URL exists',()=>{
  assert.match(page,/https:\/\/www\.imdb\.com\/title/);
  assert.match(page,/https:\/\/www\.themoviedb\.org/);
  assert.match(page,/target="_blank"/);
  assert.match(page,/rel="noreferrer"/);
});

test('Exclusion remains visible, secondary and explicitly confirmed',()=>{
  assert.match(page,/Excluir de PikoFilm/);
  assert.match(confirm,/window\.confirm/);
  assert.match(confirm,/Pasará a Excluidas/);
  assert.match(css,/\.fv4-actions/);
});

test('Ficha V4 preserves safe return context across Catalog, Sagas and Personas',()=>{
  assert.match(page,/SAFE_BACK_PREFIXES=\['\/catalogo','\/sagas','\/personas','\/calidad\/personas'\]/);
  assert.match(page,/s===prefix\|\|s\.startsWith\(`\$\{prefix\}\/`\)\|\|s\.startsWith\(`\$\{prefix\}\?`\)/);
  assert.match(page,/!s\.startsWith\('\/\/'\)/);
  assert.match(page,/p\?\.from/);
  assert.match(page,/href=\{back\}/);
});

test('Secondary data failures do not block the complete title identity',()=>{
  assert.match(page,/Promise\.allSettled/);
  assert.match(error,/Reintentar/);
  assert.match(error,/información imprescindible/);
});
