import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const plexSync=fs.readFileSync(new URL('../lib/plex-sync.js',import.meta.url),'utf8');
const batchRuntime=fs.readFileSync(new URL('../lib/batch-worker-runtime.mjs',import.meta.url),'utf8');

test('la sincronización Plex global permite hasta 1000 s por petición interna',()=>{
  assert.match(plexSync,/PLEX_REQUEST_TIMEOUT_MS=1000000/);
  assert.match(plexSync,/AbortSignal\.timeout\(PLEX_REQUEST_TIMEOUT_MS\)/);
});

test('PROC-NOV-009 permite cinco reintentos, con un minuto entre ellos',()=>{
  assert.match(batchRuntime,/const NOV009_RETRIES=5/);
  assert.match(batchRuntime,/const NOV009_MAX_ATTEMPTS=1\+NOV009_RETRIES/);
  assert.match(batchRuntime,/const NOV009_RETRY_DELAY_MINUTES=1/);
  assert.match(batchRuntime,/maxAttemptsFor\(item\.process_code\)/);
  assert.match(batchRuntime,/r\.process_code='PROC-NOV-009' AND bi\.updated_at<=now\(\)-\(\$\{NOV009_RETRY_DELAY_MINUTES\}\|\|' minutes'\)::interval/);
});

test('timeout y fallos de red Plex global son retryable; 429 y 5xx también',()=>{
  assert.match(plexSync,/createPlexTimeoutError\(error,\{path,attempt:0\}\)/);
  assert.match(plexSync,/error\.retryable==null&&error\.name==='TypeError'\)error\.retryable=true/);
  assert.match(plexSync,/retryable:r\.status===429\|\|r\.status>=500/);
});
