import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Actividad prioriza nombres humanos, decisiones manuales y agrupa automatización sin cambios',()=>{
  const source=read('lib/activity-v4.js');
  assert.match(source,/LEFT JOIN series_reference asr/);
  assert.match(source,/after_compact->>'entity_label'/);
  assert.match(source,/Marcaste .* como incluido en/);
  assert.match(source,/La decisión queda guardada hasta que tú la cambies/);
  assert.match(source,/collapsePlannerNoise/);
  assert.match(source,/comprobaciones automáticas realizadas\. No hubo cambios/);
  assert.match(source,/activity_summary/);
});

test('los KPIs de Actividad no mezclan deuda estructural de Calidad con lo que está pasando',()=>{
  const page=read('app/actividad/page.js');
  assert.match(page,/En curso ahora/);
  assert.match(page,/Próximos 7 días/);
  assert.match(page,/Pendiente de planificar/);
  assert.doesNotMatch(page,/Requiere atención/);
  assert.doesNotMatch(page,/summary\.attention|attentionBreakdown|breakdown\.lifecycle/);
});

test('SER-002 emite cambios funcionales demostrables antes/después para Actividad',()=>{
  const worker=read('worker/batch-plex-worker.mjs');
  assert.match(worker,/diagnosticSnapshot/);
  assert.match(worker,/diagnosticDiff/);
  assert.match(worker,/becamePresent/);
  assert.match(worker,/becameMissing/);
  assert.match(worker,/eventType:'functional_change'/);
  assert.match(worker,/activity_summary/);
  assert.match(worker,/Se recuperó/);
});

test('Operaciones deja historial técnico en diagnóstico avanzado y prioriza atención actual',()=>{
  const page=read('app/admin/page.js');
  assert.match(page,/¿Hay algo que hacer\?/);
  assert.match(page,/Necesita atención/);
  assert.match(page,/<details className="ops-search-panel" open=\{d\.hasFilters\}>/);
  assert.match(page,/Diagnóstico avanzado/);
  assert.match(page,/Buscar historial técnico, IDs y procesos/);
  assert.match(page,/entity\|\|proc\.name/);
});

test('búsqueda técnica de Operaciones también resuelve y busca series por nombre',()=>{
  const source=read('lib/operations-queries.js');
  assert.match(source,/series_reference sr/);
  assert.match(source,/AS entity_label/);
  assert.match(source,/THEN 'Serie'/);
  assert.match(source,/COALESCE\(sr\.title,''\) ILIKE/);
});

test('la decisión UX queda persistida en documentación V4',()=>{
  const docs=read('docs/V4_ACTIVITY_OPERATIONS_HUMAN_UX_2026-09-12.md');
  assert.match(docs,/Actividad responde «¿qué pasó\?»/);
  assert.match(docs,/Operaciones responde «¿hay algo que tenga que hacer\?»/);
  assert.match(docs,/Nunca se inventa un resultado/);
});
