import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fetchPlexJsonWithRetry} from '../lib/plex-request-error.mjs';

test('las lecturas largas Plex mantienen viva la lease mientras esperan',async()=>{
  let heartbeats=0;
  const trace={heartbeat:async()=>{heartbeats++},externalCall:()=>{},event:async()=>{}};
  const fetchImpl=async()=>{await new Promise(r=>setTimeout(r,35));return{ok:true,json:async()=>({MediaContainer:{}})}};
  const out=await fetchPlexJsonWithRetry({
    url:'http://plex.local/test',
    path:'/test',
    headers:{},
    trace,
    timeouts:[1000],
    fetchImpl,
    signalFactory:()=>undefined,
    heartbeatIntervalMs:5
  });
  assert.deepEqual(out,{MediaContainer:{}});
  assert.ok(heartbeats>=2);
});

test('SER-001 usa 1000 s en inventarios pesados pero mantiene timeouts cortos para detalle',()=>{
  const c=fs.readFileSync(new URL('../lib/series-plex-sync.js',import.meta.url),'utf8');
  assert.match(c,/PLEX_REQUEST_TIMEOUTS=\[45000,60000,90000\]/);
  assert.match(c,/PLEX_INVENTORY_TIMEOUTS=\[1000000,1000000,1000000\]/);
  assert.match(c,/type=4[\s\S]*PLEX_INVENTORY_TIMEOUTS/);
  assert.match(c,/X-Plex-Container-Size=20000[\s\S]*PLEX_INVENTORY_TIMEOUTS/);
});

test('los Batch Plex internos SER-001 y SER-002 pueden consumir sus tres intentos sin 6h\/24h',()=>{
  const c=fs.readFileSync(new URL('../lib/batch-worker-runtime.mjs',import.meta.url),'utf8');
  assert.match(c,/process_code IN\('PROC-NOV-009','PROC-SER-001','PROC-SER-002'\)/);
  assert.match(c,/MAX_ATTEMPTS=3/);
});
