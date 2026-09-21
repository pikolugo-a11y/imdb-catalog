import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateSeriesExtraOverride} from '../lib/series-extra-override.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const actions=read('../app/calidad/series/actions.js');
const query=read('../lib/series-detail-query.js');
const page=read('../app/calidad/series/[ratingKey]/page.js');
const display=read('../lib/process-display.js');

test('SER-005 es una decisión manual observada por episodio',()=>{assert.match(actions,/processCode:'PROC-SER-005'/);assert.match(actions,/eventType:'manual_decision'/);assert.match(actions,/entityType:'episode'/);assert.match(actions,/calidad_series_manual/)});
test('la aceptación se liga a la identidad Plex estable y no caduca por cambios de metadata',()=>{
  assert.match(actions,/plex_rating_key:String\(p\.rating_key\)/);
  assert.match(actions,/plex_fingerprint:String\(p\.fingerprint/);
  assert.match(query,/override_evidence_changed/);
  const note=JSON.stringify({ser005:1,plex_rating_key:'11976',plex_fingerprint:'old'});
  assert.deepEqual(evaluateSeriesExtraOverride({decision:'not_needed',note,ratingKey:'11976',fingerprint:'new'}),{
    current:true,stale:false,evidenceChanged:true,note:null,
    evidence:{ser005:1,plex_rating_key:'11976',plex_fingerprint:'old'}
  });
  assert.equal(evaluateSeriesExtraOverride({decision:'not_needed',note,ratingKey:'99999',fingerprint:'new'}).stale,true);
});
test('si la referencia TMDb ya contiene el episodio no se puede aceptar como extra',()=>{assert.match(actions,/LEFT JOIN series_reference_episodes/);assert.match(actions,/r\.show_rating_key IS NULL/)});
test('el frontal separa pendientes y decisiones manuales en paneles bajo demanda y permite reabrir',()=>{assert.match(page,/Pendientes de decisión/);assert.match(page,/Decisiones manuales/);assert.match(page,/panel:'pending'/);assert.match(page,/panel:'manual'/);assert.match(page,/decision="reopen"/);assert.match(page,/La decisión anterior caducó/);assert.match(page,/sólo se cargan al abrir esta ventana/);assert.match(query,/getSeriesAnomalyPanel/);assert.match(query,/SERIES_ANOMALY_PAGE_SIZE=50/)});
test('Operaciones muestra nombre humano SER-005',()=>{assert.match(display,/'PROC-SER-005':\{name:'Revisar episodio extra \/ anómalo'\}/)});
