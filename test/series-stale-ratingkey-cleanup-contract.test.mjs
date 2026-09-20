import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sync=fs.readFileSync(new URL('../lib/series-plex-sync.js',import.meta.url),'utf8');

test('SER-001 retira referencias antiguas sólo con reemplazo Plex canónico activo',()=>{
  assert.match(sync,/oldp\.active=false/);
  assert.match(sync,/pcs\.status='in_plex'/);
  assert.match(sync,/pcs\.rating_key<>oldr\.show_rating_key/);
  assert.match(sync,/newp\.active=true/);
  assert.match(sync,/newr\.show_rating_key=pcs\.rating_key/);
  assert.match(sync,/newr\.imdb_id=oldr\.imdb_id/);
});

test('la limpieza automática protege episodios activos y decisiones manuales',()=>{
  assert.match(sync,/NOT EXISTS\([\s\S]*ep\.grandparent_rating_key=oldr\.show_rating_key[\s\S]*ep\.active=true/);
  assert.match(sync,/NOT EXISTS\([\s\S]*series_episode_overrides[\s\S]*o\.show_rating_key=oldr\.show_rating_key/);
});

test('la limpieza elimina sólo datos técnicos de la referencia obsoleta y conserva plex_items históricos',()=>{
  for(const table of [
    'series_episode_availability',
    'series_diagnostics',
    'series_season_availability',
    'series_reference_episodes',
    'series_quality_read_model',
    'series_reference'
  ]) assert.match(sync,new RegExp(`DELETE FROM ${table}`));
  assert.doesNotMatch(sync,/DELETE FROM plex_items WHERE rating_key=ANY\(\$\{keys\}\)/);
  assert.match(sync,/staleReferencesRemoved/);
  assert.match(sync,/stale_references_removed/);
});
