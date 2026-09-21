import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverPlexUrlCore} from '../lib/plex-sync-core.mjs';

const resourcesXml=`<MediaContainer>
  <Device name="Plex" provides="server">
    <Connection protocol="https" address="direct.example" port="32400" uri="https://direct.example:32400" local="0" relay="0"/>
    <Connection protocol="https" address="relay.example" port="443" uri="https://relay.example" local="0" relay="1"/>
  </Device>
</MediaContainer>`;

test('discoverPlexUrlCore prueba la directa y cae al relay si Railway no puede alcanzarla',async()=>{
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(String(url));
    if(String(url).startsWith('https://plex.tv/'))return{ok:true,status:200,text:async()=>resourcesXml};
    if(String(url)==='https://direct.example:32400/library/sections')throw new TypeError('fetch failed');
    if(String(url)==='https://relay.example/library/sections')return{ok:true,status:200};
    throw new Error(`URL inesperada: ${url}`);
  };
  const base=await discoverPlexUrlCore('token','',{
    fetchImpl,
    signalFactory:()=>({}),
    discoveryTimeoutMs:10,
    probeTimeoutMs:10
  });
  assert.equal(base,'https://relay.example');
  assert.deepEqual(calls,[
    'https://plex.tv/api/resources?includeHttps=1',
    'https://direct.example:32400/library/sections',
    'https://relay.example/library/sections'
  ]);
});

test('discoverPlexUrlCore respeta PLEX_URL configurada sin consultar plex.tv',async()=>{
  let calls=0;
  const base=await discoverPlexUrlCore('token','https://fixed.example/',{
    fetchImpl:async()=>{calls++;throw new Error('no debería llamarse')}
  });
  assert.equal(base,'https://fixed.example');
  assert.equal(calls,0);
});

test('si ninguna conexión publicada responde, devuelve un fallo Plex retryable y observable',async()=>{
  const fetchImpl=async url=>{
    if(String(url).startsWith('https://plex.tv/'))return{ok:true,status:200,text:async()=>resourcesXml};
    throw new TypeError('fetch failed');
  };
  await assert.rejects(
    discoverPlexUrlCore('token','',{fetchImpl,signalFactory:()=>({}),discoveryTimeoutMs:10,probeTimeoutMs:10}),
    error=>{
      assert.equal(error.source,'plex');
      assert.equal(error.retryable,true);
      assert.equal(error.processStep,'plex_connection_probe');
      assert.equal(error.attemptedConnections,2);
      assert.match(error.message,/ninguna respondió desde Railway/);
      return true;
    }
  );
});
