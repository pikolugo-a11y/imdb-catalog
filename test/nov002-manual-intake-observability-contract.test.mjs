import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/manual-candidate-actions.js','utf8');
const resolver=fs.readFileSync('lib/news-manual-resolver.js','utf8');
const news=fs.readFileSync('lib/news-v1.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-002 usa operación individual observada desde Novedades',()=>{
  assert.match(action,/processCode:'PROC-NOV-002'/);
  assert.match(action,/triggerSource:'novedades_manual'/);
  assert.match(action,/executeObservedProcess/);
  assert.match(action,/resolveManualNewsCandidate\(imdbId,\{trace\}\)/);
});

test('NOV-002 sólo exige IMDb + título + tipo y no usa dataset/workflow autoritativo',()=>{
  assert.match(resolver,/const ready=Boolean\(candidate_type&&title\)/);
  assert.doesNotMatch(resolver,/imdbRatingFromOfficialDataset/);
  assert.doesNotMatch(action,/GITHUB_ACTIONS_TOKEN|workflow|dispatchManualAuthoritative|enrichTitle/);
});

test('candidato incompleto no queda falsamente elegible',()=>{
  assert.match(action,/const status=resolved\.ready\?'eligible':'processing'/);
  assert.match(action,/technicalStatus:'partial',functionalResult:'pending'/);
  assert.match(news,/manualResolveStatus==='failed'.*return 'error'/s);
});

test('frontal usa la acción canónica nueva',()=>{
  assert.match(page,/import \{[^}]*addManualCandidateAction[^}]*\} from '\.\/manual-candidate-actions'/);
  assert.match(page,/<form action=\{addManualCandidateAction\}/);
});

test('Operaciones muestra nombre humano NOV-002',()=>{
  assert.match(display,/'PROC-NOV-002':\{name:'Añadir IMDb manual a Novedades'\}/);
});
