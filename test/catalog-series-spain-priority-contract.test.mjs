import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const query=fs.readFileSync('lib/catalog-v4-queries.js','utf8');
const page=fs.readFileSync('app/catalogo/page.js','utf8');
const filters=fs.readFileSync('components/CatalogFiltersV4.js','utf8');
const profile=fs.readFileSync('lib/catalog-series-profile.mjs','utf8');
const profileQuery=fs.readFileSync('lib/catalog-series-profile-query.js','utf8');
const detail=fs.readFileSync('app/catalogo/[imdbId]/page.js','utf8');
const batch=fs.readFileSync('lib/series-batch.js','utf8');
const worker=fs.readFileSync('worker/batch-api-worker.mjs','utf8');
const discovery=fs.readFileSync('worker/imdb-discovery.mjs','utf8');
const rescueSettings=fs.readFileSync('lib/news-discovery-settings.mjs','utf8');
const criteria=fs.readFileSync('app/novedades/criterios/page.js','utf8');
const display=fs.readFileSync('lib/process-display.js','utf8');

test('Series usan PikoRelevancia por defecto y conservan Prioridad España como orden alternativo',()=>{
  assert.match(query,/scope==='series'\?'relevance':'score'/);
  assert.match(query,/if\(p\.sort==='relevance'\)return `sra\.score/);
  assert.match(query,/percent_rank\(\) OVER\(PARTITION BY mc\.country_code/);
  assert.match(query,/country_signal/);
  assert.match(query,/country_code='ES'/);
  assert.match(query,/original_language='es'/);
  assert.match(query,/series_profile,spain,streaming/);
  assert.match(filters,/Prioridad España/);
  assert.match(filters,/PikoScore/);
  assert.match(page,/PikoRelevancia activa/);
});

test('el perfil TMDb de catálogo guarda tamaño y señal de streaming España',()=>{
  assert.match(profile,/number_of_seasons/);
  assert.match(profile,/number_of_episodes/);
  assert.match(profile,/watch%2Fproviders/);
  assert.match(profile,/\.results\?\.ES/);
  assert.match(profile,/series_profile/);
  assert.match(profile,/PROFILE_MAX_AGE_DAYS=30/);
});

test('temporadas y episodios se ven en listado y ficha aunque la serie no esté en Plex',()=>{
  assert.match(query,/series_seasons/);
  assert.match(query,/series_episodes/);
  assert.match(page,/seriesSize/);
  assert.match(page,/T ·/);
  assert.match(profileQuery,/series_profile,seasons/);
  assert.match(profileQuery,/series_profile,episodes/);
  assert.match(detail,/<b>Temporadas<\/b>/);
  assert.match(detail,/<b>Episodios<\/b>/);
  assert.match(detail,/No aplica/);
  assert.match(detail,/No hay copia física que validar/);
});

test('el backfill de perfiles es durable en Railway API y visible en Operaciones',()=>{
  assert.match(batch,/'PROC-SER-007':\{pool:'api',concurrency:2/);
  assert.match(worker,/'PROC-SER-007':executeSer007/);
  assert.match(worker,/refreshCatalogSeriesProfileCanonical/);
  assert.match(display,/'PROC-SER-007':\{name:'Actualizar perfil de catálogo de Series'\}/);
  assert.match(display,/catalog_series_profile_manual:'Manual desde Catálogo'/);
});

test('Discovery rescata series españolas de mercado sin rebajar el umbral global',()=>{
  assert.match(rescueSettings,/SPANISH_SERIES_MARKET_RESCUE=Object\.freeze\(\{minRating:6\.5,minVotes:1000\}\)/);
  assert.match(discovery,/wikidataSpanishImdbIds/);
  assert.match(discovery,/wdt:P495 wd:Q29/);
  assert.match(discovery,/spanishSeriesEligibility/);
  assert.match(discovery,/mainVotes=Math\.min\(settings\.movie\.general\.minVotes,settings\.movie\.spain\.minVotes,settings\.series\.general\.minVotes\)/);
  assert.doesNotMatch(discovery,/mainVotes=Math\.min\([^\n]*settings\.series\.spain\.minVotes/);
  assert.match(discovery,/matchedRule=c\.general\?'general':c\.marketRescue\?'spain_market':'spain'/);
  assert.match(discovery,/countryEvidence:'wikidata:P495=Q29'/);
  assert.match(discovery,/spanish_market_rescues/);
  assert.match(criteria,/rescate de mercado/i);
});
