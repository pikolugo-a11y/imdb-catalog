import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const reset=read('../lib/title-reset.js');
const actions=read('../app/admin/actions.js');
const page=read('../app/admin/page.js');
const display=read('../lib/process-display.js');

test('reset desde Operaciones es un proceso individual observado',()=>{assert.match(actions,/processCode:'PROC-OPS-001'/);assert.match(actions,/runKind:'individual'/);assert.match(actions,/triggerSource:'operations_manual'/);assert.match(actions,/resetTitleToNews\(id,trace\)/)});
test('reset exige doble confirmación por IMDb',()=>{assert.match(actions,/confirmImdb/);assert.match(actions,/confirm!==id/);assert.match(actions,/Escribe el mismo IMDb ID/)});
test('reset conserva observabilidad histórica y bloquea dependencias desconocidas',()=>{assert.match(reset,/PRESERVE_TABLES/);assert.match(reset,/process_runs/);assert.match(reset,/process_run_events/);assert.match(reset,/process_run_errors/);assert.match(reset,/unknown\.length/);assert.match(reset,/Reinicio bloqueado/)});
test('reset recrea candidato elegible y elimina movies en una sola transacción',()=>{assert.match(reset,/DELETE FROM movies/);assert.match(reset,/INSERT INTO catalog_candidates/);assert.match(reset,/eligibility_status.*eligible/s);assert.match(reset,/sql\.transaction\(ops\)/)});
test('reset no dispara procesamiento automático posterior',()=>{assert.doesNotMatch(reset,/enrichTitle|resolveManualNewsCandidate|dispatch/);assert.doesNotMatch(actions,/enrichTitle|dispatch/)});
test('Operaciones muestra el control y el proceso tiene nombre humano',()=>{assert.match(page,/OperationsResetTitle/);assert.match(display,/'PROC-OPS-001':\{name:'Reiniciar título desde Novedades'\}/);assert.match(display,/operations_manual:'Manual desde Operaciones'/)});
