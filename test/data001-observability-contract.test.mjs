import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const actions=fs.readFileSync('app/calidad/datos/actions.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('DATA-001 runs through common observability runtime',()=>{
  assert.match(actions,/processCode:'PROC-DATA-001'/);
  assert.match(actions,/executeObservedProcess/);
  assert.match(actions,/runKind:'individual'/);
  assert.match(actions,/triggerSource:'calidad_datos_manual'/);
  assert.match(actions,/recordProcessError/);
});

test('DATA-001 preserves fill-missing canonical operation and distinguishes partial outcomes',()=>{
  assert.match(actions,/updateDataQualityTitle\(imdbId\)/);
  assert.match(actions,/technicalStatus=failed\.length\?'partial':'succeeded'/);
  assert.match(actions,/functionalResult=!after\.data_ready\?'pending':recovered\.length\?'updated':'no_change'/);
  assert.match(actions,/non_blocking:true/);
});

test('DATA-001 is human-readable in Operations',()=>{
  assert.match(display,/'PROC-DATA-001':\{name:'Completar datos estructurales'\}/);
  assert.match(display,/calidad_datos_manual:'Manual desde Datos'/);
});
