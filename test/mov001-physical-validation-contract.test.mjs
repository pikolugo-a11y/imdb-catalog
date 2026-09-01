import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const validation=await readFile(new URL('../lib/movie-file-validation.js',import.meta.url),'utf8');
const canonical=await readFile(new URL('../lib/mov001-canonical.mjs',import.meta.url),'utf8');
const batch=await readFile(new URL('../lib/mov001-batch.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/batch-fast-worker.mjs',import.meta.url),'utf8');
const lifecycle=await readFile(new URL('../lib/lifecycle.js',import.meta.url),'utf8');
const plex=await readFile(new URL('../lib/plex-sync.js',import.meta.url),'utf8');
const display=await readFile(new URL('../lib/process-display.js',import.meta.url),'utf8');

test('MOV-001 individual and Batch share the canonical executor',()=>{assert.match(validation,/processCode:'PROC-MOV-001'/);assert.match(validation,/runKind:'individual'/);assert.match(validation,/executeMov001Canonical\(db\(\),imdbId/);assert.match(worker,/PROC-MOV-001/);assert.match(worker,/executeMov001Canonical/);assert.match(display,/Validar archivo físico/)});
test('MOV-001 detects duplicates from distinct plex_files, not rating keys',()=>{assert.match(canonical,/JOIN plex_files pf/);assert.match(canonical,/physicalKey/);assert.match(canonical,/distinct\.length>1/);assert.match(canonical,/physical_file_count/);assert.doesNotMatch(canonical,/if\(rows\.length>1\)/)});
test('movie file validation uses a physical fingerprint compatible with lifecycle',()=>{assert.match(canonical,/ratingPhysicalFingerprint/);assert.match(canonical,/createHash\('md5'\)/);assert.match(lifecycle,/md5\(string_agg/);assert.match(lifecycle,/pfv\.file_path/);assert.match(lifecycle,/pfv\.file_size_bytes/);assert.match(lifecycle,/pfv\.duration_ms/);assert.match(lifecycle,/pfv\.plex_part_id/)});
test('MOV-001 Batch selects only the canonical pending stage and never starts automatically',()=>{assert.match(batch,/lifecycle_state='MOVIE_FILE_PENDING'/);assert.match(batch,/triggerSource:'calidad_peliculas_batch'/);assert.match(batch,/worker_pool:'fast'/);assert.match(batch,/startMov001Batch/);assert.doesNotMatch(plex,/startMov001Batch|executeMov001Canonical/)});
test('Plex Sync invalidates changed movie files without auto-running MOV-001',()=>{assert.match(plex,/recomputePhysicalMovieChanges/);assert.match(plex,/mfv\.source_fingerprint IS DISTINCT FROM/);assert.match(plex,/recomputeLifecycleForIds\(ids\)/);assert.doesNotMatch(plex,/validateMovieFile/)});
