import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('cron V4 permanece fail-closed y deja diagnóstico seguro de configuración',()=>{
  const auth=read('lib/cron-auth.js'),planner=read('app/api/cron/activity-planner/route.js'),snapshot=read('app/api/cron/dashboard-snapshot/route.js'),env=read('.env.example');
  assert.match(env,/CRON_SECRET=/);
  assert.match(auth,/authorized:Boolean\(secret\).*authorization===`Bearer \$\{secret\}`/s);
  assert.match(auth,/secretConfigured:Boolean\(secret\)/);
  assert.match(auth,/authorizationPresent:Boolean\(authorization\)/);
  assert.doesNotMatch(auth,/console\.(?:log|error).*secret\b.*authorization\b.*authorization[^P]/s);
  for(const source of [planner,snapshot]){assert.match(source,/getCronAuthState/);assert.match(source,/logCronAuthFailure/);assert.match(source,/status:401/);}
});

test('Actividad puede forzar manualmente el mismo ciclo canónico PLAN-002 sin abrir el cron ni fingir salud automática',()=>{
  const cycle=read('lib/activity-planner-cycle.js'),route=read('app/api/cron/activity-planner/route.js'),actions=read('app/actividad/actions.js'),page=read('app/actividad/page.js');
  assert.match(cycle,/processCode:'PROC-PLAN-002'/);
  assert.match(cycle,/purgeTerminalProcessObservability/);
  assert.match(cycle,/purgeTerminalProcessPlans/);
  assert.match(cycle,/runActivityPlanner/);
  assert.match(route,/executeAutomaticPlanningCycle/);
  assert.doesNotMatch(route,/runActivityPlanner/);
  assert.match(actions,/runAutomaticPlanningNow/);
  assert.match(actions,/triggerSource:'activity_manual'/);
  assert.match(actions,/manual:true/);
  assert.match(page,/ConfirmSubmitButton/);
  assert.match(page,/Ejecutar ciclo automático ahora/);
  assert.match(page,/Ejecutará ahora el ciclo completo de planificación y retención como control manual/);
  assert.match(page,/No sustituye al cron automático/);
  assert.match(page,/El botón manual no cuenta/);
});

test('navegación y carga dan feedback accesible',()=>{
  const loading=read('app/loading.js'),home=read('app/page.js'),nav=read('components/Nav.js'),search=read('components/GlobalSearch.js');
  assert.match(loading,/role="status"/);assert.match(loading,/aria-live="polite"/);assert.match(loading,/Cargando PikoFilm/);
  assert.match(home,/aria-label={`Cobertura física:/);assert.match(home,/aria-label={`Ver títulos en Plex:/);assert.match(home,/aria-label={`Ver títulos sin Plex:/);
  assert.match(nav,/event\.key!=='Escape'/);assert.match(nav,/moreButtonRef\.current\?\.focus/);
  assert.match(search,/GLOBAL_SEARCH_MIN_TEXT/);assert.match(search,/Escribe al menos/);assert.match(search,/aria-describedby/);
});

test('fechas operativas visibles usan Europe Madrid',()=>{
  const formatter=read('lib/format-madrid.js');
  assert.match(formatter,/Europe\/Madrid/);
  for(const path of ['app/page.js','app/admin/page.js','app/admin/runs/[id]/page.js','app/calidad/identidad/page.js','app/calidad/personas/page.js','app/calidad/series/page.js','app/calidad/series/[ratingKey]/page.js','app/sagas/[name]/page.js','app/personas/[id]/page.js'])assert.match(read(path),/formatMadrid/);
});

test('acciones humanas sensibles del gate final muestran pendiente o confirmación',()=>{
  const identity=read('app/calidad/identidad/page.js'),movies=read('app/calidad/peliculas/page.js'),series=read('app/calidad/series/[ratingKey]/page.js'),saga=read('app/sagas/[name]/page.js');
  assert.match(identity,/pendingLabel="Restaurando…"/);
  assert.match(movies,/ConfirmSubmitButton/);assert.match(movies,/¿Confirmas que ya has corregido físicamente/);
  assert.match(series,/PendingSubmitButton/);assert.match(series,/ConfirmSubmitButton/);assert.match(series,/¿Marcar manualmente la temporada/);
  assert.match(saga,/pendingLabel="Enviando…"/);
});

test('Series sólo presenta process_runs como historial de ejecución',()=>{
  const list=read('lib/series-quality-query.js'),detail=read('lib/series-detail-query.js');
  for(const source of [list,detail]){assert.match(source,/FROM process_runs/);assert.doesNotMatch(source,/FROM series_quality_runs/);}
  assert.match(list,/PROC-SER-001/);assert.match(list,/PROC-SER-006/);
  assert.match(detail,/PROC-SER-001/);assert.match(detail,/PROC-SER-006/);
});

test('últimos detalles de accesibilidad y copy quedan normalizados',()=>{
  const peopleQuality=read('app/calidad/personas/page.js'),people=read('app/personas/page.js'),person=read('app/personas/[id]/page.js'),sagas=read('app/sagas/page.js');
  assert.match(peopleQuality,/No hay personas que coincidan/);
  assert.match(people,/aria-disabled="true"/);assert.match(people,/Foto de \$\{x\.name\}/);
  assert.match(person,/Foto de \$\{person\.name\}/);assert.match(person,/Cartel de \$\{x\.display_title/);
  assert.match(sagas,/Cartel de \$\{r\.name_clean\}/);
});
