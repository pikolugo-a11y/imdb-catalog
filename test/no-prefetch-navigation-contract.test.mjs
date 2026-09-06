import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const primitive=fs.readFileSync('components/NoPrefetchLink.js','utf8');
const nav=fs.readFileSync('components/Nav.js','utf8');
const catalog=fs.readFileSync('app/catalogo/page.js','utf8');

function sourceFiles(root){
  const out=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const full=path.join(root,entry.name);
    if(entry.isDirectory())out.push(...sourceFiles(full));
    else if(/\.(?:js|jsx|ts|tsx|mjs)$/.test(entry.name))out.push(full);
  }
  return out;
}

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

// Global guardrail: no application screen may bypass the shared navigation primitive.
test('all PikoFilm application navigation goes through NoPrefetchLink',()=>{
  const offenders=[];
  for(const file of [...sourceFiles('app'),...sourceFiles('components')]){
    if(file==='components/NoPrefetchLink.js')continue;
    const src=fs.readFileSync(file,'utf8');
    if(/from\s+['\"]next\/link['\"]/.test(src))offenders.push(file);
  }
  assert.deepEqual(offenders,[],`Direct next/link imports still present:\n${offenders.join('\n')}`);
});
