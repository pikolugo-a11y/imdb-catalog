import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildQualityHome,QUALITY_STATE_STAGE} from '../lib/quality-home-domain.mjs';

const baseCounts={COMPLETE:90,EXCLUDED:10};

function snap(extra={}){
  return{total:100,materialized:100,missing:0,counts:{...baseCounts,...(extra.counts||{})},integrity:{orphaned:0,unknown:0,incompatible:0,...(extra.integrity||{})},...extra};
}

test('estado sano mantiene Recuperación visible con cero',()=>{
  const home=buildQualityHome(snap());
  assert.equal(home.globalStatus.key,'healthy');
  assert.equal(home.progressPct,100);
  assert.equal(home.stages.find(s=>s.id==='recovery').count,0);
  assert.equal(home.stages.find(s=>s.id==='recovery').status.key,'healthy');
});

test('backlog normal no se convierte en incidencia',()=>{
  const home=buildQualityHome(snap({counts:{COMPLETE:70,EXCLUDED:10,IDENTITY_PENDING:20}}));
  assert.equal(home.globalStatus.key,'pending');
  assert.equal(home.priorityItems.length,0);
  assert.equal(home.stages.find(s=>s.id==='identity').status.key,'pending');
});

test('revisiones reales aparecen como atención prioritaria',()=>{
  const home=buildQualityHome(snap({counts:{COMPLETE:85,EXCLUDED:10,MOVIE_FILE_REVIEW:5}}));
  assert.equal(home.globalStatus.key,'attention');
  assert.equal(home.priorityItems.some(i=>i.id==='movies'),true);
});

test('faltantes e incoherencias bloquean el dashboard',()=>{
  const home=buildQualityHome(snap({materialized:98,missing:2,integrity:{orphaned:1}}));
  assert.equal(home.globalStatus.key,'blocked');
  assert.equal(home.stages.find(s=>s.id==='recovery').status.key,'blocked');
  assert.equal(home.priorityItems.some(i=>i.id==='integrity'),true);
});

test('todos los estados canónicos de lifecycle están clasificados por Calidad',()=>{
  const source=fs.readFileSync(new URL('../lib/lifecycle.js',import.meta.url),'utf8');
  const match=source.match(/export const LIFECYCLE=\{([\s\S]*?)\};\nexport function classifyLifecycle/);
  assert.ok(match,'No se pudo localizar LIFECYCLE en lib/lifecycle.js');
  const states=[...match[1].matchAll(/([A-Z][A-Z0-9_]+):\{/g)].map(m=>m[1]).sort();
  assert.deepEqual(states,Object.keys(QUALITY_STATE_STAGE).sort());
});

test('estados de película y serie no comparten rama física',()=>{
  assert.equal(QUALITY_STATE_STAGE.MOVIE_FILE_PENDING,'movies');
  assert.equal(QUALITY_STATE_STAGE.MOVIE_FILE_REVIEW,'movies');
  assert.equal(QUALITY_STATE_STAGE.SERIES_SYNC_PENDING,'series');
  assert.equal(QUALITY_STATE_STAGE.SERIES_REVIEW,'series');
});
