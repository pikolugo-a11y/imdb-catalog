import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const sync=read('../lib/series-plex-sync.js');
const safe=read('../lib/series-plex-sync-safe.js');
const actions=read('../app/calidad/series/actions.js');
const display=read('../lib/process-display.js');

test('SER-001 usa observabilidad común como proceso global manual',()=>{assert.match(sync,/processCode:'PROC-SER-001'/);assert.match(sync,/runKind:'individual'/);assert.match(sync,/triggerSource:'calidad_series_manual'/);assert.match(sync,/entityId:'global'/);assert.match(sync,/executeObservedProcess/)});
test('SER-001 mantiene core separado y la action usa el canónico',()=>{assert.match(sync,/export async function syncPlexSeriesFastCore/);assert.match(sync,/export async function syncPlexSeriesFast\(\)/);assert.match(actions,/syncPlexSeriesFast\(\)/)});
test('SER-001 conserva altas cambios bajas de series e invalidación segura',()=>{assert.match(sync,/item_type='show'/);assert.match(sync,/plex_invalidated_at=now\(\)/);assert.match(sync,/show_fingerprint_changed/);assert.match(sync,/active=false/);assert.doesNotMatch(sync,/syncPlexSeriesDetail\(.*syncPlexSeriesFastCore/s);assert.doesNotMatch(sync,/refreshSeriesUnitary|confirmSeriesEsAvailability/)});
test('SER-001 añade inventario global ligero de episodios y pagina Plex',()=>{assert.match(sync,/type=4&includeGuids=0&includeMedia=0/);assert.match(sync,/EPISODE_PAGE_SIZE=5000/);assert.match(sync,/X-Plex-Container-Start=\$\{start\}/);assert.match(sync,/planEpisodeInventoryDiff/)});
test('SER-001 obtiene media sólo para episodios nuevos o modificados y limpia bajas',()=>{assert.match(sync,/detailKeys=diff\.upserts\.map/);assert.match(sync,/refreshChangedEpisodeMedia/);assert.match(sync,/episodeKeys:detailKeys/);assert.match(sync,/removedKeys/);assert.match(sync,/DELETE FROM plex_media WHERE rating_key=ANY/);assert.match(sync,/DELETE FROM plex_files WHERE rating_key=ANY/)});
test('inventario de episodios falla cerrado y no provoca bajas en biblioteca incompleta',()=>{assert.match(sync,/Inventario de episodios incompleto/);assert.match(sync,/se omiten bajas de capítulos por seguridad/);assert.match(sync,/episodeFailed\.push/);assert.match(sync,/successfulSectionIds:sectionIds/)});
test('fallo de una biblioteca de series queda parcial y no provoca bajas en ella',()=>{assert.match(sync,/successful\.push/);assert.match(sync,/for\(const s of successful\)/);assert.match(sync,/failed\.push/);assert.match(sync,/technicalStatus:result\.partial\?'partial':'succeeded'/)});
test('SER-001 registra pasos y métricas separadas de episodios',()=>{assert.match(sync,/step:'sync_episode_inventory'/);assert.match(sync,/step:'apply_episode_diff'/);assert.match(sync,/episodes_created/);assert.match(sync,/episodes_changed/);assert.match(sync,/episodes_missing/);assert.match(sync,/episode_media_detailed/)});
test('implementación safe deja de duplicar lógica funcional',()=>{assert.match(safe,/export \{syncPlexSeriesFast,syncPlexSeriesFastCore,syncPlexSeriesDetail\} from '\.\/series-plex-sync\.js'/);assert.doesNotMatch(safe,/function fingerprint|UPDATE series_reference|library\/sections/)});
test('Operaciones muestra nombre y origen humanos de SER-001',()=>{assert.match(display,/'PROC-SER-001':\{name:'Sincronizar Plex de Series'\}/);assert.match(display,/calidad_series_manual:'Manual desde Series'/)});
