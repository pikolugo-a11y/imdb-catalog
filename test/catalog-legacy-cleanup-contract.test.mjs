import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Catálogo no expone el estado funcional En proceso',()=>{
  const page=read('app/catalogo/page.js');
  const filters=read('components/CatalogFiltersV3.js');
  const queries=read('lib/catalog-v3-queries.js');
  assert.doesNotMatch(page,/markAcquiring|En proceso|Proceso<|acquiring/);
  assert.doesNotMatch(filters,/En proceso/);
  assert.match(queries,/rawStatus==='acquiring'\?'missing'/);
  assert.doesNotMatch(queries,/stats\.acquiring/);
});

test('Ficha de Catálogo es consulta, navegación y exclusión',()=>{
  const detail=read('app/catalogo/[imdbId]/page.js');
  assert.doesNotMatch(detail,/EnrichTitleButton/);
  assert.doesNotMatch(detail,/saveIdentityAction/);
  assert.doesNotMatch(detail,/markAcquiring|clearAcquiring/);
  assert.doesNotMatch(detail,/Editar IDs|Editar identidad|Actualizar datos|EN PROCESO|En proceso/);
  assert.match(detail,/excludeTitle/);
  assert.match(detail,/Calidad → Identidad/);
});
