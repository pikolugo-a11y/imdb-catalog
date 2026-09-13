import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('db/migrations/20260914_series_episode_exclusions.sql','utf8');
const action=fs.readFileSync('app/calidad/series/episode-exclusion-actions.js','utf8');
const page=fs.readFileSync('app/calidad/series/[ratingKey]/page.js','utf8');

// An exclusion is an editorial override on an official episode. It satisfies
// quality completeness without pretending that a Plex item exists physically.
test('effective series status treats unavailable override as covered',()=>{
  assert.match(migration,/LEFT JOIN series_episode_overrides o/);
  assert.match(migration,/episode_override_decision='unavailable' THEN 'present'/);
  assert.match(migration,/episode_override_decision/);
});

test('manual exclusion is restricted to an official episode currently missing in Plex',()=>{
  assert.match(action,/series_reference_episodes/);
  assert.match(action,/diagnostic\?\.status!=='missing'/);
  assert.match(action,/decision,note,created_at,updated_at/);
  assert.match(action,/'unavailable'/);
  assert.match(action,/decision='unavailable'/);
  assert.match(action,/rebuildSeriesQualityReadModelForRatingKey/);
});

test('quality UI distinguishes an exclusion from a physical Plex episode and allows reversal',()=>{
  assert.match(page,/⊘ Exclusión/);
  assert.match(page,/No encontrado · exclusión manual/);
  assert.match(page,/Marcar Exclusión/);
  assert.match(page,/Quitar exclusión/);
  assert.match(page,/Cobertura efectiva/);
});
