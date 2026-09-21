import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('la ficha no carga listas de anomalías ni actividad batch por defecto',()=>{
  const query=read('lib/series-detail-query.js');
  const page=read('app/calidad/series/[ratingKey]/page.js');
  assert.doesNotMatch(query,/FROM process_runs/);
  assert.doesNotMatch(page,/Actividad reciente/);
  assert.doesNotMatch(page,/summary\.runs/);
  assert.match(query,/anomalyCounts/);
  assert.match(page,/Revisión excepcional/);
});

test('pendientes y decisiones manuales se consultan sólo al abrir su panel',()=>{
  const query=read('lib/series-detail-query.js');
  const page=read('app/calidad/series/[ratingKey]/page.js');
  assert.match(query,/export async function getSeriesAnomalyPanel/);
  assert.match(query,/SERIES_ANOMALY_PAGE_SIZE=50/);
  assert.match(page,/panel\?getSeriesAnomalyPanel/);
  assert.match(page,/panel:'pending'/);
  assert.match(page,/panel:'manual'/);
  assert.match(page,/series-side-panel/);
});

test('temporadas y episodios siguen siendo el cuerpo principal y paginado',()=>{
  const page=read('app/calidad/series/[ratingKey]/page.js');
  const query=read('lib/series-detail-query.js');
  assert.match(page,/<h2>Temporadas<\/h2>/);
  assert.match(page,/episode-workbench/);
  assert.match(page,/getSeriesEpisodeScope/);
  assert.match(query,/SERIES_EPISODE_PAGE_SIZE=100/);
  assert.match(query,/LIMIT \$\{size\} OFFSET \$\{offset\}/);
});

test('los botones manuales permanecen pero sin seguimiento de ejecuciones en la ficha',()=>{
  const page=read('app/calidad/series/[ratingKey]/page.js');
  assert.match(page,/Actualizar fuentes/);
  assert.match(page,/Actualizar \$\{m\.label\}/);
  assert.match(page,/sin seguimiento batch/i);
  assert.doesNotMatch(page,/Último cambio\/proceso/);
  assert.doesNotMatch(page,/Última:/);
});

test('la ampliación doble a triple usa evidencia mínima del episodio anterior',()=>{
  const page=read('app/calidad/series/[ratingKey]/page.js');
  const query=read('lib/series-detail-query.js');
  assert.match(query,/previous_combined_note/);
  assert.match(page,/combinedEvidence\(e\.previous_combined_note\)/);
  assert.match(page,/Ampliar a capítulo triple/);
  assert.doesNotMatch(page,/combinedByEpisode/);
});


test('episodios sin fecha TMDb no son exigibles ni pendientes de disponibilidad',()=>{
  const query=read('lib/series-detail-query.js');
  const list=read('lib/series-quality-query.js');
  const lifecycle=read('lib/lifecycle-recompute-core.mjs');
  const page=read('app/calidad/series/[ratingKey]/page.js');
  assert.match(query,/air_date IS NULL THEN 'date_pending'/);
  assert.match(query,/air_date IS NOT NULL AND air_date<=CURRENT_DATE/);
  assert.match(query,/air_date IS NULL OR air_date>CURRENT_DATE/);
  assert.match(list,/episode_pending_premiere FROM series_episode_effective_status/);
  assert.match(list,/e\.effective_status<>'present'.*e\.air_date IS NULL OR e\.air_date>CURRENT_DATE/);
  assert.match(query,/e\.effective_status<>'present'.*e\.air_date IS NULL OR e\.air_date>CURRENT_DATE/);
  assert.match(query,/effective_status<>'present'.*air_date IS NULL OR air_date>CURRENT_DATE/);
  assert.match(lifecycle,/e\.air_date IS NOT NULL AND e\.air_date<=CURRENT_DATE/);
  assert.match(page,/Sin fecha de estreno/);
  assert.match(page,/No exigible aún/);
});
