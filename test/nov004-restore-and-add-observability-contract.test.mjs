import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/manual-candidate-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-004 is one observed individual restoration operation',()=>{
  const restore=action.slice(action.indexOf('export async function restoreAndAddManualAction'));
  assert.match(restore,/processCode:'PROC-NOV-004'/);
  assert.match(restore,/runKind:'individual'/);
  assert.match(restore,/executor:'vercel'/);
  assert.match(restore,/manual_decision/);
  assert.match(restore,/DELETE FROM catalog_exclusions/);
});

test('NOV-004 reuses canonical manual resolver and never dispatches legacy workflow',()=>{
  const restore=action.slice(action.indexOf('export async function restoreAndAddManualAction'));
  assert.match(restore,/resolveManualNewsCandidate\(imdbId,\{trace\}\)/);
  assert.match(restore,/persistResolved\(sql,imdbId,resolved/);
  assert.doesNotMatch(restore,/dispatchManualAuthoritative|GitHub|workflow|dataset|enrichTitle/);
});

test('failed resolution keeps exclusion removed and candidate pending',()=>{
  const restore=action.slice(action.indexOf('export async function restoreAndAddManualAction'));
  assert.match(restore,/after:\{excluded:false,eligibility_status:status/);
  assert.match(restore,/technicalStatus:'partial',functionalResult:'pending'/);
  assert.doesNotMatch(restore,/INSERT INTO catalog_exclusions/);
});

test('Novedades UI uses canonical NOV-004 action and Operations has a human name',()=>{
  assert.match(page,/import \{[^}]*restoreAndAddManualAction[^}]*\} from '\.\/manual-candidate-actions'/);
  assert.match(page,/Restaurar y añadir/);
  assert.match(page,/restored_pending/);
  assert.match(display,/'PROC-NOV-004':\{name:'Restaurar exclusión y volver a añadir'\}/);
});
