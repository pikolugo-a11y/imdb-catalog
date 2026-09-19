import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Series muestra totales globales de capítulos y baja el desglose a series',()=>{
  const page=read('app/calidad/series/page.js');
  for(const label of ['ESTADO GLOBAL DE CAPÍTULOS','Faltan en Plex','Exigibles ahora','Pendientes España','Estreno / margen'])assert.ok(page.includes(label),`Falta ${label}`);
  assert.match(page,/episodeCards\.map/);
  assert.match(page,/view:'all',episode:value/);
  assert.match(page,/Cada fila resume sus capítulos/);
  assert.match(page,/r\.episode_missing_total/);
  assert.match(page,/r\.episode_actionable_now/);
  assert.match(page,/r\.episode_pending_spain/);
  assert.match(page,/r\.episode_pending_premiere/);
});

test('la exigibilidad usa un margen canónico de siete días en listado y detalle',()=>{
  const policy=read('lib/series-exigibility.mjs');
  const query=read('lib/series-quality-query.js');
  const detail=read('lib/series-detail-query.js');
  const detailPage=read('app/calidad/series/[ratingKey]/page.js');
  assert.match(policy,/SERIES_EPISODE_GRACE_DAYS=7/);
  assert.match(query,/SERIES_EPISODE_GRACE_DAYS/);
  assert.match(detail,/SERIES_EPISODE_GRACE_DAYS/);
  assert.match(query,/episode_actionable_now[\s\S]*CURRENT_DATE-\(\$\{SERIES_EPISODE_GRACE_DAYS\} \* interval '1 day'\)/);
  assert.match(query,/episode_pending_premiere[\s\S]*CURRENT_DATE-\(\$\{SERIES_EPISODE_GRACE_DAYS\} \* interval '1 day'\)/);
  assert.match(detail,/eligible[\s\S]*CURRENT_DATE-\(\$\{SERIES_EPISODE_GRACE_DAYS\} \* interval '1 day'\)/);
  assert.match(detail,/premiere_pending/);
  assert.match(detail,/grace_period/);
  assert.match(detailPage,/t\.present,t\.eligible/);
  assert.match(detailPage,/Margen \$\{SERIES_EPISODE_GRACE_DAYS\} días/);
});

test('los filtros de capítulo devuelven series afectadas, no un listado global de episodios',()=>{
  const query=read('lib/series-quality-query.js');
  assert.match(query,/episodeAllowed=new Set\(\['all','missing','actionable','spain','premiere'\]\)/);
  assert.match(query,/episodeField=.*episode_missing_total.*episode_actionable_now.*episode_pending_spain.*episode_pending_premiere/);
  assert.match(query,/filtered=filtered\.filter\(r=>n\(r\[episodeField\]\)>0\)/);
  assert.doesNotMatch(read('app/calidad/series/page.js'),/data\.episodes\.map/);
});

test('la ordenación de faltantes usa sólo capítulos exigibles',()=>{
  const query=read('lib/series-quality-query.js');
  assert.match(query,/sort==='missing_asc'[\s\S]*episode_actionable_now/);
  assert.match(query,/sort==='missing_desc'[\s\S]*episode_actionable_now/);
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
