import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/plex-identity-actions.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-010 is an observed individual manual Plex identity process',()=>{
  assert.match(action,/processCode:'PROC-NOV-010'/);
  assert.match(action,/runKind:'individual'/);
  assert.match(action,/setPlexIdentity\(ratingKey,\{imdbId\}\)/);
  assert.match(action,/plex_manual_identity/);
  assert.match(action,/eligibility_status[^\n]*'eligible'/);
  assert.doesNotMatch(action,/seedPlexNewsCandidates/);
  assert.doesNotMatch(action,/enrichTitle|omdb|tmdb/i);
});

test('Novedades uses NOV-010 action for unidentified Plex rows',()=>{
  assert.match(page,/savePlexIdentityFromNewsAction/);
  assert.doesNotMatch(page,/savePlexIdentityAction from '@\/app\/actions'/);
  assert.match(display,/'PROC-NOV-010':\{name:'Guardar IMDb manual de Plex'\}/);
});
