import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('lib/plex-sync.js','utf8');

test('NOV-009 pagina la revisión de identidades y no hace lecturas gigantes de 20000 títulos',()=>{
  assert.match(source,/const IDENTITY_REVIEW_PAGE_SIZE=500/);
  assert.match(source,/X-Plex-Container-Start=\$\{start\}/);
  assert.match(source,/X-Plex-Container-Size=\$\{IDENTITY_REVIEW_PAGE_SIZE\}/);
  assert.match(source,/pageCount<IDENTITY_REVIEW_PAGE_SIZE/);
  assert.doesNotMatch(source,/includeGuids=1&X-Plex-Container-Start=0&X-Plex-Container-Size=20000/);
});

test('los fetch failed del sync global conservan la ruta Plex que falló',()=>{
  assert.match(source,/processStep='plex_request'/);
  assert.match(source,/error\.message=`Plex \$\{path\}: \$\{error\.message\|\|'fetch failed'\}`/);
});
