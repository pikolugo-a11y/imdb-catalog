import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../lib/people-dashboard.js',import.meta.url),'utf8');

test('refreshed Personas dashboard uses person_filmography as canonical universe',()=>{
  assert.match(source,/WITH legacy AS/);
  assert.match(source,/canonical AS/);
  assert.match(source,/FROM person_filmography f/);
  assert.match(source,/filmography_refreshed_at IS NOT NULL THEN COALESCE\(c\.role_movies,0\)/);
  assert.match(source,/filmography_refreshed_at IS NOT NULL THEN COALESCE\(c\.plex_movies,0\)/);
  assert.match(source,/filmography_refreshed_at IS NOT NULL THEN c\.avg_score/);
  assert.match(source,/filmography_refreshed_at IS NOT NULL THEN COALESCE\(c\.scored,0\)/);
  assert.match(source,/filmography_refreshed_at IS NOT NULL THEN COALESCE\(c\.outside_relevant,0\)/);
});

test('canonical relevance matches Persona detail semantics',()=>{
  assert.match(source,/m\.imdb_id IS NOT NULL OR f\.is_pikofilm_relevant IS NOT FALSE/);
  assert.match(source,/c\.effective_status='in_plex'/);
  assert.match(source,/c\.final_rating IS NOT NULL/);
});

test('unrefreshed people retain bounded legacy fallback',()=>{
  assert.match(source,/ELSE l\.legacy_role_movies/);
  assert.match(source,/ELSE l\.legacy_plex_movies/);
  assert.match(source,/ELSE l\.legacy_avg_score/);
});
