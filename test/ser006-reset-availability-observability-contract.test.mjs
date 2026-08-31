import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const actions=fs.readFileSync('app/calidad/series/actions.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('SER-006 usa observabilidad común y no anida SER-003',()=>{
  assert.match(actions,/processCode:'PROC-SER-006'/);
  assert.match(actions,/entityType:'season'/);
  assert.match(actions,/eventType:'manual_decision'/);
  assert.match(actions,/refreshSeriesUnitaryCore\(\{ratingKey,trace\}\)/);
  assert.doesNotMatch(actions,/resetSeasonAvailabilityAction[\s\S]*?refreshSeriesUnitary\(\{ratingKey\}\)/);
});

test('SER-006 conserva la capacidad manual y vuelve a fuente automática',()=>{
  assert.match(actions,/manual_override=false,status='UNKNOWN',source='manual_reset'/);
  assert.match(actions,/functionalResult:'reset_to_automatic'/);
  assert.match(actions,/rebuildSeriesQualityReadModel\(sql\)/);
});

test('SER-006 tiene nombre humano en Operaciones',()=>{
  assert.match(display,/'PROC-SER-006':\{name:'Volver disponibilidad de temporada a automático'\}/);
});
