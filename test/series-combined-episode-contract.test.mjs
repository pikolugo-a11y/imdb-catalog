import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('la UI permite decidir capítulo doble o triple desde un faltante',()=>{
  const page=read('app/calidad/series/[ratingKey]/page.js');
  assert.match(page,/combinedSize=\{2\}/);
  assert.match(page,/combinedSize=\{3\}/);
  assert.match(page,/Capítulo doble/);
  assert.match(page,/Capítulo triple/);
  assert.match(page,/Capítulo combinado · decisión manual/);
});

test('la acción combinada valida y persiste dos o tres episodios oficiales',()=>{
  const actions=read('app/calidad/series/actions.js');
  assert.match(actions,/!\[2,3\]\.includes\(combinedSize\)/);
  assert.match(actions,/Array\.from\(\{length:combinedSize-1\}/);
  assert.match(actions,/target_episodes:targetEpisodes/);
  assert.match(actions,/manual_combined:1/);
  assert.match(actions,/episode_number=ANY\(\$\{targetEpisodes\}\)/);
});

test('diagnóstico mantiene compatibilidad con dobles antiguos y reconoce triples',()=>{
  const diagnostics=read('lib/series-diagnostics-core.mjs');
  assert.match(diagnostics,/manual_combined!==1&&x\?\.manual_double!==1/);
  assert.match(diagnostics,/combined_size:combinedSize/);
  assert.match(diagnostics,/size===3\?'triple'/);
});