import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/catalogo/excluidas/actions.js','utf8');
const page=fs.readFileSync('app/catalogo/excluidas/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');
const admission=fs.readFileSync('app/novedades/catalog-admission-actions.js','utf8');
const news=fs.readFileSync('lib/news-v1.js','utf8');

test('NOV-016 routes restoration to Novedades without automatic admission',()=>{
  assert.match(action,/processCode:'PROC-NOV-016'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/restoredFromExclusion:true/);
  assert.match(action,/pendingCatalogAdmission:true/);
  assert.match(action,/kept_exclusion_guard:true/);
  assert.doesNotMatch(action,/DELETE FROM catalog_exclusions/);
  assert.doesNotMatch(action,/recomputeLifecycleForIds/);
  assert.doesNotMatch(action,/enrichTitle|seedPlexNewsCandidates|omdb|tmdb|wikidata/i);
});

test('restored candidate stays visible in Novedades and admission removes exclusion only after human action',()=>{
  assert.match(news,/restoredFromExclusion/);
  assert.match(admission,/restoredFromExclusion/);
  assert.match(admission,/DELETE FROM catalog_exclusions/);
  assert.match(admission,/catalogAdmission:'restored_explicit'/);
  assert.match(admission,/recomputeLifecycleForIds/);
});

test('excluded frontend stays on Excluidas and uses canonical restore action',()=>{
  assert.match(page,/restoreExclusionAction/);
  assert.match(page,/Sigues en Excluidas/);
  assert.doesNotMatch(page,/restoreTitle from '@\/app\/actions'/);
  assert.match(display,/'PROC-NOV-016':\{name:'Restaurar exclusión'\}/);
});
