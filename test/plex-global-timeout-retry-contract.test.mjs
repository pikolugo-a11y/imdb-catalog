import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../lib/plex-sync.js',import.meta.url),'utf8');

test('la sincronización Plex no espera 120 s por una única petición',()=>{
  assert.match(src,/AbortSignal\.timeout\(20000\)/);
  assert.doesNotMatch(src,/AbortSignal\.timeout\(120000\)/);
});

test('timeouts y errores transitorios de Plex se reintentan de forma acotada',()=>{
  assert.match(src,/attempt<2/);
  assert.match(src,/TimeoutError/);
  assert.match(src,/error\.source='plex'/);
  assert.match(src,/error\.retryable=true/);
});
