import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('scheduler de Calidad mantiene dominios vencidos sin hacer polling Plex',()=>{
  const cron=read('app/api/cron/dashboard-snapshot/route.js');
  assert.match(cron,/startMov001Batch\(\{limit:100,triggerSource:'quality_scheduler'\}\)/);
  assert.match(cron,/startSeriesBatch\('PROC-SER-002',\{limit:50,triggerSource:'quality_scheduler'\}\)/);
  assert.match(cron,/startSeriesBatch\('PROC-SER-003',\{limit:50,triggerSource:'quality_scheduler'\}\)/);
  assert.match(cron,/startSeriesBatch\('PROC-SER-004',\{limit:50,triggerSource:'quality_scheduler'\}\)/);
  assert.match(cron,/startData002Batch\(\{limit:200,concurrency:2,triggerSource:'quality_scheduler'\}\)/);
  assert.match(cron,/startPeopleBatch\(\{limit:25,concurrency:2,triggerSource:'quality_scheduler'\}\)/);
  assert.match(cron,/processC6Batch\(200\)/);
  assert.doesNotMatch(cron,/syncPlexFastCore|syncPlexFast\(|scanPlexTechnicalLibrary|triggerTechnicalSnapshot/);
});

test('el sync Plex global manual encadena validación física, Series y captura técnica',()=>{
  const plex=read('lib/plex-sync.js');
  assert.match(plex,/syncPlexFastCore/);
  assert.match(plex,/startMov001Batch\(\{triggerSource:'plex_sync_continuation'\}\)/);
  assert.match(plex,/startSeriesBatch\('PROC-SER-002',\{triggerSource:'plex_sync_continuation'\}\)/);
  assert.match(plex,/triggerTechnicalSnapshot\(\{triggerSource:'plex_sync_continuation'\}\)/);
  assert.match(plex,/invalidateChangedSeries/);
});

test('Series aplica cadencia adaptativa TMDb y mantiene UNKNOWN como seguimiento automático',()=>{
  const domain=read('lib/series-quality-domain.mjs');
  assert.match(domain,/SER004_RECHECK_DAYS=14/);
  assert.match(domain,/ageYears<2\?180:ageYears<10\?365:1095/);
  assert.match(domain,/base\.getTime\(\)\+7\*DAY/);
  assert.match(domain,/base\.getTime\(\)\+30\*DAY/);
  assert.match(domain,/automatic:true/);
});

test('Personas usa cadencia adaptativa y el scheduler no resetea su historial',()=>{
  const quality=read('lib/people-quality.js'),batch=read('lib/people-batch.js');
  for(const source of [quality,batch]){
    assert.match(source,/deathday IS NOT NULL THEN 1095/);
    assert.match(source,/last_work_date>=CURRENT_DATE-INTERVAL '1 year' THEN 30/);
    assert.match(source,/last_work_date>=CURRENT_DATE-INTERVAL '3 years' THEN 90/);
    assert.match(source,/last_work_date>=CURRENT_DATE-INTERVAL '10 years' THEN 365/);
  }
  assert.match(batch,/filmography_refreshed_at<=now\(\)-\(d\.refresh_days\|\|' days'\)::interval/);
  assert.doesNotMatch(batch,/UPDATE person_refresh_state SET filmography_refreshed_at=NULL/);
});

test('ratings sólo recalculan PikoScore cuando cambian o el Lifecycle lo exige',()=>{
  const worker=read('worker/batch-api-worker.mjs');
  assert.match(worker,/beforeFingerprint=await ratingFingerprint/);
  assert.match(worker,/ratingsChanged=beforeFingerprint!==afterFingerprint/);
  assert.match(worker,/shouldRecalculate=cl\.lifecycle_state==='PIKOSCORE_PENDING'\|\|cl\.final_rating==null\|\|ratingsChanged/);
  assert.match(worker,/PikoScore conservado/);
});

test('reintentos Batch están espaciados y limitados',()=>{
  const runtime=read('lib/batch-worker-runtime.mjs');
  assert.match(runtime,/MAX_ATTEMPTS=3/);
  assert.match(runtime,/attempt_count=1 AND bi\.updated_at<=now\(\)-interval '6 hours'/);
  assert.match(runtime,/attempt_count>=2 AND bi\.updated_at<=now\(\)-interval '24 hours'/);
});

test('captura técnica recalcula PikoQuality sobre el fingerprint nuevo y termina al vaciar cola',()=>{
  const worker=read('worker/technical-snapshot-worker.mjs');
  assert.match(worker,/captureTechnicalRatingKey/);
  assert.match(worker,/scorePikoQualityRatingKeys\(sql,successful\)/);
  assert.match(worker,/pikoquality_recalculate/);
  assert.match(worker,/actualState:'completed'/);
  assert.match(worker,/queue_empty:true/);
});
