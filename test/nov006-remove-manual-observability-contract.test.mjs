import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/manual-remove-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-006 is an observed individual Vercel operation',()=>{
  assert.match(action,/processCode:'PROC-NOV-006'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/triggerSource:'novedades_manual'/);
  assert.match(action,/executor:'vercel'/);
  assert.match(action,/operation:'remove_manual_candidate'/);
});

test('NOV-006 only deactivates active manual origin and does not create exclusion',()=>{
  assert.match(action,/source_snapshot->>'manual'='true'/);
  assert.match(action,/manualActive/);
  assert.match(action,/eligibility_status='not_eligible'/);
  assert.match(action,/manualActive:false/);
  assert.doesNotMatch(action,/INSERT INTO catalog_exclusions|DELETE FROM catalog_exclusions/);
});

test('Novedades distinguishes manual withdrawal from global exclusion',()=>{
  assert.match(page,/removeManualCandidateAction} from '\.\/manual-remove-actions'/);
  assert.match(page,/Retirar alta manual/);
  assert.match(page,/sólo desactiva esa propuesta/);
  assert.match(display,/'PROC-NOV-006':\{name:'Retirar alta manual de Novedades'\}/);
});
