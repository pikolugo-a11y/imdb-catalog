import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlexTimeoutError,isPlexTimeoutError,fetchPlexJsonWithRetry} from '../lib/plex-request-error.mjs';

test('normaliza un timeout Plex sin mutar el error original aunque message sea de solo lectura',()=>{
  const original={name:'TimeoutError',code:23};
  Object.defineProperty(original,'message',{get:()=> 'The operation timed out',enumerable:true,configurable:false});
  Object.preventExtensions(original);

  assert.equal(isPlexTimeoutError(original),true);
  const normalized=createPlexTimeoutError(original,{path:'/library/sections',attempt:2});

  assert.equal(normalized.name,'PlexTimeoutError');
  assert.equal(normalized.message,'Plex no respondió a tiempo en /library/sections tras 3 intentos');
  assert.equal(normalized.source,'plex');
  assert.equal(normalized.retryable,true);
  assert.equal(normalized.plexPath,'/library/sections');
  assert.equal(normalized.attempts,3);
  assert.equal(normalized.code,23);
  assert.equal(normalized.cause,original);
  assert.equal(original.message,'The operation timed out');
  assert.equal(Object.isExtensible(original),false);
});

test('reconoce AbortError como timeout y conserva una causa inmutable',()=>{
  const original=new DOMException('aborted','AbortError');
  const normalized=createPlexTimeoutError(original,{path:'/library/metadata/1',attempt:0});

  assert.equal(isPlexTimeoutError(original),true);
  assert.equal(normalized.message,'Plex no respondió a tiempo en /library/metadata/1 tras 1 intento');
  assert.equal(normalized.cause,original);
  assert.equal(normalized.retryable,true);
});


test('reintenta un timeout Plex y devuelve la respuesta del siguiente intento',async()=>{
  let calls=0,externalCalls=0,heartbeats=0,warnings=0;
  const seenTimeouts=[];
  const trace={
    externalCall:()=>{externalCalls++},
    heartbeat:async()=>{heartbeats++},
    event:async event=>{if(event.eventType==='step_warning')warnings++}
  };
  const body=await fetchPlexJsonWithRetry({
    url:'https://plex.example/library/sections/4/all',
    path:'/library/sections/4/all',
    headers:{},
    trace,
    timeouts:[45000,60000,90000],
    signalFactory:ms=>{seenTimeouts.push(ms);return{}},
    sleepImpl:async()=>{},
    fetchImpl:async()=>{
      calls++;
      if(calls===1)throw new DOMException('timed out','TimeoutError');
      return{ok:true,status:200,json:async()=>({ok:true})};
    }
  });

  assert.deepEqual(body,{ok:true});
  assert.equal(calls,2);
  assert.equal(externalCalls,2);
  assert.equal(heartbeats,1);
  assert.equal(warnings,1);
  assert.deepEqual(seenTimeouts,[45000,60000]);
});

test('tras agotar los reintentos conserva timeout Plex como fallo retryable',async()=>{
  let calls=0,heartbeats=0;
  await assert.rejects(
    fetchPlexJsonWithRetry({
      url:'https://plex.example/library/sections/4/all',
      path:'/library/sections/4/all',
      headers:{},
      timeouts:[10,20,30],
      signalFactory:()=>({}),
      sleepImpl:async()=>{},
      trace:{externalCall:()=>{},heartbeat:async()=>{heartbeats++},event:async()=>{}},
      fetchImpl:async()=>{calls++;throw new DOMException('timed out','TimeoutError')}
    }),
    error=>{
      assert.equal(error.name,'PlexTimeoutError');
      assert.equal(error.retryable,true);
      assert.equal(error.attempts,3);
      assert.match(error.message,/tras 3 intentos/);
      return true;
    }
  );
  assert.equal(calls,3);
  assert.equal(heartbeats,2);
});

test('un error HTTP no retryable no consume intentos adicionales',async()=>{
  let calls=0;
  await assert.rejects(
    fetchPlexJsonWithRetry({
      url:'https://plex.example/library/metadata/404',
      path:'/library/metadata/404',
      headers:{},
      timeouts:[10,20,30],
      signalFactory:()=>({}),
      sleepImpl:async()=>{},
      fetchImpl:async()=>{calls++;return{ok:false,status:404,json:async()=>({})}}
    }),
    error=>error?.status===404&&error?.retryable===false
  );
  assert.equal(calls,1);
});
