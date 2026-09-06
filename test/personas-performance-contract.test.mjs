import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard=fs.readFileSync('lib/people-dashboard.js','utf8');
const nav=fs.readFileSync('components/NoPrefetchLink.js','utf8');
const root=fs.readFileSync('app/layout.js','utf8');

test('Personas read path does not execute schema DDL',()=>{
  assert.doesNotMatch(dashboard,/ensurePeopleSchema|CREATE TABLE/i);
});

test('Personas aggregates external filmography only for the paged people set',()=>{
  assert.match(dashboard,/paged AS/);
  assert.match(dashboard,/LIMIT \$\{pageSize\} OFFSET \$\{offset\}/);
  assert.match(dashboard,/WHERE f\.tmdb_person_id=ANY/);
  assert.doesNotMatch(dashboard,/fullstats AS/);
});

test('Personas derives collection metrics from canonical catalog joins',()=>{
  assert.match(dashboard,/JOIN movie_credits mc/);
  assert.match(dashboard,/JOIN catalog_read_model c/);
  assert.match(dashboard,/count\(\*\) OVER\(\)::int total_count/);
});

test('PikoFilm tells cooperative crawlers not to traverse internal navigation',()=>{
  assert.match(nav,/nofollow/);
  assert.match(nav,/prefetch=\{false\}/);
  assert.match(root,/robots:\{index:false,follow:false,nocache:true\}/);
});
