import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const sync=read('../lib/series-plex-sync.js');
const actions=read('../app/calidad/series/actions.js');
const display=read('../lib/process-display.js');

test('SER-002 usa observabilidad común como unitario canónico',()=>{assert.match(sync,/processCode:'PROC-SER-002'/);assert.match(sync,/runKind:'individual'/);assert.match(sync,/triggerSource:'calidad_series_manual'/);assert.match(sync,/syncPlexSeriesDetailCore/);assert.match(actions,/syncPlexSeriesDetail\(ratingKey\)/)});
test('SER-002 refresca media y archivos físicos antes del diagnóstico',()=>{const physical=sync.indexOf("step:'refresh_physical_media'");const diagnostics=sync.indexOf("step:'rebuild_diagnostics'");assert.ok(physical>=0&&diagnostics>physical);assert.match(sync,/DELETE FROM plex_media WHERE rating_key=ANY/);assert.match(sync,/DELETE FROM plex_files WHERE rating_key=ANY/);assert.match(sync,/INSERT INTO plex_media/);assert.match(sync,/INSERT INTO plex_files/)});
test('SER-002 conserva inventario y bajas de episodios',()=>{assert.match(sync,/grandparent_rating_key=\$\{key\}/);assert.match(sync,/item_type='episode'/);assert.match(sync,/active=false/);assert.match(sync,/added:episodes\.filter/);assert.match(sync,/removed:removed\.length/)});
test('SER-002 mantiene diagnóstico de combinados y Lifecycle común',()=>{assert.match(sync,/rebuildSeriesDiagnostics\(sql,key\)/);assert.match(sync,/recomputeLifecycleForIds/);assert.doesNotMatch(sync,/refreshSeriesUnitary|confirmSeriesEsAvailability/)});
test('SER-002 registra llamadas externas y pasos compactos',()=>{assert.match(sync,/externalCall/);assert.match(sync,/load_episode_inventory/);assert.match(sync,/refresh_physical_media/);assert.match(sync,/rebuild_diagnostics/)});
test('Operaciones muestra nombre humano de SER-002',()=>{assert.match(display,/'PROC-SER-002':\{name:'Actualizar detalle Plex de serie'\}/)});
