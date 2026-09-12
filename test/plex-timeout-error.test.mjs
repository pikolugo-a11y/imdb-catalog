import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlexTimeoutError,isPlexTimeoutError} from '../lib/plex-request-error.mjs';

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
