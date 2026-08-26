import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../lib/data-quality-unitary.js',import.meta.url),'utf8');
const mdblist=fs.readFileSync(new URL('../lib/ratings-provider-mdblist.js',import.meta.url),'utf8');
const apiLog=fs.readFileSync(new URL('../lib/data-quality-api-log.js',import.meta.url),'utf8');
const dataQuality=fs.readFileSync(new URL('../lib/data-quality.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/calidad/datos/page.js',import.meta.url),'utf8');

test('CALIDAD Datos recorre fuentes en orden TMDb → OMDb → MDBList',()=>{
  const tmdb=source.indexOf("['TMDb',refreshTmdb]"),omdb=source.indexOf("['OMDb',refreshOmdb]"),mdb=source.indexOf("['MDBList',refreshMdblist]");
  assert.ok(tmdb>=0&&omdb>tmdb&&mdb>omdb);
});

test('cada proveedor recibe IMDb ID y solo campos pendientes y soportados',()=>{
  assert.match(source,/wantedFor\(row,source\)/);
  assert.match(source,/missingFields\(row\)\.filter\(k=>supported\.has\(k\)\)/);
  assert.match(source,/shouldRun\(row,source\)/);
  assert.match(source,/fn\(imdbId,new Set\(attempted\)\)/);
});

test('Completar datos respeta el tipo validado y no reidentifica ni cambia de medio',()=>{
  assert.match(source,/mediaFromType\(m\.type\)/);
  assert.doesNotMatch(source,/\/find\//);
  assert.doesNotMatch(source,/ensureTmdbIdentity/);
  assert.doesNotMatch(source,/recoverMediaTypeIfNeeded/);
  assert.doesNotMatch(source,/media_type_recovered/);
  const runs=[...source.matchAll(/await runCascade\(imdbId,/g)];
  assert.equal(runs.length,1,'Debe ejecutarse una sola cascada según el tipo ya validado');
});

test('TMDb profundiza en episodios, créditos e imágenes cuando el tipo validado es serie',()=>{
  assert.match(source,/seriesEpisodeFacts/);
  assert.match(source,/\/episode\/\$\{ref\.episode\}\/credits/);
  assert.match(source,/\/images\?include_image_language=es,null,en/);
  assert.match(source,/if\(key==='runtime'\)return Number\(row\.runtime\)>0/);
});

test('MDBList mantiene separados ratings y metadatos',()=>{
  assert.match(mdblist,/export async function fetchMDBListRatings/);
  assert.match(mdblist,/export async function fetchMDBListMetadata/);
  assert.match(mdblist,/parseMDBListRatings/);
  assert.match(mdblist,/parseMDBListMetadata/);
});

test('CALIDAD conserva logging mínimo solo para errores y no guarda payloads completos',()=>{
  assert.match(source,/loggedJsonFetch/);
  assert.match(mdblist,/loggedJsonFetch/);
  assert.match(apiLog,/provider_http_transport_error/);
  assert.match(apiLog,/provider_http_error/);
  assert.match(apiLog,/u\.searchParams\.set\(key,'\*\*\*'\)/);
  assert.doesNotMatch(apiLog,/provider_http_request/);
  assert.doesNotMatch(apiLog,/provider_http_response/);
});

test('las fuentes posteriores no sustituyen datos existentes',()=>{
  assert.match(source,/COALESCE\(type,/);
  assert.match(source,/COALESCE\(title_es,/);
  assert.match(source,/COALESCE\(original_title,/);
  assert.match(source,/COALESCE\(runtime,/);
  assert.match(source,/COALESCE\(country,/);
});

test('la revisión permanece disponible tras avanzar Lifecycle y calcula reentrada de ratings',()=>{
  assert.match(dataQuality,/MOVIE_FILE_PENDING/);
  assert.match(dataQuality,/SERIES_REVIEW/);
  assert.match(dataQuality,/TECH_PENDING/);
  assert.match(dataQuality,/COMPLETE/);
  assert.match(dataQuality,/nextRatingRefreshAt/);
  assert.match(dataQuality,/ratings_refreshed_at/);
  assert.match(dataQuality,/ratingsFresh/);
});

test('expires_at nulo usa la frescura calculada y no epoch 1970',()=>{
  assert.match(dataQuality,/explicit=r\.expires_at\?new Date\(r\.expires_at\)\.getTime\(\):NaN/);
  assert.doesNotMatch(dataQuality,/explicit=new Date\(r\.expires_at\)\.getTime\(\)/);
});

test('duración de serie cuenta para cobertura pero no bloquea el avance',()=>{
  assert.match(dataQuality,/effectiveSeverity=\(k,r\)=>k==='runtime'&&isSeries\(r\)\?'optional'/);
  assert.match(dataQuality,/k==='runtime'\?Number\(v\)>0/);
});

test('CALIDAD mantiene una lectura estable y reutilizada mientras se corrige la paginación SQL',()=>{
  assert.match(dataQuality,/cache\(async/);
  assert.match(dataQuality,/loadUniverse/);
  assert.match(dataQuality,/\.slice\(start,start\+pageSize\)/);
});

test('la pantalla incorpora contexto Plex, mejora no incidente y exclusión existente',()=>{
  assert.match(dataQuality,/in_plex/);
  assert.match(page,/En Plex/);
  assert.match(page,/Fuera de Plex/);
  assert.match(page,/Mejorar datos/);
  assert.match(page,/IdentityExcludeButton/);
  assert.match(page,/100 % completos/);
});

test('la identidad muestra accesos externos fiables y mantiene IMDb visible',()=>{
  assert.match(page,/providerUrl\('imdb'/);
  assert.match(page,/providerUrl\('tmdb'/);
  assert.match(page,/providerUrl\('mdblist'/);
  assert.match(page,/providerUrl\('trakt'/);
  assert.match(page,/<code>\{r\.imdb_id\}<\/code>/);
  assert.doesNotMatch(page,/FilmAffinity|filmaffinity|FA ↗/i);
});
