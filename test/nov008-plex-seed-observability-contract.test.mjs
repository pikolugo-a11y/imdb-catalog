import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/plex-actions.js','utf8');
const seed=fs.readFileSync('lib/plex-news-seed.js','utf8');
const button=fs.readFileSync('components/PlexSyncButton.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-008 wraps Plex sync and news seed in one observed system run',()=>{
  assert.match(action,/processCode:'PROC-NOV-008'/);
  assert.match(action,/runKind:'system'/);
  assert.match(action,/syncPlexFast\(\{reviewFrom\}\)/);
  assert.match(action,/seedPlexNewsCandidates\(\)/);
  assert.match(action,/step:'plex_sync'/);
  assert.match(action,/step:'seed_news'/);
  assert.doesNotMatch(action,/startRun\(|finishRun\(/);
});

test('Plex seed only requires admission identity, not ratings or year',()=>{
  assert.match(seed,/const hasMinimums=r=>Boolean\(r\.imdb_id&&r\.title&&r\.title!==r\.imdb_id&&r\.candidate_type/);
  assert.doesNotMatch(seed,/imdbRatingsFromOfficialDataset/);
});

test('Novedades reads latest Plex sync from canonical process runs',()=>{
  assert.match(button,/process_code='PROC-NOV-008'/);
  assert.match(page,/process_code='PROC-NOV-008'/);
  assert.match(display,/'PROC-NOV-008':\{name:'Actualizar Plex y sembrar Novedades'\}/);
});
