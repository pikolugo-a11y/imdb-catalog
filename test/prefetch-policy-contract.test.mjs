import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav=fs.readFileSync('components/Nav.js','utf8');
const catalog=fs.readFileSync('app/catalogo/page.js','utf8');
const people=fs.readFileSync('app/personas/page.js','utf8');

test('Shell disables speculative prefetch',()=>{
  assert.match(nav,/prefetch=\{false\}/);
});

test('Catalog uses no-prefetch links for high fan-out navigation',()=>{
  assert.match(catalog,/NoPrefetchLink/);
});

test('People list disables prefetch to person detail pages',()=>{
  assert.match(people,/NoPrefetchLink/);
});
