import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const availability=read('../lib/series-es-availability.js');
const actions=read('../app/calidad/series/actions.js');
const display=read('../lib/process-display.js');

test('SER-004 usa observabilidad común como unitario manual',()=>{assert.match(availability,/processCode:'PROC-SER-004'/);assert.match(availability,/runKind:'individual'/);assert.match(availability,/triggerSource:'calidad_series_manual'/);assert.match(availability,/executeObservedProcess/)});
test('SER-004 conserva cascada TMDb temporada -> Watchmode -> unknown',()=>{assert.match(availability,/season\/\$\{n\}\/watch\/providers/);assert.match(availability,/watchmodeSeasonAvailable/);assert.match(availability,/tmdb_watchmode_es/);assert.doesNotMatch(availability,/ES_NOT_AVAILABLE/)});
test('SER-004 distingue error técnico Watchmode de falta de evidencia',()=>{assert.match(availability,/wmError/);assert.match(availability,/providerErrors\+\+/);assert.match(availability,/technicalStatus:result\.partial\?'partial':'succeeded'/);assert.match(availability,/eventType:'error'.*step:'watchmode'/s)});
test('SER-004 deja estado funcional sin tocar cuando Watchmode falla',()=>{const errorBlock=availability.match(/if\(wmError\)\{[\s\S]*?continue\}/)?.[0]||'';assert.match(errorBlock,/providerErrors\+\+/);assert.doesNotMatch(errorBlock,/UPDATE series_season_availability/)});
test('SER-004 registra pasos por temporada y recompone diagnóstico/lifecycle',()=>{assert.match(availability,/entityType:'season'/);assert.match(availability,/step:'tmdb_season'/);assert.match(availability,/step:'watchmode'/);assert.match(availability,/rebuildSeriesDiagnostics/);assert.match(availability,/recomputeLifecycleForIds/)});
test('action existente sigue ejecutando el canónico y Operaciones tiene nombre humano',()=>{assert.match(actions,/confirmSeriesEsAvailability\(\{ratingKey\}\)/);assert.match(display,/'PROC-SER-004':\{name:'Comprobar disponibilidad España'\}/)});
