import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const actions=await readFile(new URL('../app/calidad/datos/actions.js',import.meta.url),'utf8');
const display=await readFile(new URL('../lib/process-display.js',import.meta.url),'utf8');

test('DATA-005 keeps canonical manual acceptance and adds common observability',()=>{
  assert.match(actions,/processCode:'PROC-DATA-005'/);
  assert.match(actions,/runKind:'individual'/);
  assert.match(actions,/acceptIncompleteData\(imdbId\)/);
  assert.match(actions,/getDataQualityTitle\(imdbId\)/);
  assert.match(actions,/missing_at_decision/);
  assert.match(actions,/manual_decision/);
  assert.match(actions,/recomputeLifecycleForIds/);
});

test('DATA-005 has human display name',()=>{
  assert.match(display,/PROC-DATA-005/);
  assert.match(display,/Aceptar datos incompletos/);
});
