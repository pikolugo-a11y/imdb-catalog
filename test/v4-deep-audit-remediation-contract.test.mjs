import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const url=path=>new URL(`../${path}`,import.meta.url);
const read=path=>fs.readFileSync(url(path),'utf8');

test('Actividad representa atención funcional actual y no fallos históricos',()=>{
  const source=read('lib/activity-v4.js'),page=read('app/actividad/page.js'),refresh=read('app/actividad/ActivityRefresh.js');
  assert.match(source,/attentionBreakdown/);
  assert.match(source,/catalog_lifecycle/);
  assert.doesNotMatch(source,/latest_root[\s\S]*technical_status IN\('failed','partial'\)/);
  assert.match(page,/ActivityRefresh active=\{summary\.active>0\}/);
  assert.match(refresh,/if\(active&&document\.visibilityState==='visible'\)timer=setInterval\(refresh,30000\)/);
  assert.match(refresh,/\[router,active\]/);
  assert.doesNotMatch(page,/T12:00:00\+02:00/);
  assert.match(page,/T12:00:00Z/);
  assert.match(page,/Vista detallada acotada/);
  assert.match(page,/PendingSubmitButton/);
});

test('los dos crons canónicos atraviesan middleware pero autentican fail-closed',()=>{
  const middleware=read('middleware.js'),planner=read('app/api/cron/activity-planner/route.js'),snapshot=read('app/api/cron/dashboard-snapshot/route.js'),auth=read('lib/cron-auth.js');
  assert.match(middleware,/\/api\/cron\/activity-planner/);
  assert.match(middleware,/\/api\/cron\/dashboard-snapshot/);
  assert.match(middleware,/PUBLIC_CONTROL_PATHS\.has\(pathname\)/);
  assert.match(planner,/isCronAuthorized\(request\)/);
  assert.match(snapshot,/isCronAuthorized\(request\)/);
  assert.match(auth,/if\(!secret\)return false/);
  assert.match(auth,/authorization/);
});

test('PikoQuality separa captura técnica pendiente, error y C6',()=>{
  const page=read('app/calidad/pikoquality/page.js'),state=read('lib/pikoquality-state.js');
  assert.match(page,/technicalErrors/);
  assert.match(page,/capturePending/);
  assert.match(page,/maintenanceActive/);
  assert.match(page,/error\(es\) de captura técnica/);
  assert.match(page,/PendingSubmitButton/);
  assert.match(state,/PIKOQUALITY_ACTIVE_VERSION/);
  assert.match(state,/source_fingerprint IS NOT DISTINCT FROM pts\.technical_fingerprint/);
});

test('Series pagina episodios y conserva contadores del ámbito completo',()=>{
  const query=read('lib/series-detail-query.js'),page=read('app/calidad/series/[ratingKey]/page.js');
  assert.match(query,/SERIES_EPISODE_PAGE_SIZE=100/);
  assert.match(query,/LIMIT \$\{size\} OFFSET \$\{offset\}/);
  assert.match(query,/return\{rows,total,page:effectivePage,pages,pageSize:size,first:/);
  assert.match(page,/episodePage/);
  assert.match(page,/episodeData\.pages/);
  assert.match(page,/Página/);
});

test('Operaciones pagina superficies grandes y separa origen de executor',()=>{
  const query=read('lib/operations-queries.js'),page=read('app/admin/page.js'),detail=read('app/admin/runs/[id]/page.js');
  assert.match(query,/eventSize=100,errorSize=50,childSize=50,itemSize=100/);
  assert.match(query,/incidentPage/);
  assert.match(query,/LIMIT \$\{itemSize\} OFFSET \$\{itemOffset\}/);
  assert.match(query,/pagination:\{events:pageMeta/);
  assert.match(page,/Origen \/ trigger/);
  assert.match(page,/Executor \/ fuente/);
  assert.match(detail,/param="itemPage"/);
  assert.match(detail,/param="eventPage"/);
});

test('navegación y búsqueda global cubren móvil teclado y umbral eficiente',()=>{
  const nav=read('components/Nav.js'),search=read('components/GlobalSearch.js'),route=read('app/api/global-search/route.js'),backend=read('lib/global-search.js'),rules=read('lib/global-search-rules.js'),css=read('app/v4-search.css');
  assert.match(nav,/secondaryItems=.*\/sagas/);
  assert.match(search,/ArrowDown/);
  assert.match(search,/ArrowUp/);
  assert.match(search,/Home/);
  assert.match(search,/End/);
  assert.match(search,/role="combobox"/);
  assert.match(search,/role="listbox"/);
  assert.match(search,/role="option"/);
  assert.match(search,/isGlobalSearchableTerm/);
  assert.match(route,/isGlobalSearchableTerm/);
  assert.match(backend,/PEOPLE_CANDIDATE_LIMIT=60/);
  assert.match(backend,/WITH candidates AS/);
  assert.match(rules,/GLOBAL_SEARCH_MIN_TEXT=3/);
  assert.match(rules,/\^tt\\d\+\$/);
  assert.match(css,/aria-selected/);
});

test('links sin destino y todos los paginadores disabled dejan de ser enlaces',()=>{
  const link=read('components/NoPrefetchLink.js');
  assert.match(link,/disabledToken/);
  assert.match(link,/explicitlyDisabled/);
  assert.match(link,/return <span/);
  assert.match(link,/aria-disabled="true"/);
  for(const path of ['app/calidad/identidad/page.js','app/calidad/datos/page.js','app/calidad/series/page.js','app/personas/page.js']){
    const source=read(path);
    assert.match(source,/className=\{[^\n]*'disabled'/);
    assert.match(source,/NoPrefetchLink/);
  }
  for(const path of ['app/catalogo/page.js','app/catalogo/excluidas/page.js','app/sagas/page.js','app/calidad/validacion-identidad/page.js'])assert.match(read(path),/aria-disabled="true"/);
});

test('acciones humanas muestran pending y las delicadas admiten confirmación',()=>{
  const action=read('components/ActionButton.js'),confirm=read('components/ConfirmSubmitButton.js'),activity=read('app/actividad/page.js'),excluded=read('app/catalogo/excluidas/page.js'),sagas=read('app/sagas/page.js');
  assert.match(action,/confirmMessage/);
  assert.match(action,/window\.confirm/);
  assert.match(confirm,/useFormStatus/);
  assert.match(activity,/PendingSubmitButton/);
  assert.match(excluded,/pendingLabel="Restaurando…"/);
  assert.match(sagas,/confirmMessage="¿Cancelar la actualización global de sagas\?/);
});

test('Personas sólo lee PikoQuality C6 vigente y conserva información móvil',()=>{
  const query=read('lib/people-v2.js'),page=read('app/personas/[id]/page.js');
  assert.match(query,/PIKOQUALITY_ACTIVE_VERSION/);
  assert.match(query,/technical_fingerprint/);
  assert.match(query,/source_fingerprint IS NOT DISTINCT FROM pts\.technical_fingerprint/);
  assert.match(page,/PikoQuality/);
  assert.match(page,/relevance_reason/);
});

test('superficies legacy auditadas quedan integradas en V4',()=>{
  const integrity=read('app/calidad/sin-estado/page.js'),criteria=read('app/novedades/criterios/page.js'),news=read('app/novedades/page.js');
  assert.match(integrity,/lifecycle-integrity\.css/);
  assert.doesNotMatch(integrity,/style=\{\{/);
  assert.match(criteria,/criteria-v4\.css/);
  assert.match(criteria,/PendingSubmitButton/);
  assert.match(news,/\/novedades\/criterios/);
});

test('FilmAffinity Python legacy no vuelve a entrar en el runtime Vercel',()=>{
  assert.equal(fs.existsSync(url('api/fa-search.py')),false);
  assert.equal(fs.existsSync(url('api/fa-evidence.py')),false);
  assert.equal(fs.existsSync(url('requirements.txt')),false);
  const batchDoc=read('docs/processes/BATCH_ARCHITECTURE.md');
  assert.match(batchDoc,/batch_jobs/);
  assert.match(batchDoc,/retiradas y prohibidas/);
});
