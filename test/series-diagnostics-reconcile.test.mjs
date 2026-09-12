import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileReciprocalEpisodeNumbering} from '../lib/series-diagnostics-reconcile.mjs';
import {buildUniqueExactTitleReservations} from '../lib/series-diagnostics-core.mjs';

const baseRow=(episode,overrides={})=>({
  show_rating_key:'94763',season_number:3,episode_number:episode,status:'missing',confidence:'medium',reason:'No se encontró correspondencia en Plex',covered_by_rating_key:null,expected_name:null,expected_runtime_minutes:22,actual_duration_minutes:null,search_hint:null,fingerprint:null,...overrides
});
const plexRow=(episode,ratingKey,title,overrides={})=>({rating_key:String(ratingKey),season_number:3,episode_number:episode,plex_title:title,actual_duration_minutes:22,fingerprint:`fp-${ratingKey}`,...overrides});

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

test('no trata una temporada reordenada como varios swaps recíprocos aislados',()=>{
  const rows=[
    baseRow(1,{status:'present',covered_by_rating_key:'9832',expected_name:'Perro callejero'}),
    baseRow(2,{expected_name:'Faye Valentine'}),
    baseRow(9,{status:'present',covered_by_rating_key:'9842',expected_name:'Júpiter Jazz (2)'}),
    baseRow(12,{expected_name:'Habla como un niño'})
  ];
  const plex=[plexRow(1,9831,'Canción triste para un asteroide'),plexRow(2,9832,'Strut perro callejero'),plexRow(9,9839,'Interferencias de Edo'),plexRow(12,9842,'Jupiter Jazz, Parte 1')];
  const result=reconcileReciprocalEpisodeNumbering({rows,plex,used:new Set(['9832','9842'])});
  assert.equal(result.reconciled,0);
  assert.equal(result.rows.filter(row=>row.status==='missing').length,2);
});

test('reserva antes del fallback numérico una coincidencia exacta única con duración compatible',()=>{
  const refs=[
    {season_number:1,episode_number:1,name:'Primero',runtime_minutes:22},
    {season_number:1,episode_number:2,name:'Segundo',runtime_minutes:22}
  ];
  const plex=[
    plexRow(1,100,'Segundo',{season_number:1,actual_duration_minutes:21.5}),
    plexRow(2,101,'Primero',{season_number:1,actual_duration_minutes:22.3})
  ];
  const reservations=buildUniqueExactTitleReservations({refs,plex});
  assert.equal(reservations.get('1-1')?.rating_key,'101');
  assert.equal(reservations.get('1-2')?.rating_key,'100');
});

test('no reserva por título un archivo con duración de capítulo doble',()=>{
  const refs=[{season_number:1,episode_number:24,name:'Y el baile de Martha Stewart (Parte 2)',runtime_minutes:22}];
  const plex=[plexRow(23,73911,'Y El Baile de Martha Stewart - Parte 2',{season_number:1,actual_duration_minutes:41.3})];
  const reservations=buildUniqueExactTitleReservations({refs,plex});
  assert.equal(reservations.size,0);
});
