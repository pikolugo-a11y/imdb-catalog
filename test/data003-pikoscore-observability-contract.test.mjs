import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const actions=await readFile(new URL('../app/calidad/datos/actions.js',import.meta.url),'utf8');
const core=await readFile(new URL('../lib/pikoscore-v3-core.mjs',import.meta.url),'utf8');
const unitary=await readFile(new URL('../lib/pikoscore-v3.js',import.meta.url),'utf8');
const display=await readFile(new URL('../lib/process-display.js',import.meta.url),'utf8');

test('DATA-003 keeps the canonical PikoScore core and unitary',()=>{
  assert.match(core,/PIKOSCORE_V3_VERSION='3\.0\.0-experimental\.3'/);
  assert.match(core,/computePikoScoreV3/);
  assert.match(unitary,/calculateAndSavePikoScoreV3ForTitle/);
  assert.match(actions,/calculateAndSavePikoScoreV3ForTitle\(imdbId\)/);
});

test('DATA-003 is observed as an individual process',()=>{
  assert.match(actions,/processCode:'PROC-DATA-003'/);
  assert.match(actions,/runKind:'individual'/);
  assert.match(actions,/operation:'calculate_pikoscore_v3'/);
  assert.match(actions,/step:'evaluate_pikoscore'/);
  assert.match(actions,/step:'persist_pikoscore'/);
});

test('DATA-003 records before after metrics and human name',()=>{
  assert.match(actions,/before=\{score:preview\.previous\?\.score/);
  assert.match(actions,/metrics:\{score:r\.score,confidence:r\.confidence,source_count:r\.sourceCount/);
  assert.match(display,/PROC-DATA-003/);
  assert.match(display,/Calcular PikoScore/);
});
