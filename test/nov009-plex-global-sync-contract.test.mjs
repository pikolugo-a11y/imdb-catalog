import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/plex-actions.js','utf8');
const button=fs.readFileSync('components/PlexSyncButton.js','utf8');
const page=fs.readFileSync('app/novedades/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');
const plexSync=fs.readFileSync('lib/plex-sync.js','utf8');

test('NOV-009 is the canonical observed global incremental Plex sync',()=>{
  assert.match(action,/processCode:'PROC-NOV-009'/);
  assert.match(action,/operation:'sync_plex_global'/);
  assert.match(action,/syncPlexFast\(\{reviewFrom\}\)/);
  assert.match(action,/runKind:'system'/);
  assert.match(action,/process_code IN\('PROC-NOV-009','PROC-NOV-008'\)/);
  assert.match(display,/'PROC-NOV-009':\{name:'Sincronizar Plex global'\}/);
});

test('Novedades keeps one visible Plex button and ignores stale Plex runs',()=>{
  assert.match(button,/process_code='PROC-NOV-009'/);
  assert.match(button,/process_code IN\('PROC-NOV-009','PROC-NOV-008'\)/);
  assert.match(button,/PLEX_STALE_RUN_MINUTES=5/);
  assert.match(button,/COALESCE\(started_at,requested_at\)>=now\(\)-/);
  assert.match(page,/<PlexSyncButton\/>/);
  assert.doesNotMatch(page,/process_code='PROC-NOV-009'/);
});

test('NOV-009 allows up to 280 seconds and does not retry Plex requests',()=>{
  assert.match(plexSync,/const PLEX_REQUEST_TIMEOUT_MS=280000;/);
  assert.match(plexSync,/AbortSignal\.timeout\(PLEX_REQUEST_TIMEOUT_MS\)/);
  assert.doesNotMatch(plexSync,/attempt<2/);
  assert.doesNotMatch(plexSync,/return get\(base,token,path,\{attempt:/);
  assert.match(action,/const PLEX_EXECUTION_TIMEOUT_MS=280000;/);
  assert.match(action,/retries:0/);
  assert.match(action,/Promise\.race\(\[syncPlexFast\(\{reviewFrom\}\),plexDeadline\(\)\]\)/);
});

test('NOV-009 closes stale runs canonically before accepting another launch',()=>{
  assert.match(action,/closeStalePlexRuns\(sql\)/);
  assert.match(action,/recordProcessError\(row\.run_id/);
  assert.match(action,/finishProcessRun\(row\.run_id,\{technicalStatus:'failed'/);
  assert.match(action,/code:'PLEX_STALE_RUN'/);
});
