import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Operaciones V4 mantiene salud compacta pero muestra siempre las ejecuciones activas',async()=>{
  const source=await read('app/admin/page.js');
  assert.match(source,/name="q"/);
  assert.match(source,/Salud operativa/);
  assert.match(source,/Ejecuciones activas/);
  assert.match(source,/Estado vivo/);
  assert.match(source,/Incidencias activas/);
  assert.match(source,/Sistema \/ Batch/);
  assert.match(source,/Fuentes y límites/);
  assert.match(source,/Recuperación/);
  assert.match(source,/Mantenimiento/);
  assert.doesNotMatch(source,/Ejecuciones recientes/);
});

test('los filtros técnicos funcionan sin obligar a escribir búsqueda libre y permanecen visibles',async()=>{
  const query=await read('lib/operations-queries.js');
  const page=await read('app/admin/page.js');
  assert.match(query,/const hasFilters=Boolean\(q\|\|status\|\|kind\|\|process\|\|entity\|\|source/);
  assert.match(query,/AND \(\$\{q\}='' OR \(/);
  assert.match(query,/hasFilters\?sql/);
  assert.match(page,/Filtros de ejecuciones/);
  assert.match(page,/No se ocultan al aplicar la búsqueda/);
  assert.doesNotMatch(page,/<details className="ops-advanced"/);
});

test('technical search covers canonical runs titles people batch errors and events inside 30 days',async()=>{
  const source=await read('lib/operations-queries.js');
  assert.match(source,/now\(\)-interval '30 days'/);
  assert.match(source,/FROM movies m/);
  assert.match(source,/FROM people p/);
  assert.match(source,/FROM batch_run_items bi/);
  assert.match(source,/FROM process_run_errors e/);
  assert.match(source,/FROM process_run_events ev/);
  assert.match(source,/correlation_key/);
  assert.match(source,/idempotency_key/);
  assert.match(source,/match_reason/);
});

test('las ejecuciones activas detectan atasco y exponen control seguro',async()=>{
  const query=await read('lib/operations-queries.js');
  const page=await read('app/admin/page.js');
  const actions=await read('app/admin/actions.js');
  assert.match(query,/technical_status IN \('queued','running'\)/);
  assert.match(query,/interval '15 minutes'/);
  assert.match(query,/controllable_batch/);
  assert.match(page,/Cerrar como cancelada/);
  assert.match(page,/cancelRunAction/);
  assert.match(actions,/cancelBatch\(runId\)/);
  assert.match(actions,/technical_status='cancelled'/);
  assert.match(actions,/run_cancelled/);
  assert.match(actions,/El historial se conserva/);
  assert.match(actions,/La ejecución sigue viva/);
});

test('active incidents auto-resolve, group conservatively and reconcile group vs occurrence counts',async()=>{
  const source=await read('lib/operations-queries.js');
  assert.match(source,/NOT EXISTS[\s\S]*later\.technical_status='succeeded'/);
  assert.match(source,/COALESCE\(error_code,error_class,'MESSAGE:'\|\|left\(message,120\)\)/);
  assert.match(source,/active_error_occurrences/);
  assert.match(source,/incident_groups/);
  assert.match(source,/affected_runs/);
  assert.match(source,/affected_entities/);
  assert.match(source,/first_seen/);
  assert.match(source,/last_seen/);
});

test('manual incident dismissal is observed, reusable for recurrences, and never deletes error history',async()=>{
  const source=await read('app/admin/actions.js');
  assert.match(source,/PROC-OPS-002/);
  assert.match(source,/resolved_at=now\(\)/);
  assert.match(source,/::bigint/);
  assert.match(source,/incident_resolved/);
  assert.doesNotMatch(source,/DELETE FROM process_run_errors/);
  assert.match(source,/NOT EXISTS \(SELECT 1 FROM process_runs later/);
  assert.match(source,/resolve:\$\{scopeId\}:\$\{errorId\}/);
  assert.match(source,/return\{ok:true,message:/);
});

test('run detail explains outcome first and preserves deep technical drill-down',async()=>{
  const source=await read('app/admin/runs/[id]/page.js');
  assert.match(source,/Qué pasó/);
  assert.match(source,/Completado/);
  assert.match(source,/Estado final/);
  assert.match(source,/completedLabel/);
  assert.match(source,/Parcialmente/);
  assert.match(source,/Ver en Actividad/);
  assert.match(source,/Eventos, pasos y llamadas/);
  assert.match(source,/Identificadores y datos técnicos de bajo nivel/);
  assert.match(source,/<details/);
});

test('source control distinguishes configured hard and effective limits',async()=>{
  const ui=await read('components/OperationsApiSources.js');
  const admin=await read('lib/batch-api-admin.js');
  const governance=await read('lib/batch-api-governance.mjs');
  assert.match(ui,/Configurado:/);
  assert.match(ui,/Límite duro:/);
  assert.match(ui,/Efectivo:/);
  assert.match(admin,/hard_max_concurrency/);
  assert.match(admin,/effective_max_concurrency/);
  assert.match(governance,/export const SOURCE_HARD_CAPS/);
});

test('observability retention is coordinated at 30 days and protects live or retryable batch state',async()=>{
  const retention=await read('lib/process-observability-retention.js');
  const cron=await read('app/api/cron/activity-planner/route.js');
  assert.match(retention,/PROCESS_OBSERVABILITY_RETENTION_DAYS=30/);
  assert.match(retention,/technical_status IN \('succeeded','failed','partial','cancelled'\)/);
  assert.match(retention,/brc\.closed_at IS NULL/);
  assert.match(retention,/bi\.status IN \('queued','retry_wait','leased','running'\)/);
  assert.match(retention,/child\.technical_status IN \('queued','running'\)/);
  assert.match(cron,/purged_process_runs/);
});
