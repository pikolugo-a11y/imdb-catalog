import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Calidad incorpora Personas en la segunda fila operativa',()=>{
  const domain=read('lib/quality-home-domain.mjs');
  const page=read('app/calidad/page.js');
  const nav=read('components/Nav.js');
  assert.match(domain,/id:'people'/);
  assert.match(domain,/href:'\/calidad\/personas'/);
  assert.match(page,/StageCard stage=\{byId\.movies\}\/><StageCard stage=\{byId\.series\}\/><StageCard stage=\{byId\.people\}\/><StageCard stage=\{byId\.pikoquality\}/);
  assert.doesNotMatch(page,/Entidades relacionadas/);
  assert.match(nav,/\['\/calidad\/personas','Personas'\]/);
});

test('calidad de Personas usa vigencia adaptativa 30/90/365/1095 y conserva estados',()=>{
  const source=read('lib/people-quality.js');
  assert.match(source,/PERSON_QUALITY_MAX_AGE_DAYS=1095/);
  assert.match(source,/deathday IS NOT NULL THEN 1095/);
  assert.match(source,/last_work_date>=CURRENT_DATE-INTERVAL '1 year' THEN 30/);
  assert.match(source,/last_work_date>=CURRENT_DATE-INTERVAL '3 years' THEN 90/);
  assert.match(source,/last_work_date>=CURRENT_DATE-INTERVAL '10 years' THEN 365/);
  assert.match(source,/ELSE 1095 END refresh_days/);
  assert.match(source,/filmography_refreshed_at<now\(\)-\(r\.refresh_days\|\|' days'\)::interval/);
  assert.match(source,/technical_status='failed'/);
  assert.match(source,/THEN 'error'/);
  assert.match(source,/THEN 'never'/);
  assert.match(source,/THEN 'stale'/);
  assert.match(source,/ELSE 'ok'/);
  assert.match(source,/process_code='PROC-PER-001'/);
  assert.match(source,/adaptiveFreshness:true/);
});

test('Calidad Personas ejecuta PER-001 directamente y mantiene ficha como detalle',()=>{
  const quality=read('app/calidad/personas/page.js');
  const actions=read('app/personas/actions.js');
  assert.match(quality,/refreshPersonFilmographyAction/);
  assert.match(quality,/↻ Actualizar/);
  assert.match(quality,/Abrir ficha →/);
  assert.match(quality,/name="returnTo" value=\{returnTo\}/);
  assert.match(actions,/revalidatePath\('\/calidad\/personas'\)/);
  assert.match(actions,/target\.startsWith\('\/calidad\/personas'\)/);
});

test('la ficha de Persona conserva el retorno a Calidad cuando procede',()=>{
  const detail=read('app/personas/[id]/page.js');
  assert.match(detail,/requestedBack\.startsWith\('\/calidad\/personas'\)/);
  assert.match(detail,/backLabel=backTo\.startsWith\('\/calidad\/personas'\)\?'Calidad · Personas':'Personas'/);
  assert.match(detail,/href=\{backTo\}>← \{backLabel\}/);
  assert.match(detail,/returnTo=\$\{encodeURIComponent\(backTo\)\}/);
});
