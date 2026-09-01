import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const unit=await readFile(new URL('../lib/data-quality-unitary.js',import.meta.url),'utf8');
const canonical=await readFile(new URL('../lib/data001-canonical.mjs',import.meta.url),'utf8');
const batch=await readFile(new URL('../lib/data001-batch.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/batch-api-worker.mjs',import.meta.url),'utf8');
const actions=await readFile(new URL('../app/calidad/datos/batch-actions.js',import.meta.url),'utf8');
const panels=await readFile(new URL('../components/Data003BatchPanel.js',import.meta.url),'utf8');
const panel=await readFile(new URL('../components/Data001BatchPanel.js',import.meta.url),'utf8');

test('DATA-001 manual and Batch share one canonical executor',()=>{assert.match(unit,/executeData001Canonical/);assert.match(worker,/executeData001Canonical/);assert.match(worker,/PROC-DATA-001/);assert.doesNotMatch(worker,/lifecycle-data-executor/)});
test('DATA-001 canonical remains fill-missing TMDb to OMDb to MDBList',()=>{assert.match(canonical,/\['tmdb',refreshTmdb\],\['omdb',refreshOmdb\],\['mdblist',refreshMdblist\]/);assert.match(canonical,/COALESCE\(type/);assert.match(canonical,/complete_missing_data/);assert.doesNotMatch(canonical,/FilmAffinity|filmaffinity|faEvidence/)});
test('DATA-001 uses shared API governance in manual and Batch lanes',()=>{assert.match(unit,/createApiGate/);assert.match(unit,/lane:'manual'/);assert.match(worker,/lane:'batch'/);assert.match(canonical,/apiGate\?\.acquire/);assert.match(canonical,/retry-after/);assert.match(canonical,/apiGateReason='rate_limited'/)});
test('DATA-001 eligibility is only validated DATA_INCOMPLETE titles',()=>{assert.match(batch,/DATA_INCOMPLETE/);assert.match(batch,/validation_status='valid'/);assert.match(batch,/catalog_exclusions/);assert.match(batch,/worker_pool:'api'/);assert.match(batch,/Math\.min\(Number\(concurrency\)\|\|2,2\)/)});
test('DATA-001 UI is ordered before ratings and supports progressive sizes',()=>{assert.ok(panels.indexOf('Data001BatchPanel')<panels.indexOf('Data002BatchPanel'));assert.match(actions,/startData001Batch/);assert.match(panel,/1 título/);assert.match(panel,/5 títulos/);assert.match(panel,/25 títulos/);assert.match(panel,/Todos/)});
test('DATA-001 recomputes canonical Lifecycle and never auto-starts from worker',()=>{assert.match(canonical,/recomputeLifecycleWithSql/);assert.match(canonical,/functionalResult=!after\?\.dataReady\?'pending'/);assert.doesNotMatch(worker,/startData001Batch/)});
