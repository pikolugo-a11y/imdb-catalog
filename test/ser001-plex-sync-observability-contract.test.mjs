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
test('SER-001 sólo detecta e invalida y no dispara procesos posteriores',()=>{assert.match(sync,/plex_invalidated_at=now\(\)/);assert.match(sync,/show_fingerprint_changed/);assert.doesNotMatch(sync,/syncPlexSeriesDetail\(.*syncPlexSeriesFastCore/s);assert.doesNotMatch(sync,/refreshSeriesUnitary|confirmSeriesEsAvailability/)});
test('fallo de una biblioteca queda parcial y no provoca bajas en ella',()=>{assert.match(sync,/successful\.push/);assert.match(sync,/for\(const s of successful\)/);assert.match(sync,/failed\.push/);assert.match(sync,/technicalStatus:result\.partial\?'partial':'succeeded'/)});
test('SER-001 registra pasos compactos por biblioteca y llamadas externas',()=>{assert.match(sync,/step:'sync_library'/);assert.match(sync,/entityType:'series_library'/);assert.match(sync,/externalCall/);assert.match(sync,/libraries_failed/)});
test('implementación safe deja de duplicar lógica funcional',()=>{assert.match(safe,/export \{syncPlexSeriesFast,syncPlexSeriesFastCore,syncPlexSeriesDetail\} from '\.\/series-plex-sync\.js'/);assert.doesNotMatch(safe,/function fingerprint|UPDATE series_reference|library\/sections/)});
test('Operaciones muestra nombre y origen humanos de SER-001',()=>{assert.match(display,/'PROC-SER-001':\{name:'Sincronizar Plex de Series'\}/);assert.match(display,/calidad_series_manual:'Manual desde Series'/)});
