import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const actions=read('app/calidad/pikoquality/actions.js');
const page=read('app/calidad/pikoquality/page.js');
const operations=read('app/admin/pikoquality/page.js');
const opsHome=read('app/admin/page.js');
const adminActions=read('app/admin/pikoquality/actions.js');
const technicalActions=read('app/admin/pikoquality/TechnicalControlActions.js');
const runner=read('app/admin/pikoquality/C6ControlPanel.js');
const batch=read('lib/pikoquality-c6-batch.js');
const runtime=read('lib/pikoquality-c6-runtime.mjs');
const lifecycle=read('lib/pikoquality-lifecycle.js');
const technicalDashboard=read('lib/plex-technical-control.mjs');
const technicalScan=read('lib/plex-technical-scan.mjs');
const technicalWorker=read('worker/technical-snapshot-worker.mjs');
const technicalObservability=read('lib/pikoquality-technical-observability.mjs');
const opsHealth=read('lib/pikoquality-operations-health.js');
const display=read('lib/process-display.js');

test('PQ-001 is one canonical observed Batch across chunks',()=>{
  assert.match(actions,/C6_PROCESS_CODE='PROC-PQ-001'/);
  assert.match(actions,/runKind:'batch'/);
  assert.match(actions,/startProcessRun/);
  assert.match(actions,/batch_progress/);
  assert.match(actions,/finishProcessRun/);
  assert.match(actions,/items_processed=items_processed\+/);
  assert.match(actions,/items_pending=\$\{result\.remaining\}/);
  assert.match(runner,/startC6BatchRunAction/);
  assert.match(runner,/runC6BatchChunkAction\(id\)/);
  assert.match(display,/PROC-PQ-001/);
});

test('PQ-001 no longer writes pipeline_runs; process_runs is the execution truth',()=>{
  assert.doesNotMatch(batch,/pipeline_runs/);
  assert.match(batch,/FROM process_runs WHERE process_code='PROC-PQ-001'/);
});

test('C6 uses bounded chunks without changing its scoring core',()=>{
  assert.match(batch,/C6_BATCH_SIZE=1000/);
  assert.match(batch,/scorePikoQualityC6/);
  assert.match(batch,/source_fingerprint/);
  assert.match(runner,/bloques de hasta/);
});

test('PikoQuality conserva Recalcular ahora por entidad usando el core C6 vigente',()=>{
  assert.match(actions,/recalculatePikoQualityEntityAction/);
  assert.match(actions,/scorePikoQualityRatingKeys/);
  assert.match(actions,/runKind:'individual'/);
  assert.match(actions,/triggerSource:'calidad_pikoquality_unitary'/);
  assert.match(actions,/pikoquality_recalculate/);
  assert.match(runtime,/export async function scorePikoQualityRatingKeys/);
  assert.match(page,/recalculatePikoQualityEntityAction/);
  assert.match(page,/Recalcular ahora/);
  assert.match(page,/name="ratingKey" value=\{r\.href_key\}/);
  assert.match(page,/name="seasonIndex" value=\{r\.season_index\}/);
});

test('C6 reconcilia Lifecycle tanto en recálculo individual como en Batch',()=>{
  assert.match(lifecycle,/recomputeLifecycleForPikoQualityRatingKeys/);
  assert.match(lifecycle,/recomputeLifecycleWithSql/);
  assert.match(runtime,/recomputeLifecycleForPikoQualityRatingKeys\(sql,scoredKeys\)/);
  assert.match(batch,/recomputeLifecycleForPikoQualityRatingKeys\(sql,scoredKeys\)/);
});

test('la cobertura de Calidad incluye archivos activos sin captura técnica y no puede declarar un falso 100%',()=>{
  assert.match(page,/plex_technical_state pts/);
  assert.match(page,/technicalPending/);
  assert.match(page,/coverageTotal/);
  assert.match(page,/coveragePct/);
  assert.match(page,/archivos sin captura técnica/);
  assert.match(page,/s\.pending_a===0&&s\.errors===0&&technicalPending===0/);
  assert.match(page,/de \{nf\(coverageTotal\)\} archivos físicos activos/);
});

test('Calidad no expone barridos técnicos masivos y los deriva a Operaciones',()=>{
  assert.doesNotMatch(page,/TechnicalRunFlow/);
  assert.doesNotMatch(page,/C6BatchRunner/);
  assert.match(page,/href="\/admin\/pikoquality"/);
  assert.match(page,/SEGUIMIENTO AUTOMÁTICO/);
  assert.match(operations,/TechnicalControlActions/);
  assert.match(operations,/C6ControlPanel/);
  assert.match(actions,/triggerSource:'operations_pikoquality_manual'/);
});

test('mantenimiento PikoQuality muestra estado vivo y no duplica historial legacy',()=>{
  assert.match(technicalDashboard,/LEFT JOIN plex_technical_state/);
  assert.match(technicalDashboard,/FROM process_runs/);
  assert.match(technicalDashboard,/process_code='PROC-PQ-002'/);
  assert.doesNotMatch(technicalDashboard,/plex_technical_runs/);
  assert.doesNotMatch(technicalObservability,/plex_technical_runs/);
  assert.doesNotMatch(operations,/TechnicalRunFlow/);
  assert.doesNotMatch(operations,/C6BatchRunner/);
  assert.doesNotMatch(operations,/<table/);
  assert.match(operations,/biblioteca física → captura técnica → C6/);
  assert.match(operations,/Ver ejecuciones de captura en Operaciones/);
  assert.match(runner,/Ver ejecuciones C6 en Operaciones/);
});

test('cada nueva captura fuerza comprobación completa, rearma errores una vez y cuenta métricas por run',()=>{
  assert.match(technicalWorker,/lastScannedRunId/);
  assert.match(technicalWorker,/maybeScan\(runId,runId!==lastScannedRunId\)/);
  assert.doesNotMatch(technicalWorker,/reconcileStoppedTechnicalProcessRun/);
  assert.match(technicalScan,/prev\.snapshot_status==='error'/);
  assert.match(technicalScan,/retryErrorKeys/);
  assert.match(technicalScan,/last_error=NULL/);
  assert.match(technicalScan,/retried/);
  assert.match(technicalObservability,/'pikoquality_scored'/);
  assert.match(technicalWorker,/scored:result\.scored/);
  assert.match(technicalWorker,/context\.pikoquality_scored/);
});

test('Operaciones hace visible la deuda física PikoQuality sin inventar incidencias históricas',()=>{
  assert.match(opsHealth,/LEFT JOIN plex_technical_state/);
  assert.match(opsHealth,/capture_pending/);
  assert.match(opsHealth,/capture_errors/);
  assert.match(opsHome,/getPikoQualityOperationsHealth/);
  assert.match(opsHome,/Captura técnica PikoQuality pendiente/);
  assert.match(opsHome,/href="\/admin\/pikoquality"/);
});

test('el arranque desde Operaciones exige worker vivo también en servidor',()=>{
  assert.match(adminActions,/WORKER_FRESH_MS=90000/);
  assert.match(adminActions,/heartbeat_at/);
  assert.match(adminActions,/No se ha creado ninguna ejecución/);
  assert.match(technicalActions,/startTechnicalSnapshotFromOperationsAction/);
  assert.match(technicalActions,/workerOnline/);
});
