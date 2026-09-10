import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fullReadModel=fs.readFileSync('lib/series-quality-query.js','utf8');
const scopedReadModel=fs.readFileSync('lib/series-quality-read-model-core.mjs','utf8');
const detail=fs.readFileSync('lib/series-detail-query.js','utf8');

for(const [name,source] of [['full read model',fullReadModel],['scoped read model',scopedReadModel]]){
  test(`${name} excludes only current SER-005 manual ignores from unmapped Plex episodes`,()=>{
    assert.match(source,/LEFT JOIN series_episode_overrides o/);
    assert.match(source,/o\.decision IN \('special','not_needed'\)/);
    assert.match(source,/"ser005":1/);
    assert.match(source,/plex_rating_key/);
    assert.match(source,/plex_fingerprint/);
    assert.match(source,/COALESCE\(p\.fingerprint,''\)/);
  });
}

test('series detail keeps the same evidence-bound semantics',()=>{
  assert.match(detail,/accepted=\['special','not_needed'\]/);
  assert.match(detail,/String\(ev\.plex_rating_key\)===String\(row\.rating_key\)/);
  assert.match(detail,/String\(ev\.plex_fingerprint\|\|''\)===String\(row\.fingerprint\|\|''\)/);
  assert.match(detail,/unresolvedExtras=extras\.filter\(e=>!e\.override_current\)/);
});
