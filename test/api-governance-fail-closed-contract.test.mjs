import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requireApiGate} from '../lib/batch-api-governance.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('missing api gate fails closed with an observable governance reason',()=>{
  assert.throws(
    ()=>requireApiGate(null,'tmdb'),
    error=>error?.apiGateReason==='missing_gate'&&error?.processStep==='api_governance'&&error?.permanent===true&&error?.retryable===false
  );
});

test('canonical governed-source cores enforce requireApiGate before external fetches',async()=>{
  const files=[
    'lib/id001-canonical.mjs',
    'lib/data001-canonical.mjs',
    'lib/ratings-refresh-core.mjs',
    'lib/series-unitary-core.mjs',
    'lib/series-es-availability-core.mjs',
    'lib/people-refresh-core.mjs',
    'lib/saga-refresh-core.mjs'
  ];
  for(const file of files){
    const source=await read(file);
    assert.match(source,/requireApiGate/ ,`${file} debe exigir gobernanza`);
  }
});

test('manual source-consuming wrappers inject the canonical API gate',async()=>{
  const expected={
    'lib/identity-unitary.js':'createApiGate(sql)',
    'lib/data-quality-unitary.js':'createApiGate(sql)',
    'lib/ratings-refresh.js':'createApiGate(sql)',
    'lib/series-unitary.js':'createApiGate(sql)',
    'lib/series-es-availability.js':'createApiGate(sql)',
    'lib/people-v2.js':'createApiGate(sql)',
    'lib/saga-unitary.js':'createApiGate(sql)'
  };
  for(const [file,needle] of Object.entries(expected)){
    const source=await read(file);
    assert.ok(source.includes(needle),`${file} debe inyectar ${needle}`);
  }
});

test('legacy enrichment governs every TMDb request and never turns throttling into media-type fallback',async()=>{
  const enrich=await read('lib/enrich-title.js');
  assert.match(enrich,/createApiGate\(sql\)/);
  assert.match(enrich,/governedTmdbJson\(apiGate,/);
  assert.match(enrich,/if\(Number\(error\?\.status\)!==404\)throw error/);
  assert.doesNotMatch(enrich,/await fetchJson\(`https:\/\/api\.themoviedb\.org/);
});

test('people detail lookup never swallows governance or rate-limit failures',async()=>{
  const people=await read('lib/people-refresh-core.mjs');
  assert.match(people,/if\(error\?\.apiGateReason\|\|error\?\.processStep==='api_governance'\|\|Number\(error\?\.status\)===429\)throw error/);
});

test('saga UI no longer uses the legacy ungoverned unit refresher',async()=>{
  const sagaAction=await read('app/sagas/refresh-actions.js');
  assert.match(sagaAction,/refreshSagaCollectionUnitary/);
  assert.doesNotMatch(sagaAction,/sagas-v2/);
});
