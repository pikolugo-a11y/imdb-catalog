import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Calidad V4 usa navegación híbrida de tres superficies',()=>{
  const nav=read('components/Nav.js');
  assert.match(nav,/qualityPrimaryItems/);
  assert.match(nav,/\/calidad\/centro','Centro de Calidad'/);
  assert.match(nav,/\/calidad\/peliculas','Películas'/);
  assert.match(nav,/\/calidad\/series','Series'/);
  assert.match(nav,/Centro · Identidad/);
});

test('Centro de Calidad agrupa las áreas comunes sin eliminar sus rutas funcionales',()=>{
  const center=read('app/calidad/centro/page.js');
  for(const route of ['/calidad/identidad','/calidad/validacion-identidad','/calidad/datos','/calidad/personas','/calidad/pikoquality','/calidad/sin-estado'])assert.ok(center.includes(route),`Falta ${route}`);
  assert.match(center,/no existe una cola transversal/i);
});

test('Series separa atención humana de seguimiento automático',()=>{
  const query=read('lib/series-quality-query.js');
  const page=read('app/calidad/series/page.js');
  assert.match(query,/counts\.attention=counts\.missing\+counts\.unmapped/);
  assert.match(query,/counts\.tracking=counts\.pre_quality\+counts\.plex_sync\+counts\.tmdb_refresh\+counts\.unknown/);
  assert.match(query,/state==='tracking'/);
  assert.match(page,/Seguimiento automático/);
  assert.match(page,/Forzar actualización/);
  assert.match(page,/\['attention','Atención',c\.attention\],\['tracking','Seguimiento',c\.tracking\],\['uptodate','Al día',c\.uptodate\]/);
});

test('Películas distingue incidencias de validación pendiente',()=>{
  const page=read('app/calidad/peliculas/page.js');
  assert.match(page,/Requieren atención/);
  assert.match(page,/En seguimiento/);
  assert.match(page,/Analizar ahora/);
  assert.match(page,/Ya la corregí/);
});

test('home model conserva Centro común y especialización de Películas y Series',()=>{
  const source=read('lib/quality-home-domain.mjs');
  assert.match(source,/QUALITY_CENTER_STAGE_IDS=.*identity.*validation.*data.*people.*pikoquality.*recovery/);
  assert.match(source,/QUALITY_SPECIALIZED_STAGE_IDS=.*movies.*series/);
  assert.match(source,/En seguimiento automático/);
});
