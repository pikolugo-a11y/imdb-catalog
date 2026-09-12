import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

// NOTE: contrato V4 de Actividad. Estos tests son deliberadamente estructurales para
// impedir regresiones de arquitectura/UX sin acoplarse a datos concretos de producción.

test('Actividad V4 usa observabilidad canónica para histórico y no crea activity_logs',()=>{
  const source=read('lib/activity-v4.js');
  assert.match(source,/FROM process_runs r/);
  assert.match(source,/r\.parent_run_id IS NULL/);
  assert.doesNotMatch(source,/activity_logs/);
});

test('búsqueda y detalle resuelven entidades humanas sin copiar nombres al log',()=>{
  const source=read('lib/activity-v4.js');
  assert.match(source,/LEFT JOIN movies am/);
  assert.match(source,/LEFT JOIN people ap/);
  assert.match(source,/LEFT JOIN saga_collections ascg/);
  assert.match(source,/entity_label/);
  assert.match(source,/process_run_errors/);
});

test('Actividad nunca muestra mensajes técnicos crudos de process_run_errors',()=>{
  const source=read('lib/activity-v4.js'),page=read('app/actividad/page.js');
  assert.doesNotMatch(source,/SELECT[^`]*message[^`]*FROM process_run_errors/s);
  assert.match(source,/functionalMessage/);
  assert.match(source,/nextStep/);
  assert.doesNotMatch(page,/x\.message/);
});

test('calendario futuro persiste intención mínima y conserva vínculo con ejecución real',()=>{
  const planning=read('lib/process-planning.js'),migration=read('migrations/20260910_v4_activity_planning.sql');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS process_plans/);
  assert.match(migration,/dispatch_run_id UUID/);
  assert.match(migration,/planned_volume BIGINT/);
  assert.match(planning,/INSERT INTO process_plans/);
  assert.match(planning,/dispatch_run_id/);
});

test('planificador automático sólo usa procesos seguros y nunca sincroniza Plex global',()=>{
  const source=read('lib/process-planning.js');
  assert.match(source,/SAFE_AUTOMATIC_PROCESS_CODES=\['PROC-MOV-001','PROC-SER-002','PROC-SER-003','PROC-SER-004','PROC-DATA-002','PROC-PER-001','PROC-PQ-001'\]/);
  assert.doesNotMatch(source,/PROC-NOV-009/);
});

test('planificador proyecta demanda futura real sin inventar fechas para procesos event-driven',()=>{
  const source=read('lib/process-planning.js');
  assert.match(source,/futureBuckets/);
  assert.match(source,/PROC-SER-003/);
  assert.match(source,/PROC-SER-004/);
  assert.match(source,/PROC-DATA-002/);
  assert.match(source,/PROC-PER-001/);
  assert.match(source,/forecast_due_at/);
});

test('planificador agrupa vencimientos por proceso y no duplica Batch activos',()=>{
  const source=read('lib/process-planning.js');
  assert.match(source,/getActiveBatch/);
  assert.match(source,/groups\.get\(row\.process_code\)/);
  assert.match(source,/planned_volume/);
});

test('Actividad ofrece cronología, calendario, planificación manual y refresco moderado',()=>{
  const page=read('app/actividad/page.js'),actions=read('app/actividad/actions.js'),refresh=read('app/actividad/ActivityRefresh.js');
  assert.match(page,/Cronología/);
  assert.match(page,/Calendario/);
  assert.match(page,/reschedulePlan/);
  assert.match(page,/setPlanPriority/);
  assert.match(page,/togglePlanProtection/);
  assert.match(actions,/PROC-PLAN-001/);
  assert.match(refresh,/15000/);
});

test('Calendario V4 muestra 30 días como agenda semanal y conserva días vacíos',()=>{
  const page=read('app/actividad/page.js');
  assert.match(page,/PRÓXIMOS 30 DÍAS/);
  assert.match(page,/Sin trabajo planificado/);
  assert.match(page,/Día libre/);
  assert.match(page,/mondayKey/);
  assert.match(page,/calendarDays/);
});

test('Calendario usa un alias SQL no reservado para el día de Madrid',()=>{
  const source=read('lib/activity-v4.js');
  assert.match(source,/AS day_key/);
  assert.doesNotMatch(source,/AS day,/);
});

test('Actividad permite forzar el mismo ciclo PLAN-002 desde el frontal sin convertirlo en salud automática',()=>{
  const actions=read('app/actividad/actions.js'),page=read('app/actividad/page.js'),cycle=read('lib/activity-planner-cycle.js');
  assert.match(actions,/executeAutomaticPlanningCycle/);
  assert.match(actions,/triggerSource:'activity_manual'/);
  assert.match(cycle,/processCode:'PROC-PLAN-002'/);
  assert.match(page,/Ejecutar ciclo automático ahora/);
});

test('Actividad sólo declara automatización sana con secreto, despacho frecuente y recálculo horario automáticos',()=>{
  const source=read('lib/activity-v4.js'),page=read('app/actividad/page.js');
  assert.match(source,/CRON_SECRET/);
  assert.match(source,/ACTIVITY_DISPATCH_HEALTH_MINUTES=15/);
  assert.match(source,/ACTIVITY_PLANNER_HEALTH_MINUTES=75/);
  assert.match(source,/dispatchHealthy/);
  assert.match(source,/fullHealthy/);
  assert.match(source,/plannerHealthy=cronSecretConfigured&&dispatchHealthy&&fullHealthy/);
  assert.match(page,/Automatización activa/);
  assert.match(page,/cada 5 minutos/);
  assert.match(page,/El botón manual no cuenta/);
});

test('despacho frecuente reutiliza PLAN-002 sin recalcular demanda pesada cada cinco minutos',()=>{
  const vercel=read('vercel.json'),plannerCron=read('app/api/cron/activity-planner/route.js'),cycle=read('lib/activity-planner-cycle.js'),planner=read('lib/process-planning.js');
  assert.match(vercel,/\*\/5 \* \* \* \*/);
  assert.match(plannerCron,/cycleMode\(date\)/);
  assert.match(plannerCron,/getUTCMinutes\(\)===0\?'full':'dispatch'/);
  assert.match(plannerCron,/slotKey/);
  assert.match(plannerCron,/PROC-PLAN-002:\$\{mode\}:/);
  assert.match(cycle,/mode==='dispatch'/);
  assert.match(cycle,/runActivityDispatchTick/);
  assert.match(planner,/export async function runActivityDispatchTick/);
  assert.match(planner,/dispatchDue\(sql,settings,\{includeDelayed:false\}\)/);
  assert.match(planner,/loadAutomationSettings\(sql\)/);
});

test('calendario detecta picos agregados usando carga histórica real',()=>{
  const source=read('lib/activity-v4.js'),page=read('app/actividad/page.js');
  assert.match(source,/percentile_cont\(0\.75\)/);
  assert.match(source,/date_trunc\('day',requested_at\) AS bucket_day/);
  assert.doesNotMatch(source,/date_trunc\('day',requested_at\) day/);
  assert.match(source,/estimatedLoad>baseline\*1\.5/);
  assert.match(page,/Carga que merece revisión/);
});

test('navegación reemplaza el popover lifecycle por Actividad global',()=>{
  const nav=read('components/Nav.js');
  assert.match(nav,/Actividad/);
  assert.doesNotMatch(nav,/LifecyclePopover/);
});

test('cron de Actividad mantiene recálculo completo horario y snapshot diario separado',()=>{
  const vercel=read('vercel.json'),cron=read('app/api/cron/activity-planner/route.js');
  assert.match(vercel,/activity-planner/);
  assert.match(vercel,/dashboard-snapshot/);
  assert.match(cron,/cycleMode/);
  assert.match(cron,/full/);
});

test('planes terminales se purgan tras la ventana funcional de 30 días sólo en ciclo completo',()=>{
  const cycle=read('lib/activity-planner-cycle.js'),retention=read('lib/process-observability-retention.js');
  assert.match(cycle,/purgeTerminalProcessPlans/);
  assert.match(cycle,/mode==='full'/);
  assert.match(retention,/30/);
});
