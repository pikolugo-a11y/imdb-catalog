import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileReciprocalEpisodeNumbering} from '../lib/series-diagnostics-reconcile.mjs';

const baseRow=(episode,overrides={})=>({
  show_rating_key:'94763',season_number:3,episode_number:episode,status:'missing',confidence:'medium',reason:'No se encontró correspondencia en Plex',covered_by_rating_key:null,expected_name:null,expected_runtime_minutes:22,actual_duration_minutes:null,search_hint:null,fingerprint:null,...overrides
});
const plexRow=(episode,ratingKey,title)=>({rating_key:String(ratingKey),season_number:3,episode_number:episode,plex_title:title,actual_duration_minutes:22,fingerprint:`fp-${ratingKey}`});

test('The Middle: cierra el intercambio E10/E11 sin inventar ausencia física',()=>{
  const rows=[
    baseRow(10,{status:'present',confidence:'confirmed',covered_by_rating_key:'94901',expected_name:'Día de acción de gracias III'}),
    baseRow(11,{expected_name:'Un regalo de Navidad'})
  ];
  const plex=[plexRow(10,94900,'A Christmas Gift'),plexRow(11,94901,'Día de acción de gracias III')];
  const result=reconcileReciprocalEpisodeNumbering({rows,plex,used:new Set(['94901'])});
  const episode11=result.rows.find(row=>row.episode_number===11);
  assert.equal(result.reconciled,1);
  assert.equal(episode11.status,'present');
  assert.equal(episode11.covered_by_rating_key,'94900');
  assert.equal(episode11.confidence,'high');
  assert.match(episode11.reason,/reconciliación recíproca de numeración/i);
  assert.equal(result.used.has('94900'),true);
});

test('no rellena un faltante si no existe el desplazamiento recíproco',()=>{
  const rows=[baseRow(10,{status:'present',covered_by_rating_key:'94900'}),baseRow(11)];
  const plex=[plexRow(10,94900,'E10'),plexRow(12,94902,'E12')];
  const result=reconcileReciprocalEpisodeNumbering({rows,plex,used:new Set(['94900'])});
  assert.equal(result.reconciled,0);
  assert.equal(result.rows.find(row=>row.episode_number===11).status,'missing');
});

test('no aplica reconciliación automática en temporadas con cobertura combinada',()=>{
  const rows=[
    baseRow(9,{status:'covered_combined',covered_by_rating_key:'94899'}),
    baseRow(10,{status:'present',covered_by_rating_key:'94901'}),
    baseRow(11)
  ];
  const plex=[plexRow(9,94899,'Doble'),plexRow(10,94900,'E10'),plexRow(11,94901,'E11')];
  const result=reconcileReciprocalEpisodeNumbering({rows,plex,used:new Set(['94899','94901'])});
  assert.equal(result.reconciled,0);
  assert.equal(result.rows.find(row=>row.episode_number===11).status,'missing');
});

test('no reconcilia cuando hay números Plex duplicados y la evidencia estructural no es única',()=>{
  const rows=[baseRow(10,{status:'present',covered_by_rating_key:'94901'}),baseRow(11)];
  const plex=[plexRow(10,94900,'E10-A'),plexRow(10,94902,'E10-B'),plexRow(11,94901,'E11')];
  const result=reconcileReciprocalEpisodeNumbering({rows,plex,used:new Set(['94901'])});
  assert.equal(result.reconciled,0);
});
