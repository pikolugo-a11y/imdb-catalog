import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/catalogo/excluidas/actions.js','utf8');
const page=fs.readFileSync('app/catalogo/excluidas/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-016 restores exclusions through common observability',()=>{
  assert.match(action,/processCode:'PROC-NOV-016'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/DELETE FROM catalog_exclusions/);
  assert.match(action,/destination==='catalog'/);
  assert.match(action,/destination==='news'/);
  assert.match(action,/catalog_candidates SET eligibility_status=/);
  assert.match(action,/restoredFromExclusionAt/);
  assert.match(action,/functionalResult:'blocked'/);
  assert.doesNotMatch(action,/enrichTitle|seedPlexNewsCandidates|omdb|tmdb|wikidata/i);
});

test('excluded frontend uses canonical restore action',()=>{
  assert.match(page,/restoreExclusionAction/);
  assert.doesNotMatch(page,/restoreTitle from '@\/app\/actions'/);
  assert.match(display,/'PROC-NOV-016':\{name:'Restaurar exclusión'\}/);
});
