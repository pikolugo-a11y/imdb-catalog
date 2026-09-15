import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const action=fs.readFileSync('app/novedades/plex-actions.js','utf8');
const button=fs.readFileSync('components/PlexSyncButton.js','utf8');
const client=fs.readFileSync('components/PlexSyncButtonClient.js','utf8');
const starter=fs.readFileSync('lib/plex-global-batch.js','utf8');
const plexWorker=fs.readFileSync('worker/batch-plex-worker.mjs','utf8');
const apiWorker=fs.readFileSync('worker/batch-api-worker.mjs','utf8');
const nov009Worker=fs.readFileSync('lib/plex-global-worker.mjs','utf8');
const nov008Worker=fs.readFileSync('lib/plex-news-worker.mjs','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');
const plexSync=fs.readFileSync('lib/plex-sync.js','utf8');

test('NOV-009 se inicia manualmente en Vercel pero el barrido vive en Railway Plex',()=>{
  assert.match(action,/startPlexGlobalBatch\('PROC-NOV-009'/);
  assert.match(action,/triggerSource:'novedades_manual'/);
  assert.doesNotMatch(action,/syncPlexFast/);
  assert.doesNotMatch(action,/Promise\.race/);
  assert.doesNotMatch(action,/PLEX_EXECUTION_TIMEOUT_MS/);
  assert.match(starter,/'PROC-NOV-009':\{pool:'plex'/);
  assert.match(starter,/executor:'railway_batch_plex'/);
  assert.match(starter,/VALUES\(\$\{runId\}::uuid,\$\{cfg\.entityType\},'global',0,'queued'\)/);
  assert.match(plexWorker,/executeNov009/);
  assert.match(plexWorker,/\['PROC-NOV-009',\{execute:executeNov009\}\]/);
  assert.match(nov009Worker,/syncPlexFast\(\{reviewFrom\}\)/);
  assert.match(nov009Worker,/withLeaseHeartbeat/);
  assert.match(display,/'PROC-NOV-009':\{name:'Sincronizar Plex global'\}/);
});

test('NOV-009 mantiene la fecha solicitada y encadena NOV-008 de forma durable',()=>{
  assert.match(starter,/review_from:contextReviewFrom\(reviewFrom\)/);
  assert.match(nov009Worker,/parent\.context\?\.review_from/);
  assert.match(nov009Worker,/startPlexGlobalBatch\('PROC-NOV-008'/);
  assert.match(nov009Worker,/triggerSource:'plex_sync_continuation'/);
  assert.match(starter,/'PROC-NOV-008':\{pool:'api'/);
  assert.match(apiWorker,/executeNov008/);
  assert.match(apiWorker,/'PROC-NOV-008':executeNov008/);
  assert.match(nov008Worker,/seedPlexNewsCandidates\(\{sql,trace\}\)/);
});

test('Novedades observa el estado durable sin considerar caducada una ejecución larga',()=>{
  assert.match(button,/process_code IN\('PROC-NOV-009','PROC-NOV-008'\)/);
  assert.match(button,/technical_status IN\('queued','running'\)/);
  assert.doesNotMatch(button,/PLEX_STALE_RUN_MINUTES/);
  assert.doesNotMatch(button,/interval '1 minute'/);
  assert.match(client,/setInterval\(refresh,10000\)/);
  assert.match(client,/document\.visibilityState==='visible'/);
  assert.doesNotMatch(client,/useState/);
  assert.doesNotMatch(client,/submitting/);
});

test('el timeout de 280 segundos ya no limita la ejecución completa; sólo sigue existiendo el timeout de requests Plex',()=>{
  assert.match(plexSync,/const PLEX_REQUEST_TIMEOUT_MS=280000;/);
  assert.match(plexSync,/AbortSignal\.timeout\(PLEX_REQUEST_TIMEOUT_MS\)/);
  assert.doesNotMatch(action,/280000/);
  assert.doesNotMatch(action,/plexDeadline/);
});
