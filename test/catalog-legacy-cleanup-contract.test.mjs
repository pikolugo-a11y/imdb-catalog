import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Catálogo V4 no expone estados funcionales o técnicos del pipeline',()=>{
  const page=read('app/catalogo/page.js');
  const queries=read('lib/catalog-v4-queries.js');
  assert.doesNotMatch(page,/markAcquiring|En proceso|Proceso|Lifecycle|lifecycle/);
  assert.doesNotMatch(page,/effective_status==='acquiring'|status bad|Falta|Faltan/);
  assert.doesNotMatch(queries,/attachLifecycle|acquisition_status/);
});

test('Ficha de Catálogo conserva la capacidad de exclusión reubicada',()=>{
  const detail=read('app/catalogo/[imdbId]/page.js');
  assert.doesNotMatch(detail,/EnrichTitleButton/);
  assert.doesNotMatch(detail,/saveIdentityAction/);
  assert.doesNotMatch(detail,/markAcquiring|clearAcquiring/);
  assert.doesNotMatch(detail,/Editar IDs|Editar identidad|Actualizar datos|EN PROCESO|En proceso/);
  assert.match(detail,/excludeTitle/);
  assert.match(detail,/Calidad → Identidad/);
});
