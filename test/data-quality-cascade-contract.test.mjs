import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../lib/data-quality-unitary.js',import.meta.url),'utf8');
const mdblist=fs.readFileSync(new URL('../lib/ratings-provider-mdblist.js',import.meta.url),'utf8');

test('CALIDAD Datos recorre fuentes en orden TMDb → OMDb → MDBList',()=>{
  const loop=source.match(/for\(const \[source,fn\] of \[(.*?)\]\)\{/s);
  assert.ok(loop,'No se encontró la cascada de proveedores');
  const text=loop[1];
  assert.ok(text.indexOf("['TMDb',refreshTmdb]")<text.indexOf("['OMDb',refreshOmdb]"));
  assert.ok(text.indexOf("['OMDb',refreshOmdb]")<text.indexOf("['MDBList',refreshMdblist]"));
});

test('cada proveedor recibe solo campos pendientes y soportados',()=>{
  assert.match(source,/wantedFor\(row,source\)/);
  assert.match(source,/missingFields\(row\)\.filter\(k=>supported\.has\(k\)\)/);
  assert.match(source,/if\(!shouldRun\(row,source\)\)continue/);
});

test('TMDb profundiza en episodios, créditos e imágenes para series',()=>{
  assert.match(source,/seriesEpisodeFacts/);
  assert.match(source,/\/episode\/\$\{ref\.episode\}\/credits/);
  assert.match(source,/\/images\?include_image_language=es,null,en/);
});

test('MDBList mantiene separados ratings y metadatos',()=>{
  assert.match(mdblist,/export async function fetchMDBListRatings/);
  assert.match(mdblist,/export async function fetchMDBListMetadata/);
  assert.match(mdblist,/parseMDBListRatings/);
  assert.match(mdblist,/parseMDBListMetadata/);
});

test('las fuentes posteriores no sustituyen datos existentes',()=>{
  assert.match(source,/COALESCE\(type,/);
  assert.match(source,/COALESCE\(title_es,/);
  assert.match(source,/COALESCE\(original_title,/);
  assert.match(source,/COALESCE\(runtime,/);
  assert.match(source,/COALESCE\(country,/);
});

test('si quedan huecos valida el tipo contra el IMDb ID exacto de TMDb y prueba el tipo contrario',()=>{
  assert.match(source,/recoverMediaTypeIfNeeded/);
  assert.match(source,/append_to_response=external_ids/);
  assert.match(source,/currentIdentity\.imdbId===imdbId/);
  assert.match(source,/alternateIdentity\.imdbId!==imdbId/);
  assert.match(source,/alternateMedia=currentMedia==='movie'\?'tv':'movie'/);
});

test('la reclasificación solo ocurre con coincidencia exacta y relanza la cascada una vez',()=>{
  assert.match(source,/UPDATE movies SET type=\$\{correctedType\}/);
  assert.match(source,/data_quality_type_recovery/);
  assert.match(source,/media_type_recovered/);
  const runs=[...source.matchAll(/runCascade\(imdbId,/g)];
  assert.equal(runs.length,2,'Debe existir una pasada normal y como máximo una repetición tras reclasificar');
});
