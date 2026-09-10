import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

const TRIAD=[
  'docs/V4_FUNCTIONAL_SPEC.md',
  'docs/V4_ARCHITECTURE.md',
  'docs/V4_UX_SPEC.md'
];

const RETIRED=[
  'docs/BASELINE_V4_START.md',
  'docs/CURRENT_V4_HANDOFF.md',
  'docs/product/PRODUCT_AND_LIFECYCLE.md',
  'docs/product/V4_ACTIVIDAD.md',
  'docs/product/V4_ACTIVIDAD_UX_REFINEMENTS.md',
  'docs/product/V4_CALIDAD.md',
  'docs/product/V4_CATALOGO.md',
  'docs/product/V4_FICHA.md',
  'docs/product/V4_NOVEDADES.md',
  'docs/product/V4_OPERACIONES.md',
  'docs/product/V4_PERSONAS.md',
  'docs/product/V4_SAGAS.md',
  'docs/product/V4_UX_FOUNDATION.md',
  'docs/architecture/DATA_ARCHITECTURE.md',
  'docs/architecture/EXECUTION_ARCHITECTURE.md',
  'docs/architecture/OBSERVABILITY.md',
  'docs/architecture/SYSTEM_ARCHITECTURE.md'
];

test('the final V4 canonical triad exists and documents the closed baseline',()=>{
  for(const path of TRIAD){
    assert.equal(existsSync(path),true,`${path} must exist`);
    const text=read(path);
    assert.match(text,/FUENTE CANÓNICA/i,`${path} must declare canonical authority`);
    assert.match(text,/323b1cd4dd2cc8b5def081bc98ab094006df3efe/,`${path} must pin the closed V4 baseline`);
  }
});

test('AGENTS and docs README make the V4 triad mandatory entrypoints',()=>{
  const agents=read('AGENTS.md');
  const index=read('docs/README.md');
  for(const path of TRIAD){
    const short=path.replace('docs/','');
    assert.ok(agents.includes(path),`AGENTS must reference ${path}`);
    assert.ok(index.includes(short),`docs README must reference ${short}`);
  }
  assert.doesNotMatch(agents,/BASELINE_V4_START\.md|CURRENT_V4_HANDOFF\.md/);
});

test('superseded V4 and PRE-V4 canonical documents are physically retired from main tree',()=>{
  for(const path of RETIRED)assert.equal(existsSync(path),false,`${path} must remain Git history only`);
});

test('specialized process and operations annexes remain available',()=>{
  for(const path of [
    'docs/processes/PROCESS_CATALOG.md',
    'docs/processes/BATCH_ARCHITECTURE.md',
    'docs/operations/RUNBOOK.md',
    'docs/AI_DEVELOPMENT_GUIDE.md',
    'docs/PROJECT_RULES.md'
  ])assert.equal(existsSync(path),true,`${path} must remain canonical/specialized documentation`);
});

test('SAGA-001 documentation matches the live global Batch and exact per-collection core',()=>{
  const catalog=read('docs/processes/PROCESS_CATALOG.md');
  const batch=read('docs/processes/BATCH_ARCHITECTURE.md');
  assert.match(catalog,/PROC-SAGA-001[^\n]+individual \+ global[^\n]+\| sí \|[^\n]+refreshSagaCollectionCanonical[^\n]+Railway API[^\n]+EXACTA por colección/);
  assert.match(catalog,/lib\/saga-batch\.js/);
  assert.match(catalog,/antiguo límite funcional de 120/);
  assert.match(batch,/SAGA-001[^\n]+refreshSagaCollectionCanonical[^\n]+EXACTA por colección/);
  assert.match(batch,/pool `api`/);
  assert.doesNotMatch(catalog,/No usa Batch común porque su unidad de trabajo es un refresco global acotado/);
});
