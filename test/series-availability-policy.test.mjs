import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../lib/series-unitary.js',import.meta.url),'utf8');
const canonical=fs.readFileSync(new URL('../lib/series-es-availability-core.mjs',import.meta.url),'utf8');
test('series-level ES provider never marks an aired season as ES_AVAILABLE',()=>{assert.equal(src.includes("if(hasEs&&past.length)"),false);assert.equal(src.includes("Proveedor ES detectado para la serie, pero no demuestra disponibilidad de esta temporada"),true)});

test('disponibilidad ES no consulta episodios sin fecha de estreno',()=>{assert.match(canonical,/e\.air_date IS NOT NULL AND e\.air_date<=CURRENT_DATE/);assert.doesNotMatch(canonical,/e\.effective_status='availability_unknown' AND e\.season_number>0/)});
