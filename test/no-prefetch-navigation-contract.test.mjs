import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const primitive=fs.readFileSync('components/NoPrefetchLink.js','utf8');
const nav=fs.readFileSync('components/Nav.js','utf8');
const catalog=fs.readFileSync('app/catalogo/page.js','utf8');

test('PikoFilm navigation primitive disables speculative Next.js prefetch',()=>{
  assert.match(primitive,/prefetch=\{false\}/);
});

test('persistent Shell never prefetches its dynamic destinations',()=>{
  const links=[...nav.matchAll(/<Link\b([^>]*)>/g)];
  assert.ok(links.length>0);
  for(const link of links)assert.match(link[1],/prefetch=\{false\}/);
});

test('Catalog V4 uses no-prefetch navigation for high-fanout title lists',()=>{
  assert.match(catalog,/import Link from '@\/components\/NoPrefetchLink'/);
  assert.doesNotMatch(catalog,/import Link from 'next\/link'/);
});
