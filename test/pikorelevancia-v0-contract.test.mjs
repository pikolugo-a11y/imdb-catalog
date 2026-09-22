import test from 'node:test';
import assert from 'node:assert/strict';
import {scorePikoRelevanceV0,PIKORELEVANCE_VERSION,parseRetryAfterMs,retryDelayMs,sleepWithHeartbeat,GDELT_MIN_INTERVAL_MS,GDELT_RETRY_BASE_MS} from '../lib/pikorelevance-core.mjs';

const strong={
  internal:{final_rating:8.8,imdb_rating:8.6,imdb_votes:80000},
  omdb:{status:'ok'},
  tmdb:{status:'ok',es:{any:true,streaming:true,providers:['Netflix']},provider_countries:30,popularity:70,series_status:'Returning Series',first_air_date:'2025-01-01',origin_country:['ES'],original_language:'es',spanish_translation:true},
  watchmode:{status:'ok',any:true,streaming:true,providers:['Netflix']},
  wikimedia:{status:'ok',eswiki:true,title:'Serie',pageviews_status:'ok',pageviews_90d:50000},
  gdelt:{status:'ok',mentions:12,unique_domains:7,domains:['example.es']},
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
    gdelt:{status:'ok',mentions:0,unique_domains:0,domains:[]},
  };
  assert.ok(scorePikoRelevanceV0(strong).score>scorePikoRelevanceV0(weak).score);
});

test('provider failure lowers confidence instead of pretending Spain=NO',()=>{
  const partial={
    ...strong,
    watchmode:{status:'error',reason:'timeout'},
    gdelt:{status:'error',reason:'timeout'},
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
    gdelt:{status:'error'},
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


test('GDELT policy keeps conservative spacing after observed 429 throttling',()=>{
  assert.ok(GDELT_MIN_INTERVAL_MS>=15000);
  assert.ok(GDELT_RETRY_BASE_MS>=30000);
});
