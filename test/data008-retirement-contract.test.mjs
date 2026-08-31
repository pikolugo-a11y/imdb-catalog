import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const exists=path=>fs.existsSync(new URL(path,root));

test('DATA-008 deja de existir como proceso independiente',()=>{
  assert.equal(exists('worker/update-imdb-ratings.mjs'),false);
  assert.equal(exists('.github/workflows/imdb-ratings-refresh.yml'),false);
  const pkg=read('package.json');
  const ci=read('.github/workflows/ci.yml');
  assert.doesNotMatch(pkg,/worker:imdb-ratings|update-imdb-ratings/);
  assert.doesNotMatch(ci,/update-imdb-ratings/);
});

test('DATA-002 sigue siendo la vía canónica de ratings',()=>{
  const actions=read('app/calidad/datos/actions.js');
  const ratings=read('lib/ratings-refresh.js');
  assert.match(actions,/processCode:'PROC-DATA-002'/);
  assert.match(actions,/refreshRatingsForTitle\(imdbId,\{trace\}\)/);
  assert.match(ratings,/export async function refreshRatingsForTitle/);
});
