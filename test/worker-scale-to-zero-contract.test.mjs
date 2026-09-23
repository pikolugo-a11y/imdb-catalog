import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildWorkerWakeAuth,verifyWorkerWakeAuth} from '../lib/worker-wake-auth.mjs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('wake HMAC autentica el pool y caduca',()=>{
  const db='postgresql://user:secret@example.test/db';
  const now=Date.parse('2026-09-23T21:00:00Z');
  const auth=buildWorkerWakeAuth(db,'api',now);
  assert.equal(verifyWorkerWakeAuth(db,'api',{...auth,now:now+30_000}),true);
  assert.equal(verifyWorkerWakeAuth(db,'fast',{...auth,now:now+30_000}),false);
  assert.equal(verifyWorkerWakeAuth(db,'api',{...auth,now:now+180_000}),false);
  assert.equal(verifyWorkerWakeAuth('postgresql://user:other@example.test/db','api',{...auth,now:now+30_000}),false);
});

test('los cuatro workers persistentes son wake-driven y no hacen polling idle',()=>{
  for(const path of ['worker/batch-api-worker.mjs','worker/batch-fast-worker.mjs','worker/batch-plex-worker.mjs','worker/technical-snapshot-worker.mjs']){
    const src=read(path);
    assert.match(src,/startWakeServer/);
    assert.match(src,/wake_driven/);
  }
  assert.doesNotMatch(read('worker/batch-api-worker.mjs'),/BATCH_POLL_MS/);
  assert.doesNotMatch(read('worker/batch-fast-worker.mjs'),/BATCH_IDLE_MS/);
  assert.doesNotMatch(read('worker/batch-plex-worker.mjs'),/BATCH_IDLE_MS/);
  assert.doesNotMatch(read('worker/technical-snapshot-worker.mjs'),/TECHNICAL_SNAPSHOT_IDLE_MS|await sleep\(idleMs\)/);
});

test('encolar, ampliar o reanudar una cola despierta su pool',()=>{
  const runtime=read('lib/process-runtime.js');
  assert.match(runtime,/worker-wake-client/);
  assert.match(runtime,/batch_queued/);
  assert.match(runtime,/batch_items_appended/);
  assert.match(runtime,/batch_resumed/);
  assert.match(runtime,/wakeWorkerPool\(pool/);
});

test('el wake no añade secretos nuevos y reutiliza DATABASE_URL para firma',()=>{
  const client=read('lib/worker-wake-client.js');
  const auth=read('lib/worker-wake-auth.mjs');
  assert.match(client,/process\.env\.DATABASE_URL\|\|process\.env\.NEON_DATABASE_URL/);
  assert.match(auth,/createHmac\('sha256'/);
  assert.match(auth,/timingSafeEqual/);
  assert.doesNotMatch(client,/WAKE_SECRET/);
});

test('la captura técnica se despierta al iniciar o reanudar',()=>{
  const trigger=read('lib/pikoquality-technical-trigger.js');
  const actions=read('app/calidad/pikoquality/actions.js');
  assert.match(trigger,/wakeWorkerPool\('technical'/);
  assert.match(actions,/technical_resumed/);
  assert.match(actions,/technical_started/);
});

test('el planner actúa como recuperación sin despertar pools sin trabajo activo',()=>{
  const planner=read('lib/process-planning.js');
  assert.match(planner,/wakeActiveWorkersForRecovery/);
  assert.match(planner,/c\.closed_at IS NULL AND c\.desired_state='running'/);
  assert.match(planner,/technical\?\.armed&&technical\?\.requested_state==='running'/);
});

test('el endpoint health de worker no toca Neon',()=>{
  const server=read('lib/worker-wake-server.mjs');
  const start=server.indexOf("url.pathname==='/health'");
  const end=server.indexOf("url.pathname==='/wake'");
  const health=server.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(health,/DATABASE_URL|batchSql|fetch\(/);
});
