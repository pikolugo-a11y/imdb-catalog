import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const editor=read('../components/IdentityIdsEditor.js');
const actions=read('../app/calidad/validacion-identidad/force-actions.js');
const correction=read('../lib/identity-correction.js');
const display=read('../lib/process-display.js');

test('IV-003 mantiene bloqueo normal y solo entonces ofrece forzado',()=>{assert.match(editor,/state\?\.status==='mismatch'/);assert.match(editor,/Forzar asociación manual/);assert.match(editor,/Escribe FORZAR/);assert.match(actions,/saveIdentityIdsWithFeedbackAction/)});
test('IV-005 exige confirmación explícita y tiene proceso propio observado',()=>{assert.match(actions,/confirmation!=='FORZAR'/);assert.match(actions,/processCode:'PROC-IV-005'/);assert.match(actions,/runKind:'individual'/);assert.match(actions,/manual_override:true/)});
test('el núcleo vuelve a verificar TMDb y solo permite forzar mismatch conocido',()=>{assert.match(correction,/forceMismatch=false/);assert.match(correction,/validateTmdbIdentity/);assert.match(correction,/!verification\.actualImdbId/);assert.match(correction,/!verification\.ok&&!forceMismatch/);assert.match(correction,/!verification\.ok&&forceMismatch/)});
test('el override queda persistido y trazado',()=>{assert.match(actions,/identity_override/);assert.match(actions,/actual_imdb_id/);assert.match(actions,/forced_at/);assert.match(actions,/eventType:'manual_override'/);assert.match(display,/'PROC-IV-005':\{name:'Forzar asociación de identidad'\}/)});
