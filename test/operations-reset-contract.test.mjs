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
test('reset conserva observabilidad histórica y bloquea dependencias persistentes desconocidas',()=>{assert.match(reset,/PRESERVE_TABLES/);assert.match(reset,/process_runs/);assert.match(reset,/process_run_events/);assert.match(reset,/process_run_errors/);assert.match(reset,/unknown\.length/);assert.match(reset,/dependencias persistentes no contempladas/)});
test('reset distingue tablas base de vistas y nunca borra vistas derivadas',()=>{assert.match(reset,/table_type/);assert.match(reset,/BASE TABLE/);assert.match(reset,/derived_views/);assert.match(reset,/for\(const table of baseTables\.filter/);assert.doesNotMatch(reset,/RESET_TABLES.*catalog_read_model/s)});
test('reset contempla tablas derivadas persistentes detectadas en producción',()=>{for(const table of ['movie_countries','movie_country_names','movie_genre_names','movie_genres_canonical','title_ratings'])assert.match(reset,new RegExp(`'${table}'`))});
test('reset recrea candidato manual listo para añadir, sin falso estado Preparando',()=>{assert.match(reset,/manual:true/);assert.match(reset,/authoritativeStatus:'complete'/);assert.match(reset,/manualAuthoritativeResolvedAt:resetAt/);assert.match(reset,/news_state:'eligible'/);assert.match(reset,/candidato manual listo y elegible/)});
test('reset recupera de forma idempotente un candidato ya reiniciado',()=>{assert.match(reset,/recoverExistingResetCandidate/);assert.match(reset,/resetFromOperations!==true/);assert.match(reset,/recover_reset_candidate/);assert.match(reset,/Título no encontrado en catálogo ni como candidato reiniciado/);assert.match(reset,/tablesCleared:\[\]/)});
test('reset recrea candidato elegible y elimina movies en una sola transacción',()=>{assert.match(reset,/DELETE FROM movies/);assert.match(reset,/INSERT INTO catalog_candidates/);assert.match(reset,/eligibility_status.*eligible/s);assert.match(reset,/sql\.transaction\(ops\)/)});
test('reset no dispara procesamiento automático posterior',()=>{assert.doesNotMatch(reset,/enrichTitle|resolveManualNewsCandidate|dispatch/);assert.doesNotMatch(actions,/enrichTitle|dispatch/)});
test('Operaciones muestra el control y el proceso tiene nombre humano',()=>{assert.match(page,/OperationsResetTitle/);assert.match(display,/'PROC-OPS-001':\{name:'Reiniciar título desde Novedades'\}/);assert.match(display,/operations_manual:'Manual desde Operaciones'/)});
