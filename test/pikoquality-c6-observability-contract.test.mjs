import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const actions=read('app/calidad/pikoquality/actions.js');
const page=read('app/calidad/pikoquality/page.js');
const operations=read('app/admin/pikoquality/page.js');
const runner=read('app/calidad/pikoquality/C6BatchRunner.js');
const batch=read('lib/pikoquality-c6-batch.js');
const runtime=read('lib/pikoquality-c6-runtime.mjs');
const display=read('lib/process-display.js');

test('PQ-001 is one canonical observed Batch across chunks',()=>{
  assert.match(actions,/C6_PROCESS_CODE='PROC-PQ-001'/);
  assert.match(actions,/runKind:'batch'/);
  assert.match(actions,/startProcessRun/);
  assert.match(actions,/batch_progress/);
  assert.match(actions,/finishProcessRun/);
  assert.match(actions,/items_processed=items_processed\+/);
  assert.match(actions,/items_pending=\$\{result\.remaining\}/);
  assert.match(runner,/startC6BatchRunAction/);
  assert.match(runner,/runC6BatchChunkAction\(id\)/);
  assert.match(display,/PROC-PQ-001/);
});

test('PQ-001 no longer writes pipeline_runs; process_runs is the execution truth',()=>{
  assert.doesNotMatch(batch,/pipeline_runs/);
  assert.match(batch,/FROM process_runs WHERE process_code='PROC-PQ-001'/);
});

test('C6 uses bounded chunks without changing its scoring core',()=>{
  assert.match(batch,/C6_BATCH_SIZE=1000/);
  assert.match(batch,/scorePikoQualityC6/);
  assert.match(batch,/source_fingerprint/);
  assert.match(runner,/bloques de hasta/);
});

test('PikoQuality conserva Recalcular ahora por entidad usando el core C6 vigente',()=>{
  assert.match(actions,/recalculatePikoQualityEntityAction/);
  assert.match(actions,/scorePikoQualityRatingKeys/);
  assert.match(actions,/runKind:'individual'/);
  assert.match(actions,/triggerSource:'calidad_pikoquality_unitary'/);
  assert.match(actions,/pikoquality_recalculate/);
  assert.match(runtime,/export async function scorePikoQualityRatingKeys/);
  assert.match(page,/recalculatePikoQualityEntityAction/);
  assert.match(page,/Recalcular ahora/);
  assert.match(page,/name="ratingKey" value=\{r\.href_key\}/);
  assert.match(page,/name="seasonIndex" value=\{r\.season_index\}/);
});

test('Calidad no expone barridos técnicos masivos y los deriva a Operaciones',()=>{
  assert.doesNotMatch(page,/TechnicalRunFlow/);
  assert.doesNotMatch(page,/C6BatchRunner/);
  assert.match(page,/href="\/admin\/pikoquality"/);
  assert.match(page,/SEGUIMIENTO AUTOMÁTICO/);
  assert.match(operations,/TechnicalRunFlow/);
  assert.match(operations,/C6BatchRunner/);
  assert.match(actions,/triggerSource:'operations_pikoquality_manual'/);
});