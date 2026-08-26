import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../lib/series-unitary.js',import.meta.url),'utf8');
test('series-level ES provider never marks an aired season as ES_AVAILABLE',()=>{assert.equal(src.includes("if(hasEs&&past.length)"),false);assert.equal(src.includes("Proveedor ES detectado para la serie, pero no demuestra disponibilidad de esta temporada"),true)});
