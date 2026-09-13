import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const sync=read('../lib/series-plex-sync.js');
const safe=read('../lib/series-plex-sync-safe.js');
const actions=read('../app/calidad/series/actions.js');
const globalAction=read('../app/calidad/series/plex-global-action.js');
const batch=read('../lib/series-batch.js');
const worker=read('../worker/batch-plex-worker.mjs');
const page=read('../app/calidad/series/page.js');
const display=read('../lib/process-display.js');

test('SER-001 global manual se encola y ejecuta en Railway Plex',()=>{
  assert.match(globalAction,/startSeriesBatch\('PROC-SER-001'/);
  assert.match(globalAction,/triggerSource:'calidad_series_manual'/);
  assert.doesNotMatch(globalAction,/syncPlexSeriesFastCore|syncPlexSeriesFast\(/);
  assert.doesNotMatch(actions,/syncPlexSeriesFast/);
  assert.match(batch,/'PROC-SER-001':\{pool:'plex',concurrency:1/);
  assert.match(batch,/from '\.\/batch-engine\.js'/);
  assert.match(batch,/executor:cfg\.pool==='plex'\?'railway_batch_plex'/);
  assert.match(worker,/\['PROC-SER-001',\{execute:executeSer001\}\]/);
  assert.match(worker,/syncPlexSeriesFastCore\(\{trace\}\)/);
  assert.match(worker,/executor:'railway_batch_plex'/);
});

test('la UI responde tras encolar y no mantiene el request durante el scan',()=>{
  assert.match(page,/from '\.\/plex-global-action'/);
  assert.match(page,/pendingLabel="Encolando Plex…"/);
  assert.match(globalAction,/Railway la ejecutará sin mantener abierto este request/);
});

test('SER-001 conserva un único core funcional para el worker',()=>{
  assert.match(sync,/export async function syncPlexSeriesFastCore/);
  assert.match(worker,/syncPlexSeriesFastCore/);
  assert.doesNotMatch(worker,/library\/sections\/.*type=4/);
});

test('SER-001 conserva altas cambios bajas de series e invalidación segura',()=>{assert.match(sync,/item_type='show'/);assert.match(sync,/plex_invalidated_at=now\(\)/);assert.match(sync,/show_fingerprint_changed/);assert.match(sync,/active=false/);assert.doesNotMatch(sync,/syncPlexSeriesDetail\(.*syncPlexSeriesFastCore/s);assert.doesNotMatch(sync,/refreshSeriesUnitary|confirmSeriesEsAvailability/)});

test('inventario global ligero pagina Plex con concurrencia acotada',()=>{
  assert.match(sync,/type=4&includeGuids=0&includeMedia=0/);
  assert.match(sync,/EPISODE_PAGE_SIZE=5000/);
  assert.match(sync,/EPISODE_PAGE_CONCURRENCY=.*\|\|3,6/);
  assert.match(sync,/starts\.slice\(pos,pos\+EPISODE_PAGE_CONCURRENCY\)/);
  assert.match(sync,/Promise\.all\(chunk\.map\(start=>loadEpisodePage/);
  assert.match(sync,/X-Plex-Container-Start=\$\{start\}/);
  assert.match(sync,/planEpisodeInventoryDiff/);
});

test('SER-001 obtiene media sólo para episodios nuevos o modificados y limpia bajas',()=>{assert.match(sync,/detailKeys=diff\.upserts\.map/);assert.match(sync,/refreshChangedEpisodeMedia/);assert.match(sync,/episodeKeys:detailKeys/);assert.match(sync,/removedKeys/);assert.match(sync,/DELETE FROM plex_media WHERE rating_key=ANY/);assert.match(sync,/DELETE FROM plex_files WHERE rating_key=ANY/)});

test('inventario de episodios falla cerrado y no provoca bajas en biblioteca incompleta',()=>{assert.match(sync,/Inventario de episodios incompleto/);assert.match(sync,/se omiten bajas de capítulos por seguridad/);assert.match(sync,/episodeFailed\.push/);assert.match(sync,/successfulSectionIds:sectionIds/)});

test('el trabajo Plex largo renueva heartbeat y lease durante inventario y media',()=>{assert.match(sync,/async function heartbeat/);assert.match(sync,/step:'episode_inventory'/);assert.match(sync,/step:'refresh_physical_media'/);assert.match(sync,/step:'apply_episode_diff'/)});

test('fallo de una biblioteca de series queda parcial y no provoca bajas en ella',()=>{assert.match(sync,/successful\.push/);assert.match(sync,/for\(const s of successful\)/);assert.match(sync,/failed\.push/);assert.match(worker,/technicalStatus:result\.partial\?'partial':'succeeded'/)});

test('SER-001 reconstruye read model y encadena SER-002 sólo después del scan',()=>{assert.match(worker,/rebuildSeriesQualityReadModel\(sql\)/);assert.match(worker,/startSeriesBatch\('PROC-SER-002',\{triggerSource:'plex_sync_continuation'\}\)/);assert.ok(worker.indexOf('syncPlexSeriesFastCore({trace})')<worker.indexOf("startSeriesBatch('PROC-SER-002'"))});

test('SER-001 traduce cobertura real a lenguaje de usuario y la sube al run padre',()=>{
  assert.match(worker,/globalDiagnosticSnapshot/);
  assert.match(worker,/globalDiagnosticChanges/);
  assert.match(worker,/capítulo\$\{diff\.becamePresent\.length===1\?'':'s'\} nuevo/);
  assert.match(worker,/activity_summary:activitySummary/);
  assert.match(worker,/UPDATE process_runs SET after_compact=COALESCE\(after_compact,'\{\}'::jsonb\)/);
  assert.match(worker,/diagnostics_became_present/);
  assert.match(worker,/diagnostics_became_missing/);
});

test('Calidad distingue inventario físico Plex de episodios oficiales cubiertos',()=>{
  assert.match(page,/físicos en Plex/);
  assert.match(page,/oficiales cubiertos/);
  assert.match(page,/Plex físicos/);
});

test('implementación safe deja de duplicar lógica funcional',()=>{assert.match(safe,/export \{syncPlexSeriesFast,syncPlexSeriesFastCore,syncPlexSeriesDetail\} from '\.\/series-plex-sync\.js'/);assert.doesNotMatch(safe,/function fingerprint|UPDATE series_reference|library\/sections/)});

test('Operaciones muestra nombre y origen humanos de SER-001',()=>{assert.match(display,/'PROC-SER-001':\{name:'Sincronizar Plex de Series'\}/);assert.match(display,/calidad_series_manual:'Manual desde Series'/)});