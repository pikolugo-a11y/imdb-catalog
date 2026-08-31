import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Calidad incorpora Personas como dominio separado',()=>{
  const domain=read('lib/quality-home-domain.mjs');
  const page=read('app/calidad/page.js');
  assert.match(domain,/id:'people'/);
  assert.match(domain,/href:'\/calidad\/personas'/);
  assert.match(page,/StageCard stage=\{byId\.people\}/);
});

test('calidad de Personas clasifica nunca, caducada, error y correcta',()=>{
  const source=read('lib/people-quality.js');
  assert.match(source,/PERSON_QUALITY_MAX_AGE_DAYS=30/);
  assert.match(source,/technical_status='failed'/);
  assert.match(source,/THEN 'error'/);
  assert.match(source,/THEN 'never'/);
  assert.match(source,/interval '30 days'/);
  assert.match(source,/THEN 'stale'/);
  assert.match(source,/ELSE 'ok'/);
  assert.match(source,/process_code='PROC-PER-001'/);
});

test('Personas sigue siendo consulta y deriva mantenimiento a Calidad',()=>{
  const page=read('app/personas/page.js');
  const quality=read('app/calidad/personas/page.js');
  assert.match(page,/Calidad de Personas/);
  assert.match(page,/Sin actualizar/);
  assert.match(page,/Desactualizada/);
  assert.match(quality,/la ficha de Persona sigue siendo el único punto de actualización manual/);
  assert.doesNotMatch(quality,/refreshPersonFilmographyAction/);
  assert.match(quality,/Revisar y actualizar/);
});
