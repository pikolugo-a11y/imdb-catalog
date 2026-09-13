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

test('Plex conserva la ruta física completa y la ficha la resume sin llamar a Plex en render',()=>{
  const plex=read('lib/series-plex-sync.js');
  const query=read('lib/series-detail-query.js');
  const card=read('app/calidad/series/[ratingKey]/SeriesPhysicalManualCard.js');
  assert.match(plex,/const filePathOf=/);
  assert.match(plex,/file_path:filePathOf\(p\.file\)/);
  assert.doesNotMatch(plex,/const filenameOf=/);
  assert.match(query,/plex_files/);
  assert.match(query,/physicalLocation/);
  assert.match(card,/Ubicación física/);
  assert.match(card,/Actualizar Plex/);
});

test('una serie puede cuadrarse manualmente sin falsificar la evidencia física Plex',()=>{
  const migration=read('db/migrations/20260913_series_manual_complete.sql');
  const action=read('app/calidad/series/manual-complete-actions.js');
  const domain=read('lib/series-quality-domain.mjs');
  const page=read('app/calidad/series/[ratingKey]/page.js');
  const card=read('app/calidad/series/[ratingKey]/SeriesPhysicalManualCard.js');
  assert.match(migration,/series_quality_overrides/);
  assert.match(migration,/WHEN manual_complete THEN 'present'/);
  assert.match(migration,/plex_diagnostic_status/);
  assert.match(action,/processCode:'PROC-SER-008'/);
  assert.match(action,/manual_complete/);
  assert.match(domain,/MANUAL_COMPLETE/);
  assert.match(domain,/Cuadrada manualmente/);
  assert.match(page,/e\.plex_diagnostic_status/);
  assert.match(page,/No encontrado · aceptado por ajuste de serie/);
  assert.match(card,/no modificará Plex ni borrará el diagnóstico físico/i);
  assert.match(card,/Volver al diagnóstico automático/);
});
