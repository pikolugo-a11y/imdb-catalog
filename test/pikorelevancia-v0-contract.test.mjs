import test from 'node:test';
import assert from 'node:assert/strict';
import {scorePikoRelevanceV0,PIKORELEVANCE_VERSION,parseRetryAfterMs,retryDelayMs,sleepWithHeartbeat,awaitWithHeartbeat,MEDIACLOUD_MIN_INTERVAL_MS,MEDIACLOUD_ES_COLLECTION_ID,buildMediaCloudQuery,parseMediaCloudCount} from '../lib/pikorelevance-core.mjs';

const strong={
  internal:{final_rating:8.8,imdb_rating:8.6,imdb_votes:80000},
  omdb:{status:'ok'},
  tmdb:{status:'ok',es:{any:true,streaming:true,providers:['Netflix']},provider_countries:30,popularity:70,series_status:'Returning Series',first_air_date:'2025-01-01',origin_country:['ES'],original_language:'es',spanish_translation:true},
  watchmode:{status:'ok',any:true,streaming:true,providers:['Netflix']},
  wikimedia:{status:'ok',eswiki:true,title:'Serie',pageviews_status:'ok',pageviews_90d:50000},
  mediacloud:{status:'ok',mentions:12,collection_id:'34412356',query:'"Serie" AND serie AND language:es'},
};

test('PikoRelevancia v0 stays deterministic and bounded',()=>{
  const a=scorePikoRelevanceV0(strong),b=scorePikoRelevanceV0(strong);
  assert.equal(a.version,PIKORELEVANCE_VERSION);
  assert.deepEqual(a,b);
  assert.ok(a.score>=0&&a.score<=100);
  assert.equal(a.confidence,100);
  assert.equal(a.recommendation,'muy_alta');
});

test('Spain footprint increases relevance without changing PikoScore',()=>{
  const weak={
    ...strong,
    tmdb:{...strong.tmdb,es:{any:false,streaming:false,providers:[]},provider_countries:3,popularity:8,origin_country:['US'],original_language:'en',spanish_translation:false,series_status:'Ended',first_air_date:'2013-01-01'},
    watchmode:{status:'ok',any:false,streaming:false,providers:[]},
    wikimedia:{status:'ok',eswiki:false,pageviews_90d:0},
    mediacloud:{status:'ok',mentions:0,collection_id:'34412356'},
  };
  assert.ok(scorePikoRelevanceV0(strong).score>scorePikoRelevanceV0(weak).score);
});

test('provider failure lowers confidence instead of pretending Spain=NO',()=>{
  const partial={
    ...strong,
    watchmode:{status:'error',reason:'timeout'},
    mediacloud:{status:'error',reason:'timeout'},
  };
  const result=scorePikoRelevanceV0(partial);
  assert.ok(result.confidence<100);
  const wm=result.factors.find(x=>x.key==='watchmode_es');
  assert.equal(wm.available,false);
  assert.equal(wm.points,null);
});

test('low evidence returns datos_insuficientes even with a high partial score',()=>{
  const input={
    internal:{final_rating:9.2},
    omdb:{status:'unavailable'},
    tmdb:{status:'error'},
    watchmode:{status:'error'},
    wikimedia:{status:'error'},
    mediacloud:{status:'error'},
  };
  const result=scorePikoRelevanceV0(input);
  assert.equal(result.recommendation,'datos_insuficientes');
  assert.ok(result.confidence<60);
});


test('source retry policy respects Retry-After and exponential backoff',()=>{
  assert.equal(parseRetryAfterMs('5',{now:0}),5000);
  assert.equal(parseRetryAfterMs('invalid',{now:0}),null);
  assert.equal(retryDelayMs({attempt:0,baseBackoffMs:5000,maxBackoffMs:120000}),5000);
  assert.equal(retryDelayMs({attempt:1,baseBackoffMs:5000,maxBackoffMs:120000}),10000);
  assert.equal(retryDelayMs({attempt:0,retryAfter:'30',baseBackoffMs:5000,maxBackoffMs:120000}),30000);
});


test('long retry waits heartbeat often enough to preserve a 120s lease',async()=>{
  const chunks=[];
  let heartbeats=0;
  await sleepWithHeartbeat(25000,{heartbeat:async()=>{heartbeats++}},async ms=>{chunks.push(ms)});
  assert.deepEqual(chunks,[10000,10000,5000]);
  assert.equal(heartbeats,3);
});


test('Media Cloud policy respects its public API pacing and Spain collection',()=>{
  assert.ok(MEDIACLOUD_MIN_INTERVAL_MS>=30000);
  assert.equal(MEDIACLOUD_ES_COLLECTION_ID,'34412356');
  assert.equal(buildMediaCloudQuery('Hora de aventuras','Adventure Time'),'("Hora de aventuras" OR "Adventure Time") AND serie AND language:es');
  assert.equal(buildMediaCloudQuery('Élite','Élite'),'"Élite" AND serie AND language:es');
});


test('waiting for the Media Cloud queue also keeps the Batch lease alive',async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve});
  const sleeps=[];
  let heartbeats=0;
  const value=await awaitWithHeartbeat(
    gate,
    {heartbeat:async()=>{heartbeats++}},
    async ms=>{sleeps.push(ms);if(sleeps.length===2)release('ready')},
    1000
  );
  assert.equal(value,'ready');
  assert.ok(heartbeats>=1);
});


test('legacy gdelt weight is ignored after Media Cloud migration',()=>{
  const result=scorePikoRelevanceV0(strong,{weights:{gdelt_es:99}});
  assert.equal(result.total_weight,100);
  assert.ok(result.factors.some(x=>x.key==='mediacloud_es'));
  assert.ok(!result.factors.some(x=>x.key==='gdelt_es'));
});


test('Media Cloud count parser uses relevant matches and preserves total corpus',()=>{
  assert.deepEqual(parseMediaCloudCount({count:{relevant:12,total:3456}}),{relevant:12,total:3456});
  assert.deepEqual(parseMediaCloudCount({count:7}),{relevant:7,total:null});
  assert.equal(parseMediaCloudCount({count:{relevant:'bad',total:3}}),null);
});
