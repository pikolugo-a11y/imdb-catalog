import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const unitary=fs.readFileSync(new URL('../lib/series-unitary-core.mjs',import.meta.url),'utf8');
const reconcile=fs.readFileSync(new URL('../lib/series-reference-reconcile-core.mjs',import.meta.url),'utf8');

test('SER-003 permite refrescar una serie TMDb-only sin depender de validación IMDb',()=>{
  assert.match(unitary,/identity_mode'='tmdb_only'/);
  assert.match(unitary,/m\.tmdb_id IS NOT NULL/);
  assert.match(unitary,/OR iv\.validation_status='valid'/);
  assert.match(unitary,/CASE WHEN m\.source_status->>'identity_mode'='tmdb_only' THEN m\.tmdb_id ELSE r\.tmdb_id END AS tmdb_id/);
  assert.match(unitary,/reference_source='tmdb_only_manual'/);
});

test('la reconciliación Plex no puede sustituir el TMDb manual de una serie TMDb-only',()=>{
  assert.match(reconcile,/m\.source_status->>'identity_mode'='tmdb_only'/);
  assert.match(reconcile,/THEN m\.tmdb_id ELSE p\.tmdb_id END new_tmdb/);
  assert.match(reconcile,/COALESCE\(m\.source_status->>'identity_mode','normal'\)<>'tmdb_only'/);
  assert.match(reconcile,/tmdb_only_manual/);
});
