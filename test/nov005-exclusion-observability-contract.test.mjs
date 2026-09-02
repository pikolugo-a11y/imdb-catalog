import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/exclude-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-005 is the observed exclusion entrypoint used by Novedades',()=>{
  assert.match(action,/processCode:'PROC-NOV-005'/);
  assert.match(action,/executeObservedProcess/);
  assert.match(action,/triggerSource:'novedades_manual'/);
  assert.match(action,/operation:'exclude_news_candidate'/);
  assert.match(action,/manual_decision/);
  assert.match(action,/INSERT INTO catalog_exclusions/);
  assert.match(page,/import \{excludeNewsCandidateAction\} from '\.\/exclude-actions'/);
  assert.doesNotMatch(page,/excludeNewsCandidateAction\} from '\.\/actions'/);
  assert.match(display,/'PROC-NOV-005':\{name:'Excluir candidato de Novedades'\}/);
});
