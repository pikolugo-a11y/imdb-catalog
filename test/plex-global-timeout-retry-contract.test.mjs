import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const plexSync=fs.readFileSync(new URL('../lib/plex-sync.js',import.meta.url),'utf8');
const batchRuntime=fs.readFileSync(new URL('../lib/batch-worker-runtime.mjs',import.meta.url),'utf8');

test('la sincronización Plex global permite hasta 1000 s por petición interna',()=>{
  assert.match(plexSync,/PLEX_REQUEST_TIMEOUT_MS=1000000/);
  assert.match(plexSync,/AbortSignal\.timeout\(PLEX_REQUEST_TIMEOUT_MS\)/);
});

test('los tres intentos Batch de PROC-NOV-009 son consecutivos',()=>{
  assert.match(batchRuntime,/r\.process_code='PROC-NOV-009'/);
  assert.match(batchRuntime,/MAX_ATTEMPTS=3/);
  assert.match(batchRuntime,/bi\.attempt_count=1 AND bi\.updated_at<=now\(\)-interval '6 hours'/);
  assert.match(batchRuntime,/bi\.attempt_count>=2 AND bi\.updated_at<=now\(\)-interval '24 hours'/);
});

test('el timeout Plex global sigue siendo retryable para consumir los tres intentos inmediatos',()=>{
  assert.match(plexSync,/createPlexTimeoutError\(error,\{path,attempt:0\}\)/);
});
