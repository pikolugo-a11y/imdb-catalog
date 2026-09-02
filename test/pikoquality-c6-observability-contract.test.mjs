import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const exists=path=>fs.existsSync(new URL(path,root));
const actions=read('app/calidad/pikoquality/actions.js');
const runner=read('app/calidad/pikoquality/C6BatchRunner.js');
const batch=read('lib/pikoquality-c6-batch.js');
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

test('individual PikoQuality analysis entry is retired',()=>{
  assert.equal(exists('app/calidad/pikoquality/AnalyzeForm.js'),false);
  assert.doesNotMatch(actions,/analyzeOnePikoQualityAction|analyzeMoviePikoQuality|PikoQualityPrerequisiteError/);
});
