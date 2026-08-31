import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const actions=read('../app/calidad/series/actions.js');
const query=read('../lib/series-detail-query.js');
const page=read('../app/calidad/series/[ratingKey]/page.js');
const display=read('../lib/process-display.js');

test('SER-005 es una decisión manual observada por episodio',()=>{assert.match(actions,/processCode:'PROC-SER-005'/);assert.match(actions,/eventType:'manual_decision'/);assert.match(actions,/entityType:'episode'/);assert.match(actions,/calidad_series_manual/)});
test('la aceptación se liga a rating key y fingerprint Plex vigentes',()=>{assert.match(actions,/plex_rating_key:String\(p\.rating_key\)/);assert.match(actions,/plex_fingerprint:String\(p\.fingerprint/);assert.match(query,/override_current/);assert.match(query,/override_stale/);assert.match(query,/String\(ev\.plex_fingerprint/)});
test('si la referencia TMDb ya contiene el episodio no se puede aceptar como extra',()=>{assert.match(actions,/LEFT JOIN series_reference_episodes/);assert.match(actions,/r\.show_rating_key IS NULL/)});
test('el frontal separa pendientes, resueltas y permite reabrir',()=>{assert.match(page,/Pendientes de decisión/);assert.match(page,/Decisiones manuales vigentes/);assert.match(page,/decision="reopen"/);assert.match(page,/La decisión anterior ha caducado/)});
test('Operaciones muestra nombre humano SER-005',()=>{assert.match(display,/'PROC-SER-005':\{name:'Revisar episodio extra \/ anómalo'\}/)});
