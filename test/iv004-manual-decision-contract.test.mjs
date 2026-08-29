import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const actions=fs.readFileSync(new URL('../app/calidad/validacion-identidad/manual-actions.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/calidad/validacion-identidad/page.js',import.meta.url),'utf8');
const display=fs.readFileSync(new URL('../lib/process-display.js',import.meta.url),'utf8');

test('IV-004 usa runtime común para decisión y reversión',()=>{
  assert.match(actions,/processCode:'PROC-IV-004'/);
  assert.match(actions,/operation:'set_manual_identity_decision'/);
  assert.match(actions,/operation:'clear_manual_identity_decision'/);
  assert.match(actions,/eventType:'manual_override'/);
});

test('IV-004 guarda snapshot automático versionado y fingerprint',()=>{
  assert.match(actions,/validation_version:'2\.0\.0'/);
  assert.match(actions,/automatic_snapshot_fingerprint/);
  assert.match(actions,/automatic_snapshot:automaticSnapshot/);
});

test('Quitar decisión no restaura ciegamente el snapshot antiguo',()=>{
  assert.match(actions,/validation_details=COALESCE\(validation_details,'\{\}'::jsonb\)-'manual'/);
  assert.match(actions,/const automatic=await validateOne\(imdbId,trace\)/);
  assert.doesNotMatch(actions,/restore=manual\?\.automatic_status/);
  assert.match(actions,/Resultado automático vigente restaurado mediante revalidación/);
});

test('Quitar decisión es idempotente si no existe override manual',()=>{
  assert.match(actions,/if\(!manual\)/);
  assert.match(actions,/functionalResult:'no_change'/);
  assert.match(actions,/No había ninguna decisión manual vigente que quitar/);
});

test('la pantalla usa las acciones canónicas de IV-004',()=>{
  assert.match(page,/from '\.\/manual-actions'/);
  assert.match(page,/setManualIdentityDecisionAction/);
  assert.match(page,/clearManualIdentityDecisionAction/);
  assert.match(page,/pendingLabel="Recalculando…"/);
});

test('Operaciones muestra nombre humano de IV-004',()=>{
  assert.match(display,/'PROC-IV-004':\{name:'Decisión manual de identidad'\}/);
});
