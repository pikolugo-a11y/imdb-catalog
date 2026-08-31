import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const src=read('../lib/series-unitary.js');
const display=read('../lib/process-display.js');

test('SER-003 usa observabilidad común y core reutilizable',()=>{assert.match(src,/export async function refreshSeriesUnitaryCore/);assert.match(src,/processCode:'PROC-SER-003'/);assert.match(src,/executeObservedProcess/);assert.match(src,/triggerSource:'calidad_series_manual'/)});
test('SER-003 mantiene protección de evidencia fuerte de disponibilidad',()=>{assert.match(src,/manual_override OR series_season_availability\.status='PLEX_COMPLETE'/);assert.match(src,/tmdb_season_watch_providers','watchmode_episode_witness_es/)});
test('SER-003 conserva next_check_at como dato y no dispara procesos automáticos',()=>{assert.match(src,/nextReferenceCheck/);assert.match(src,/next_check_at=/);assert.doesNotMatch(src,/confirmSeriesEsAvailability|syncPlexSeriesDetail/)});
test('SER-003 registra llamadas TMDb, retries y pasos por temporada',()=>{assert.match(src,/trace\?\.externalCall/);assert.match(src,/eventType:'retry'/);assert.match(src,/step:'tmdb_season'/);assert.match(src,/entityType:'season'/)});
test('SER-003 reconstruye episodios, diagnósticos y lifecycle',()=>{assert.match(src,/DELETE FROM series_reference_episodes/);assert.match(src,/rebuildSeriesDiagnostics/);assert.match(src,/recomputeLifecycleForIds/)});
test('Operaciones muestra nombre humano de SER-003',()=>{assert.match(display,/'PROC-SER-003':\{name:'Actualizar referencia TMDb de serie'\}/)});
