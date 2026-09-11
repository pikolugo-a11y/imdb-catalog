import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/plex-identity-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const admission=fs.readFileSync('app/novedades/catalog-admission-actions.js','utf8');
const news=fs.readFileSync('lib/news-v1.js','utf8');
const lifecycle=fs.readFileSync('lib/lifecycle-recompute-core.mjs','utf8');
const data=fs.readFileSync('lib/data001-canonical.mjs','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-010 keeps IMDb manual mode and adds explicit TMDb-only series mode',()=>{
  assert.match(action,/processCode:'PROC-NOV-010'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/identityMode==='tmdb_only'/);
  assert.match(action,/setPlexIdentity\(ratingKey,\{imdbId\}\)/);
  assert.match(action,/setPlexIdentity\(ratingKey,\{tmdbId\}\)/);
  assert.match(action,/technicalIdentityKeyForPlex/);
  assert.match(action,/technicalIdentityKey:true/);
  assert.match(action,/plexRatingKey:ratingKey/);
  assert.match(action,/eligibility_status[^\n]*'eligible'/);
  assert.doesNotMatch(action,/setPlexIdentity\(ratingKey,\{imdbId:internalId\}\)/);
  assert.doesNotMatch(action,/seedPlexNewsCandidates/);
});

test('Novedades offers TMDb-only only on Plex series and never exposes the technical key as IMDb',()=>{
  assert.match(page,/identityMode" value="tmdb_only"/);
  assert.match(page,/Usar TMDb solo/);
  assert.match(page,/series\?<form action=\{savePlexIdentityFromNewsAction\}/);
  assert.match(page,/TMDb #\$\{r\.source_snapshot\?\.tmdbId/);
  assert.match(page,/r\.imdb_id&&!tmdbOnly\(r\)/);
  assert.doesNotMatch(page,/savePlexIdentityAction from '@\/app\/actions'/);
});

test('TMDb-only Plex candidates are admitted with manual canonical mode and linked back to Plex',()=>{
  assert.match(admission,/identity_mode:'tmdb_only'/);
  assert.match(admission,/technical_identity_key:'plex_tmdb_only'/);
  assert.match(admission,/tmdb_id,tmdb_url,imdb_url/);
  assert.match(admission,/s\?\.plexRatingKey\|\|s\?\.ratingKey/);
  assert.match(news,/source_snapshot->>'identityMode'='tmdb_only'/);
});

test('Lifecycle and structural data honor TMDb-only without falling back to IMDb-based providers',()=>{
  assert.match(lifecycle,/const tmdbOnly=String\(r\.identity_mode\|\|''\)==='tmdb_only'/);
  assert.match(lifecycle,/if\(!tmdbOnly&&String\(r\.validation_status\|\|''\)!=='valid'\)/);
  assert.match(lifecycle,/if\(String\(row\?\.identity_mode\|\|''\)==='tmdb_only'\)return false/);
  assert.match(data,/const tmdbOnly=before\.identity_mode==='tmdb_only'/);
  assert.match(data,/const sources=tmdbOnly\?\[\['tmdb',refreshTmdb\]\]/);
  assert.match(data,/tmdb_rating=CASE WHEN \$\{tmdbOnly\}/);
  assert.match(display,/'PROC-NOV-010':\{name:'Guardar identidad manual de Plex'\}/);
});
