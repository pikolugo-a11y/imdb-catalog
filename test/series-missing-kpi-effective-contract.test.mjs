import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const query=fs.readFileSync('lib/series-quality-query.js','utf8');
const page=fs.readFileSync('app/calidad/series/page.js','utf8');

test('Calidad Series separa ausencia física de faltante funcional',()=>{
  assert.match(query,/episode_missing_physical_total/);
  assert.match(query,/plex_diagnostic_status='missing'\)\:\:int episode_missing_physical_total/);
  assert.match(query,/plex_diagnostic_status='missing' AND e\.effective_status<>'present'\)\:\:int episode_missing_total/);
  assert.match(query,/physicalMissing\+=n\(r\.episode_missing_physical_total\)/);
});

test('el KPI y filtro de faltantes excluyen decisiones manuales resueltas',()=>{
  assert.match(page,/Faltan sin excluir/);
  assert.match(page,/ausentes en Plex y todavía relevantes para PikoFilm/);
  assert.match(page,/ausentes físicamente/);
  assert.match(page,/sin excluir/);
  assert.doesNotMatch(page,/\['missing','Faltan en Plex'/);
});
