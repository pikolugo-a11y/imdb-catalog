import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/manual-candidate-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-003 retries the same canonical minimum resolver under common observability',()=>{
  assert.match(action,/processCode:'PROC-NOV-003'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/executor:'vercel'/);
  assert.match(action,/operation:'retry_manual_minimums'/);
  const retry=action.slice(action.indexOf('export async function retryManualCandidateAction'));
  assert.match(retry,/resolveManualNewsCandidate\(imdbId,\{trace\}\)/);
  assert.doesNotMatch(retry,/dispatchManualAuthoritative/);
  assert.doesNotMatch(retry,/GitHub|workflow|dataset|enrichTitle/);
});

test('NOV-003 only retries active manual candidates and promotes only real minimum identity',()=>{
  const retry=action.slice(action.indexOf('export async function retryManualCandidateAction'));
  assert.match(retry,/source_snapshot->>'manual'='true'/);
  assert.match(retry,/manualActive/);
  assert.match(retry,/persistResolved\(sql,imdbId,resolved\)/);
  assert.match(action,/const status=resolved\.ready\?'eligible':'processing'/);
  assert.match(retry,/functionalResult:'pending'/);
  assert.match(retry,/functionalResult:'updated'/);
});

test('Novedades UI wires retry to NOV-003 and exposes human operation name',()=>{
  assert.match(page,/import \{[^}]*retryManualCandidateAction[^}]*\} from '\.\/manual-candidate-actions'/);
  assert.match(page,/↻ Reintentar/);
  assert.match(page,/retry_resolved/);
  assert.match(display,/'PROC-NOV-003':\{name:'Reintentar candidato manual'\}/);
});
