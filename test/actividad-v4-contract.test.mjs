import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Actividad V4 usa observabilidad canónica para histórico y no crea activity_logs',()=>{
  const source=read('lib/activity-v4.js'),migration=read('db/migrations/20260910_process_planning_v1.sql');
  assert.match(source,/FROM process_runs/);
  assert.match(source,/process_run_errors/);
  assert.match(source,/ACTIVITY_RETENTION_DAYS=30/);
  assert.doesNotMatch(source,/activity_logs|activity_events/);
  assert.doesNotMatch(migration,/activity_logs|activity_events/);
});

test('calendario futuro persiste intención mínima y conserva vínculo con ejecución real',()=>{
  const migration=read('db/migrations/20260910_process_planning_v1.sql');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS process_plans/);
  assert.match(migration,/pending_planning.*planned.*delayed.*dispatched.*completed.*cancelled.*expired/);
  assert.match(migration,/dispatch_run_id uuid NULL REFERENCES process_runs/);
  assert.match(migration,/deliberate_peak boolean/);
  assert.match(migration,/protected boolean/);
});

test('planificador automático sólo usa procesos seguros y nunca sincroniza Plex global',()=>{
  const planner=read('lib/process-planning.js');
  for(const code of ['PROC-MOV-001','PROC-SER-002','PROC-SER-003','PROC-SER-004','PROC-DATA-002','PROC-PER-001','PROC-PQ-001'])assert.match(planner,new RegExp(code));
  assert.doesNotMatch(planner,/PROC-NOV-009|syncPlexFastCore|syncPlexFast\(|scanPlexTechnicalLibrary/);
  assert.match(planner,/windowDays/);
  assert.match(planner,/recentSecondsPerItem/);
  assert.match(planner,/replanDelayed/);
});

test('Actividad ofrece cronología, calendario, planificación manual y refresco moderado',()=>{
  const page=read('app/actividad/page.js'),actions=read('app/actividad/actions.js'),refresh=read('app/actividad/ActivityRefresh.js');
  assert.match(page,/Cronología/);assert.match(page,/Calendario/);assert.match(page,/Pendiente de planificar/);
  assert.match(page,/Mantener como pico/);assert.match(page,/Cambiar prioridad/);assert.match(page,/Ver detalle técnico en Operaciones/);
  assert.match(actions,/PROC-PLAN-001/);assert.match(actions,/before:/);assert.match(actions,/after:/);
  assert.match(refresh,/30000/);assert.match(refresh,/visibilityState/);
});

test('navegación reemplaza el popover lifecycle por Actividad global',()=>{
  const nav=read('components/Nav.js');
  assert.match(nav,/\/actividad','Actividad','◷'/);
  assert.doesNotMatch(nav,/LifecycleActivity/);
});

test('cron horario planifica y snapshot diario ya no concentra mantenimiento',()=>{
  const vercel=read('vercel.json'),plannerCron=read('app/api/cron/activity-planner/route.js'),snapshot=read('app/api/cron/dashboard-snapshot/route.js');
  assert.match(vercel,/\/api\/cron\/activity-planner/);assert.match(vercel,/0 \* \* \* \*/);
  assert.match(plannerCron,/PROC-PLAN-002/);assert.match(plannerCron,/runActivityPlanner/);
  assert.doesNotMatch(snapshot,/qualityMaintenance|startMov001Batch|startSeriesBatch|startData002Batch|startPeopleBatch|processC6Batch/);
});
