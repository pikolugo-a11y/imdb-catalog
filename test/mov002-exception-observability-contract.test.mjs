import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const actions=await readFile(new URL('../app/calidad/peliculas/actions.js',import.meta.url),'utf8');
const core=await readFile(new URL('../lib/movie-quality-actions.js',import.meta.url),'utf8');
const page=await readFile(new URL('../app/calidad/peliculas/page.js',import.meta.url),'utf8');
const display=await readFile(new URL('../lib/process-display.js',import.meta.url),'utf8');

test('MOV-002 is an observed individual manual decision',()=>{
  assert.match(actions,/processCode:'PROC-MOV-002'/);
  assert.match(actions,/runKind:'individual'/);
  assert.match(actions,/triggerSource:'calidad_peliculas_manual'/);
  assert.match(actions,/manual_decision/);
  assert.match(actions,/accepted_exception/);
  assert.match(actions,/recomputeLifecycleForIds/);
});

test('MOV-002 rejects stale physical fingerprints before accepting',()=>{
  assert.match(core,/assertExceptionStillCurrent/);
  assert.match(core,/physicalKey/);
  assert.match(core,/finding\.finding_type==='duplicate'/);
  assert.match(core,/La incidencia pertenece a un archivo anterior/);
  assert.match(core,/setMovieQualityFindingAction/);
});

test('movie page uses local canonical movie actions and MOV-002 has a human name',()=>{
  assert.match(page,/from '\.\/actions'/);
  assert.doesNotMatch(page,/qualityAction,validateMovieFileAction\} from '@\/app\/actions'/);
  assert.match(display,/PROC-MOV-002/);
  assert.match(display,/Aceptar incidencia de película/);
});
