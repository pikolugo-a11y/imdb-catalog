import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Series muestra totales globales de capítulos y baja el desglose a series',()=>{
  const page=read('app/calidad/series/page.js');
  for(const label of ['ESTADO GLOBAL DE CAPÍTULOS','Faltan en Plex','Exigibles ahora','Pendientes España','Pendientes estreno'])assert.ok(page.includes(label),`Falta ${label}`);
  assert.match(page,/episodeCards\.map/);
  assert.match(page,/view:'all',episode:value/);
  assert.match(page,/Cada fila resume sus capítulos/);
  assert.match(page,/r\.episode_missing_total/);
  assert.match(page,/r\.episode_actionable_now/);
  assert.match(page,/r\.episode_pending_spain/);
  assert.match(page,/r\.episode_pending_premiere/);
});

test('una fecha futura tiene prioridad y nunca entra en exigibles',()=>{
  const query=read('lib/series-quality-query.js');
  assert.match(query,/episode_pending_premiere.*air_date>CURRENT_DATE/);
  assert.match(query,/episode_actionable_now.*air_date IS NULL OR e\.air_date<=CURRENT_DATE.*missing_actionable/);
  assert.match(query,/actionable_missing:n\(r\.episode_actionable_now\)/);
  assert.match(query,/episode_pending_spain.*availability_unknown','not_available_es/);
});

test('los filtros de capítulo devuelven series afectadas, no un listado global de episodios',()=>{
  const query=read('lib/series-quality-query.js');
  assert.match(query,/episodeAllowed=new Set\(\['all','missing','actionable','spain','premiere'\]\)/);
  assert.match(query,/episodeField=.*episode_missing_total.*episode_actionable_now.*episode_pending_spain.*episode_pending_premiere/);
  assert.match(query,/filtered=filtered\.filter\(r=>n\(r\[episodeField\]\)>0\)/);
  assert.doesNotMatch(read('app/calidad/series/page.js'),/data\.episodes\.map/);
});

test('Actualizar Plex deja claro que conserva series y añade capítulos por diferencias',()=>{
  const page=read('app/calidad/series/page.js');
  const actions=read('app/calidad/series/actions.js');
  assert.match(page,/label="Actualizar Plex"/);
  assert.match(page,/Series \+ capítulos · sincronización rápida por diferencias/);
  assert.match(page,/action=\{syncPlexSeriesFastAction\}/);
  assert.match(actions,/episodeDelta/);
  assert.match(actions,/PROC-SER-002/);
});
