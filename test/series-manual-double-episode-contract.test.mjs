import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnostics=fs.readFileSync('lib/series-diagnostics-core.mjs','utf8');
const actions=fs.readFileSync('app/calidad/series/actions.js','utf8');
const detail=fs.readFileSync('lib/series-detail-query.js','utf8');
const page=fs.readFileSync('app/calidad/series/[ratingKey]/page.js','utf8');

test('manual double episode decisions are evidence-bound and survive diagnostic rebuilds',()=>{
  assert.match(actions,/reviewSeriesDoubleEpisodeAction/);
  assert.match(actions,/decision='manual_present'/);
  assert.match(actions,/manual_double:1/);
  assert.match(actions,/plex_fingerprint/);
  assert.match(actions,/await rebuildSeriesDiagnostics\(sql,ratingKey\)/);
  assert.match(diagnostics,/decision='manual_present'/);
  assert.match(diagnostics,/manualDoubleEvidence/);
  assert.match(diagnostics,/plex_fingerprint/);
  assert.match(diagnostics,/status:'covered_combined'/);
  assert.match(diagnostics,/Decisión manual: capítulo doble/);
});

test('series detail offers Capítulo doble on missing episodes and an undo for manual coverage',()=>{
  assert.match(detail,/override_decision/);
  assert.match(detail,/o\.decision='manual_present'/);
  assert.match(page,/reviewSeriesDoubleEpisodeAction/);
  assert.match(page,/Capítulo doble · lo cubre/);
  assert.match(page,/Deshacer capítulo doble/);
  assert.match(page,/plex_diagnostic_status==='missing'/);
});
