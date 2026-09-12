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

test('búsqueda y detalle resuelven entidades humanas sin copiar nombres al log',()=>{
  const source=read('lib/activity-v4.js'),page=read('app/actividad/page.js');
  assert.match(source,/LEFT JOIN movies am/);
  assert.match(source,/LEFT JOIN people ap/);
  assert.match(source,/LEFT JOIN saga_collections ascg/);
  assert.match(source,/am\.title_es/);
  assert.match(page,/\/catalogo\/\$\{imdbId\}/);
});

test('Actividad nunca muestra mensajes técnicos crudos de process_run_errors',()=>{
  const source=read('lib/activity-v4.js'),page=read('app/actividad/page.js');
  assert.doesNotMatch(source,/SELECT error_id,occurred_at,entity_type,entity_id,message/);
  assert.match(source,/functionalMessage/);
  assert.match(source,/nextStep/);
  assert.doesNotMatch(page,/x\.message/);
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

test('planificador proyecta demanda futura real sin inventar fechas para procesos event-driven',()=>{
  const planner=read('lib/process-planning.js');
  assert.match(planner,/futureBuckets/);
  assert.match(planner,/forecast_key/);
  assert.match(planner,/forecast_due_at/);
  assert.match(planner,/PROC-SER-003.*PROC-SER-004.*PROC-DATA-002.*PROC-PER-001/);
  assert.match(planner,/next_check_at>now\(\)/);
  assert.match(planner,/filmography_refreshed_at\+\(d\.refresh_days\|\|' days'\)::interval/);
  assert.match(planner,/fetched_at\+\(fresh_days\|\|' days'\)::interval/);
  assert.doesNotMatch(planner,/futureBuckets\(sql,'PROC-MOV-001'\)|futureBuckets\(sql,'PROC-SER-002'\)|futureBuckets\(sql,'PROC-PQ-001'\)/);
});

test('planificador agrupa vencimientos por proceso y no duplica Batch activos',()=>{
  const planner=read('lib/process-planning.js');
  assert.match(planner,/groups=new Map\(\)/);
  assert.match(planner,/group\.volume\+=Number\(row\.planned_volume\|\|0\)/);
  assert.match(planner,/getActiveBatch\(processCode,sql\)/);
  assert.match(planner,/deferred:true/);
  assert.match(planner,/reason:'active_batch'/);
});

test('Actividad ofrece cronología, calendario, planificación manual y refresco moderado',()=>{
  const page=read('app/actividad/page.js'),actions=read('app/actividad/actions.js'),refresh=read('app/actividad/ActivityRefresh.js');
  assert.match(page,/Cronología/);assert.match(page,/Calendario/);assert.match(page,/Pendiente de ubicar/);
  assert.match(page,/Mantener como pico/);assert.match(page,/Cambiar prioridad/);assert.match(page,/Ver detalle técnico en Operaciones/);
  assert.match(actions,/PROC-PLAN-001/);assert.match(actions,/before:/);assert.match(actions,/after:/);
  assert.match(actions,/Europe\/Madrid/);assert.match(page,/Europe\/Madrid/);
  assert.match(refresh,/30000/);assert.match(refresh,/visibilityState/);
});

test('Calendario V4 muestra 30 días como agenda semanal y conserva días vacíos',()=>{
  const page=read('app/actividad/page.js'),css=read('app/actividad/actividad-v4.css'),docs=read('docs/V4_UX_SPEC.md');
  assert.match(page,/addDaysKey\(startKey,29\)/);
  assert.match(page,/\['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'\]/);
  assert.match(page,/buildCalendarDays/);
  assert.match(page,/Sin trabajo planificado/);
  assert.match(page,/dia:day\.key/);
  assert.match(page,/selected\.plans/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/av4-calendar-cell\.empty/);
  assert.match(docs,/Horizonte 30 días/);
  assert.match(docs,/días vacíos/i);
  assert.doesNotMatch(page,/Días 8–30/);
});

test('Calendario usa un alias SQL no reservado para el día de Madrid',()=>{
  const source=read('lib/activity-v4.js');
  assert.match(source,/::text AS day_key/);
  assert.match(source,/row\.day_key/);
  assert.doesNotMatch(source,/::text day,/);
});

test('Actividad permite forzar el mismo ciclo PLAN-002 desde el frontal sin convertirlo en salud automática',()=>{
  const page=read('app/actividad/page.js'),actions=read('app/actividad/actions.js'),cycle=read('lib/activity-planner-cycle.js');
  assert.match(page,/Ejecutar ciclo automático ahora/);
  assert.match(page,/action=\{runAutomaticPlanningNow\}/);
  assert.match(page,/ConfirmSubmitButton/);
  assert.match(page,/no sustituye al cron automático/i);
  assert.match(actions,/executeAutomaticPlanningCycle/);
  assert.match(actions,/triggerSource:'activity_manual'/);
  assert.match(actions,/manual:true/);
  assert.match(cycle,/runActivityPlanner/);
  assert.match(cycle,/processCode:'PROC-PLAN-002'/);
  assert.doesNotMatch(cycle,/PROC-NOV-009|syncPlexFastCore|scanPlexTechnicalLibrary/);
});

test('Actividad sólo declara automatización sana con secreto, despacho frecuente y recálculo horario automáticos',()=>{
  const source=read('lib/activity-v4.js'),page=read('app/actividad/page.js');
  assert.match(source,/ACTIVITY_PLANNER_HEALTH_MINUTES=75/);
  assert.match(source,/ACTIVITY_DISPATCH_HEALTH_MINUTES=15/);
  assert.match(source,/process_code='PROC-PLAN-002'/);
  assert.match(source,/trigger_source='activity_planner'/);
  assert.match(source,/row\.context\?\.mode==='full'/);
  assert.match(source,/Boolean\(process\.env\.CRON_SECRET\)/);
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
  assert.match(page,/PikoFilm respetará este pico/);
});

test('navegación reemplaza el popover lifecycle por Actividad global',()=>{
  const nav=read('components/Nav.js');
  assert.match(nav,/\/actividad','Actividad','◷'/);
  assert.doesNotMatch(nav,/LifecycleActivity/);
});

test('cron de Actividad mantiene recálculo completo horario y snapshot diario separado',()=>{
  const vercel=read('vercel.json'),plannerCron=read('app/api/cron/activity-planner/route.js'),cycle=read('lib/activity-planner-cycle.js'),snapshot=read('app/api/cron/dashboard-snapshot/route.js');
  assert.match(vercel,/\/api\/cron\/activity-planner/);assert.match(vercel,/\*\/5 \* \* \* \*/);
  assert.match(plannerCron,/executeAutomaticPlanningCycle/);assert.match(plannerCron,/PROC-PLAN-002/);
  assert.match(plannerCron,/getUTCMinutes\(\)===0\?'full':'dispatch'/);
  assert.match(cycle,/runActivityPlanner/);
  assert.match(cycle,/runActivityDispatchTick/);
  assert.doesNotMatch(snapshot,/qualityMaintenance|startMov001Batch|startSeriesBatch|startData002Batch|startPeopleBatch|processC6Batch/);
});

test('planes terminales se purgan tras la ventana funcional de 30 días sólo en ciclo completo',()=>{
  const retention=read('lib/process-planning-retention.js'),plannerCron=read('app/api/cron/activity-planner/route.js'),cycle=read('lib/activity-planner-cycle.js');
  assert.match(retention,/PROCESS_PLAN_RETENTION_DAYS=30/);
  assert.match(retention,/status IN \('completed','cancelled','expired'\)/);
  assert.match(retention,/DELETE FROM process_plans/);
  assert.match(cycle,/purgeTerminalProcessPlans/);
  assert.match(cycle,/purged_plans/);
  assert.match(cycle,/if\(cycleMode==='dispatch'\)/);
  assert.match(plannerCron,/executeAutomaticPlanningCycle/);
});
