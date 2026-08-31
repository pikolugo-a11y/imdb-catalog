import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/plex-actions.js','utf8');
const button=fs.readFileSync('components/PlexSyncButton.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('NOV-009 is the canonical observed global incremental Plex sync',()=>{
  assert.match(action,/processCode:'PROC-NOV-009'/);
  assert.match(action,/operation:'sync_plex_global'/);
  assert.match(action,/syncPlexFast\(\{reviewFrom\}\)/);
  assert.match(action,/runKind:'system'/);
  assert.match(action,/process_code IN\('PROC-NOV-009','PROC-NOV-008'\)/);
  assert.match(display,/'PROC-NOV-009':\{name:'Sincronizar Plex global'\}/);
});

test('Novedades keeps one visible Plex button and reads last global sync from NOV-009',()=>{
  assert.match(button,/process_code='PROC-NOV-009'/);
  assert.match(button,/process_code IN\('PROC-NOV-009','PROC-NOV-008'\)/);
  assert.match(page,/process_code='PROC-NOV-009'/);
  assert.match(page,/<PlexSyncButton\/>/);
});
