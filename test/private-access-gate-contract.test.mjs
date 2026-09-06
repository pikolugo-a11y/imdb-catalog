import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const middleware=fs.readFileSync('middleware.js','utf8');

test('PikoFilm requires a private access cookie before application routes execute',()=>{
  assert.match(middleware,/ACCESS_COOKIE='pikofilm_private'/);
  assert.match(middleware,/ACCESS_HASH='[a-f0-9]{64}'/);
  assert.match(middleware,/crypto\.subtle\.digest\('SHA-256'/);
  assert.match(middleware,/response\.cookies\.set\(ACCESS_COOKIE/);
  assert.match(middleware,/httpOnly:true/);
  assert.match(middleware,/sameSite:'strict'/);
  assert.match(middleware,/return notFound\(\)/);
});

test('malformed dynamic null routes are rejected before page execution',()=>{
  assert.match(middleware,/pathname\.endsWith\('\/null'\)/);
  assert.match(middleware,/pathname\.endsWith\('\/undefined'\)/);
});

test('only the canonical daily cron bypasses private browser access',()=>{
  assert.match(middleware,/pathname==='\/api\/cron\/dashboard-snapshot'/);
  assert.doesNotMatch(middleware,/pathname\.startsWith\('\/api\/'\)/);
});
