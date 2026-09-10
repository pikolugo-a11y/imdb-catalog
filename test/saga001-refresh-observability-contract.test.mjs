import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const saga=fs.readFileSync('lib/sagas-v2.js','utf8');
const sagaUnitary=fs.readFileSync('lib/saga-unitary.js','utf8');
const sagaBatch=fs.readFileSync('lib/saga-batch.js','utf8');
const sagaCore=fs.readFileSync('lib/saga-refresh-core.mjs','utf8');
const worker=fs.readFileSync('worker/batch-api-worker.mjs','utf8');
const page=fs.readFileSync('app/sagas/page.js','utf8');
const detail=fs.readFileSync('app/sagas/[name]/page.js','utf8');
const refreshActions=fs.readFileSync('app/sagas/refresh-actions.js','utf8');
const adminActions=fs.readFileSync('app/admin/batch-engine-actions.js','utf8');
const opsControl=fs.readFileSync('components/OperationsBatchControl.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('SAGA-001 is the canonical observed manual TMDb saga refresh',()=>{
  assert.match(saga,/processCode:'PROC-SAGA-001'/);
  assert.match(saga,/executeObservedProcess/);
  assert.match(saga,/triggerSource:'sagas_manual'/);
  assert.match(saga,/operation:'refresh_sagas_tmdb'/);
  assert.match(saga,/runKind:'system'/);
  assert.doesNotMatch(saga,/startRun\('saga_refresh'/);
  assert.match(display,/'PROC-SAGA-001':\{name:'Actualizar sagas desde TMDb'\}/);
});

test('SAGA-001 keeps bounded direct refresh only as an internal/targeted path',()=>{
  assert.match(saga,/saga_collections/);
  assert.match(saga,/saga_collection_members/);
  assert.match(saga,/Math\.min\(120/);
  assert.match(saga,/targetCollectionId\?1:6/);
  assert.match(page,/getSagasDashboard/);
  assert.match(detail,/getSagaDetailV3/);
});

test('Global Sagas refresh queues the complete universe in Railway instead of stopping at 120',()=>{
  assert.match(sagaBatch,/SELECT DISTINCT mc\.tmdb_collection_id/);
  assert.match(sagaBatch,/UNION\s+SELECT sc\.tmdb_collection_id/s);
  assert.match(sagaBatch,/unnest\(\$2::text\[\]\)/);
  assert.match(sagaBatch,/worker_pool.*api/);
  assert.match(sagaBatch,/executor:'railway_batch_api'/);
  assert.match(sagaBatch,/operation:'refresh_all_sagas_tmdb'/);
  assert.doesNotMatch(sagaBatch,/LIMIT\s+120/i);
  assert.match(refreshActions,/startSagaFullRefreshBatch/);
  assert.match(page,/refreshAllSagasAction/);
  assert.match(page,/Actualizar todas las sagas/);
  assert.doesNotMatch(page,/refreshSagasAction/);
});

test('Global Sagas refresh exposes real progress and safe pause resume cancel controls',()=>{
  assert.match(sagaBatch,/getSagaFullRefreshState/);
  assert.match(sagaBatch,/count\(\*\) FILTER\(WHERE status='queued'\)/);
  assert.match(sagaBatch,/pauseSagaFullRefresh/);
  assert.match(sagaBatch,/resumeSagaFullRefresh/);
  assert.match(sagaBatch,/cancelSagaFullRefresh/);
  assert.match(refreshActions,/pauseSagaFullRefreshAction/);
  assert.match(refreshActions,/resumeSagaFullRefreshAction/);
  assert.match(refreshActions,/cancelSagaFullRefreshAction/);
  assert.match(page,/ACTUALIZACIÓN GLOBAL/);
  assert.match(page,/Cancelar actualización/);
  assert.match(page,/Motor global pausado/);
  assert.match(adminActions,/pauseBatchAction/);
  assert.match(adminActions,/resumeBatchAction/);
  assert.match(adminActions,/cancelBatchAction/);
  assert.match(opsControl,/items_processed/);
  assert.match(opsControl,/Cancelar/);
});

test('Railway API worker owns one saga collection per durable batch item',()=>{
  assert.match(worker,/refreshSagaCollectionCanonical/);
  assert.match(worker,/'PROC-SAGA-001':executeSaga001/);
  assert.match(worker,/createApiGate\(sql,\{batchRunId:item\.batch_run_id\}\)/);
  assert.match(sagaCore,/refreshSagaCollectionCanonical/);
  assert.match(sagaCore,/\/collection\/\$\{id\}\?language=es-ES/);
  assert.match(sagaCore,/\/movie\/\$\{tmdbId\}\/external_ids/);
  assert.match(sagaCore,/sql\.transaction\(ops\)/);
});

test('SAGA-001 validates IMDb identity against TMDb instead of trusting stale saga cache',()=>{
  assert.doesNotMatch(saga,/tmdb_external_ids/);
  assert.match(saga,/SELECT imdb_id FROM saga_collection_members WHERE tmdb_movie_id=/);
  assert.match(saga,/\/external_ids/);
  assert.doesNotMatch(saga,/if\(known\?\.imdb_id\)return known\.imdb_id/);
  assert.match(saga,/known\.imdb_id!==canonical/);
  assert.match(saga,/identityCorrections\+\+/);
  assert.match(saga,/repair_member_identity/);
  assert.match(sagaCore,/known\.imdb_id!==canonical/);
  assert.match(sagaCore,/repair_member_identity/);
});

test('SAGA-001 supports an exact governed collection refresh from saga detail',()=>{
  assert.match(sagaUnitary,/processCode:'PROC-SAGA-001'/);
  assert.match(sagaUnitary,/runKind:'individual'/);
  assert.match(sagaUnitary,/triggerSource:'sagas_manual'/);
  assert.match(sagaUnitary,/refreshSagaCollectionCanonical\(sql,id,\{trace,lane:'manual',apiGate:createApiGate\(sql\)\}\)/);
  assert.match(refreshActions,/refreshSagaCollectionUnitary\(collectionId/);
  assert.match(refreshActions,/revalidatePath\(`\/sagas\/\$\{collectionId\}`\)/);
  assert.match(detail,/refreshSagaCollectionAction/);
  assert.match(detail,/fields=\{\{collectionId:name\}\}/);
  assert.match(detail,/Actualizar esta saga/);
});

test('SAGA-001 refresh stays atomic per collection',()=>{
  assert.match(saga,/actual_member_count/);
  assert.match(saga,/COALESCE\(sm\.actual_member_count,0\)<>COALESCE\(sc\.member_count,0\)/);
  assert.match(sagaCore,/DELETE FROM saga_collection_members/);
  assert.match(sagaCore,/INSERT INTO saga_collection_members/);
  assert.match(sagaCore,/await sql\.transaction\(ops\)/);
});

test('SAGA-001 deduplicates provider members by TMDb movie id before writing',()=>{
  assert.match(saga,/function uniqueMovieParts\(parts\)/);
  assert.match(saga,/seen\.has\(id\)/);
  assert.match(sagaCore,/function uniqueMovieParts\(parts\)/);
  assert.match(sagaCore,/seen\.has\(id\)/);
  assert.match(sagaCore,/duplicate_members_ignored/);
});

test('SAGA-001 treats a missing TMDb collection as a functional cleanup',()=>{
  assert.match(saga,/error\?\.status===404/);
  assert.match(saga,/DELETE FROM saga_collection_members WHERE tmdb_collection_id=/);
  assert.match(sagaCore,/Number\(error\?\.status\)!==404/);
  assert.match(sagaCore,/DELETE FROM saga_collections WHERE tmdb_collection_id=/);
  assert.match(sagaCore,/not_found:true/);
});
