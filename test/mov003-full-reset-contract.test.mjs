import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const reset=read('../lib/title-reset.js');
const actions=read('../app/calidad/peliculas/actions.js');
const display=read('../lib/process-display.js');

test('MOV-003 usa reset canónico observado',()=>{assert.match(actions,/processCode:'PROC-MOV-003'/);assert.match(actions,/resetTitleForFullReprocessing\(imdbId,trace\)/);assert.match(actions,/triggerSource:'calidad_peliculas_manual'/)});
test('MOV-003 preserva identidad Plex y manual',()=>{assert.match(reset,/MOV003_PRESERVE_TABLES/);assert.match(reset,/plex_manual_overrides/);assert.match(reset,/existingPhysicalIdentity/);assert.match(reset,/plex_external_ids/)});
test('MOV-003 no crea Novedades ni ejecuta Plex automáticamente',()=>{const fn=reset.split('export async function resetTitleForFullReprocessing')[1];assert.doesNotMatch(fn,/INSERT INTO catalog_candidates/);assert.doesNotMatch(fn,/syncPlex|seedPlexNewsCandidates|enrichTitle/);assert.match(fn,/awaiting_plex_sync/);assert.match(fn,/plex_sync_to_news/)});
test('MOV-003 limpia estado físico derivado y protege exclusiones',()=>{assert.match(reset,/movie_file_validation/);assert.match(reset,/movie_quality_findings/);assert.match(reset,/DELETE FROM piko_quality/);assert.match(reset,/DELETE FROM movie_quality_actions/);assert.match(reset,/el título está excluido/)});
test('MOV-003 hace preflight de dependencias desconocidas e idempotencia',()=>{assert.match(reset,/MOV003_RESET_TABLES/);assert.match(reset,/unknown\.length/);assert.match(reset,/recovered:true/);assert.match(reset,/El reinicio completo no dejó el estado esperado/)});
test('MOV-003 tiene nombre humano en Operaciones',()=>{assert.match(display,/'PROC-MOV-003':\{name:'Reiniciar película tras corrección'\}/)});
