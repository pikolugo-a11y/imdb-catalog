import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/plex-actions.js','utf8');
const seed=fs.readFileSync('lib/plex-news-seed.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-008 is the observed Plex-to-Novedades seed phase',()=>{
  assert.match(action,/processCode:'PROC-NOV-008'/);
  assert.match(action,/operation:'seed_plex_news'/);
  assert.match(action,/seedPlexNewsCandidates\(\)/);
  assert.match(action,/step:'seed_news'/);
  assert.doesNotMatch(action,/startRun\(|finishRun\(/);
  assert.match(display,/'PROC-NOV-008':\{name:'Sembrar candidatos Plex en Novedades'\}/);
});

test('Plex seed only requires admission identity, not ratings or year',()=>{
  assert.match(seed,/const hasMinimums=r=>Boolean\(r\.imdb_id&&r\.title&&r\.title!==r\.imdb_id&&r\.candidate_type/);
  assert.doesNotMatch(seed,/imdbRatingsFromOfficialDataset/);
});
