import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('la portada de Calidad usa un resumen de Personas sin construir el listado completo',()=>{
  const source=read('lib/people-quality.js');
  const summary=source.slice(source.indexOf('export async function getPeopleQualitySummary'));
  assert.ok(summary.includes('SELECT count(*)::int total'));
  assert.doesNotMatch(summary,/getPeopleQualityOverview\(/);
  assert.doesNotMatch(summary,/LIMIT \$\{pageSize\}/);
});

test('las estadísticas de validación no cargan las 50 fichas detalladas',()=>{
  const source=read('lib/identity-validation-page.js');
  const start=source.indexOf('export async function getIdentityValidationStats');
  const end=source.indexOf('export async function getIdentityValidationPage',start);
  const stats=source.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(stats,/getIdentityValidationSnapshot\(/);
  assert.doesNotMatch(stats,/SELECT m\.imdb_id/);
  assert.doesNotMatch(stats,/LIMIT \$\{p\.pageSize\}/);
  assert.match(stats,/SELECT count\(\*\)::int total/);
});

test('la portada reutiliza Lifecycle para identidad, validación, datos y PikoQuality',()=>{
  const source=read('lib/quality-home.js');
  assert.doesNotMatch(source,/getIdentityWorkflowStats/);
  assert.doesNotMatch(source,/getIdentityValidationStats/);
  assert.doesNotMatch(source,/getDataQualityOverview/);
  assert.doesNotMatch(source,/getPikoQualityState/);
  assert.match(source,/SELECT lifecycle_state,count\(\*\)::int count FROM catalog_lifecycle GROUP BY lifecycle_state/);
  assert.match(source,/getPeopleQualitySummary\(\)/);
  assert.match(source,/getMovieQualitySummary\(sql\)/);
  assert.match(source,/getSeriesQualityCounts\(sql\)/);
});

test('el dominio de portada conserva el fallback Lifecycle de las cuatro áreas',()=>{
  const source=read('lib/quality-home-domain.mjs');
  assert.match(source,/identity:sum\(counts,\['IDENTITY_PENDING'\]\)/);
  assert.match(source,/validation:sum\(counts,\['IDENTITY_VALIDATION','IDENTITY_REVIEW_REQUIRED'\]\)/);
  assert.match(source,/data:sum\(counts,\['DATA_INCOMPLETE','PIKOSCORE_PENDING'\]\)/);
  assert.match(source,/pikoquality:sum\(counts,\['TECH_PENDING'\]\)/);
});
