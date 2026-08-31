import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const layout=await readFile(new URL('../app/admin/batch/layout.js',import.meta.url),'utf8');

test('legacy Batch UI always redirects to canonical Operations',()=>{
  assert.match(layout,/from 'next\/navigation'/);
  assert.match(layout,/redirect\('\/admin'\)/);
  assert.doesNotMatch(layout,/batch-subnav|getBatchControlOverview|children/);
});
