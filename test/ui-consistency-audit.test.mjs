import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Inicio comparte la semántica de incidencias activas con Operaciones',()=>{
  const home=read('app/page.js');
  const canonical=read('lib/operations-attention.js');
  assert.match(home,/getActiveOperationalAttention/);
  assert.doesNotMatch(home,/retryable IS NOT TRUE/);
  assert.match(home,/technical\?\.incidents/);
  assert.match(canonical,/later\.technical_status='succeeded'/);
  assert.match(canonical,/incident_groups/);
});

test('Actividad calcula atención sobre el último estado y agrupa calendario en Madrid',()=>{
  const source=read('lib/activity-v4.js');
  assert.match(source,/timeZone:'Europe\/Madrid'/);
  assert.match(source,/WITH latest_root AS/);
  assert.match(source,/DISTINCT ON \(process_code,COALESCE\(entity_type,''\),COALESCE\(entity_id,''\)\)/);
  assert.doesNotMatch(source,/function dayKey\(value\)\{return new Date\(value\)\.toISOString/);
});

test('detalle de Series no trunca episodios y sólo usa PikoQuality vigente',()=>{
  const source=read('lib/series-detail-query.js');
  const episodeScope=source.slice(source.indexOf('export async function getSeriesEpisodeScope'),source.indexOf('export function seriesMaintenance'));
  assert.match(source,/PIKOQUALITY_ACTIVE_VERSION/);
  assert.match(source,/q\.formula_version=\$\{PIKOQUALITY_ACTIVE_VERSION\}/);
  assert.match(source,/q\.source_fingerprint IS NOT DISTINCT FROM pts\.technical_fingerprint/);
  assert.doesNotMatch(episodeScope,/LIMIT/);
});

test('Sagas no presenta 0 de 0 como completa ni como 100 por cien',()=>{
  const list=read('app/sagas/page.js');
  const detail=read('app/sagas/[name]/page.js');
  assert.match(list,/actionable_total\)===0.*Sin títulos exigibles/s);
  assert.match(detail,/actionableTotal===0\?'Sin títulos exigibles'/);
  assert.match(detail,/pct=actionableTotal\?.*:null/);
  assert.match(detail,/pct==null\?'No aplica'/);
});

test('el país destacado de Inicio es un filtro real de Catálogo',()=>{
  const queries=read('lib/catalog-v4-queries.js');
  const filters=read('components/CatalogFiltersV4.js');
  assert.match(queries,/const country=String\(first\(raw\.country\)/);
  assert.match(queries,/movie_countries mc JOIN countries ctry/);
  assert.match(queries,/if\(s\.country\)p\.set\('country'/);
  assert.match(filters,/sp\.get\('country'\)/);
  assert.match(filters,/setYf\(sp\.get\('yearFrom'\)/);
  assert.match(filters,/setYt\(sp\.get\('yearTo'\)/);
});

test('Operaciones mantiene todas las activas visibles y pagina el historial',()=>{
  const queries=read('lib/operations-queries.js');
  const page=read('app/admin/page.js');
  const activeBlock=queries.slice(queries.indexOf("WHERE r.technical_status IN ('queued','running')"),queries.indexOf('sql`WITH candidates'));
  assert.doesNotMatch(activeBlock,/LIMIT 25/);
  assert.match(queries,/pageSize=50/);
  assert.match(queries,/LIMIT \$\{pageSize\+1\} OFFSET \$\{offset\}/);
  assert.match(queries,/searchHasMore/);
  assert.match(page,/Más antiguas/);
  assert.match(page,/Más recientes/);
});

test('la ficha permite volver de Catálogo, Sagas, Personas y Calidad Personas sin abrir redirects externos',()=>{
  const source=read('app/catalogo/[imdbId]/page.js');
  assert.match(source,/SAFE_BACK_PREFIXES=\['\/catalogo','\/sagas','\/personas','\/calidad\/personas'\]/);
  assert.match(source,/!s\.startsWith\('\/\/'\)/);
  const person=read('app/personas/[id]/page.js');
  assert.match(person,/\?from=\$\{encodeURIComponent\(detailReturn\)\}/);
});

test('Calidad Personas construye resumen, total filtrado y página en una sola pasada pesada',()=>{
  const source=read('lib/people-quality.js');
  const overview=source.slice(source.indexOf('export async function getPeopleQualityOverview'),source.indexOf('export async function getPeopleQualitySummary'));
  assert.match(overview,/latest_runs AS MATERIALIZED/);
  assert.match(overview,/quality AS MATERIALIZED/);
  assert.match(overview,/filtered AS MATERIALIZED/);
  assert.match(overview,/jsonb_agg/);
  assert.doesNotMatch(overview,/const rows=await sql/);
  assert.doesNotMatch(overview,/const \[filtered\]=await sql/);
});

test('las acciones principales auditadas muestran estado pendiente y existe recuperación global',()=>{
  const button=read('components/PendingSubmitButton.js');
  assert.match(button,/useFormStatus/);
  assert.match(button,/disabled=\{disabled\|\|pending\}/);
  for(const path of ['app/novedades/page.js','app/calidad/peliculas/page.js','app/calidad/personas/page.js','app/personas/[id]/page.js','app/calidad/sin-estado/page.js']){
    assert.match(read(path),/PendingSubmitButton/,path);
  }
  assert.match(read('app/error.js'),/reset\(\)/);
});

test('Integridad Lifecycle tiene total real y paginación en lugar de un límite silencioso de 1000',()=>{
  const source=read('app/calidad/sin-estado/page.js');
  assert.match(source,/PAGE_SIZE=100/);
  assert.match(source,/SELECT count\(\*\)::int total/);
  assert.match(source,/OFFSET \$\{offset\}/);
  assert.doesNotMatch(source,/LIMIT 1000/);
});
