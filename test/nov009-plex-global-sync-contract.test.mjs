import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

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
const plexSyncCore=fs.readFileSync('lib/plex-sync-core.mjs','utf8');
const plexDocker=fs.readFileSync('Dockerfile.batch-plex','utf8');
const apiDocker=fs.readFileSync('Dockerfile.batch-api','utf8');

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

test('el timeout global no limita la ejecución completa; cada request Plex puede esperar hasta 1000 segundos',()=>{
  assert.match(plexSync,/const PLEX_REQUEST_TIMEOUT_MS=1000000;/);
  assert.match(plexSync,/AbortSignal\.timeout\(PLEX_REQUEST_TIMEOUT_MS\)/);
  assert.doesNotMatch(action,/280000/);
  assert.doesNotMatch(action,/plexDeadline/);
});

test('NOV-009 reutiliza una sola conexión Plex validada durante toda la ejecución',()=>{
  assert.match(plexSync,/const baseUrl=await discoverPlexUrlCore\(token,configuredBase\)/);
  assert.match(plexSync,/reviewIdentitiesSince\(sql,token,baseUrl,cutoff\.toISOString\(\)\)/);
  assert.match(plexSync,/syncPlexFastCore\(\{sql,token,baseUrl\}\)/);
  assert.doesNotMatch(plexSync,/reviewIdentitiesSince\(sql,token,baseUrl,reviewFrom\)\{\s*const base=await discoverPlexUrlCore/);
});

test('el estado Plex usa IMDb normal y TMDb prioritario con fallback IMDb exacto en series TMDb-only',()=>{
  assert.match(plexSyncCore,/source_status->>'identity_mode'/);
  assert.match(plexSyncCore,/e\.provider='tmdb' AND e\.external_id=m\.tmdb_id::text/);
  assert.match(plexSyncCore,/COALESCE\(m\.source_status->>'identity_mode','normal'\)='tmdb_only'[\s\S]*?e\.provider='imdb' AND e\.external_id=m\.imdb_id/);
  assert.match(plexSyncCore,/2::int match_priority/);
  assert.match(plexSyncCore,/ORDER BY imdb_id,active DESC,match_priority,last_seen_at DESC/);
  assert.match(plexSyncCore,/m\.type IN\('Serie','Miniserie'\) AND p\.item_type='show'/);
});

test('Plex y API normalizan los imports relativos antes de arrancar Railway',()=>{
  assert.match(plexDocker,/node scripts\/normalize-worker-imports\.mjs lib/);
  assert.match(apiDocker,/node scripts\/normalize-worker-imports\.mjs lib/);
  const tmp=fs.mkdtempSync(path.join(process.cwd(),'.tmp-worker-runtime-'));
  try{
    const libDir=path.join(tmp,'lib');
    fs.cpSync(path.join(process.cwd(),'lib'),libDir,{recursive:true});
    const normalize=spawnSync(process.execPath,['scripts/normalize-worker-imports.mjs',libDir],{encoding:'utf8'});
    assert.equal(normalize.status,0,normalize.stderr||normalize.stdout);
    const plexUrl=pathToFileURL(path.join(libDir,'plex-global-worker.mjs')).href;
    const apiUrl=pathToFileURL(path.join(libDir,'plex-news-worker.mjs')).href;
    const probe=spawnSync(process.execPath,['--conditions=react-server','--experimental-specifier-resolution=node','-e',`Promise.all([import(${JSON.stringify(plexUrl)}),import(${JSON.stringify(apiUrl)})]).catch(e=>{console.error(e);process.exit(1)})`],{encoding:'utf8',env:{...process.env,DATABASE_URL:process.env.DATABASE_URL||'postgresql://placeholder:placeholder@localhost:5432/placeholder'}});
    assert.equal(probe.status,0,probe.stderr||probe.stdout);
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});
