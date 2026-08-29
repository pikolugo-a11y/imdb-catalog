import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const editor=read('../components/IdentityIdsEditor.js');
const page=read('../app/calidad/validacion-identidad/page.js');

test('el editor de IDs usa useActionState y muestra el mensaje devuelto por IV-003',()=>{
  assert.match(editor,/useActionState/);
  assert.match(editor,/state\?\.message/);
  assert.match(editor,/action-ok/);
  assert.match(editor,/action-error/);
  assert.match(editor,/Comprobando…/);
});

test('Validación de identidad usa el editor con feedback y no el form directo antiguo',()=>{
  assert.match(page,/IdentityIdsEditor/);
  assert.match(page,/action=\{saveIdentityIdsAction\}/);
  assert.doesNotMatch(page,/<form action=\{saveIdentityIdsAction\}/);
});
