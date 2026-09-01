import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {ratingPhysicalFingerprint} from '../lib/mov001-canonical.mjs';
const validation=await readFile(new URL('../lib/movie-file-validation.js',import.meta.url),'utf8');
const canonical=await readFile(new URL('../lib/mov001-canonical.mjs',import.meta.url),'utf8');
const batch=await readFile(new URL('../lib/mov001-batch.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/batch-fast-worker.mjs',import.meta.url),'utf8');
const lifecycle=await readFile(new URL('../lib/lifecycle.js',import.meta.url),'utf8');
const plex=await readFile(new URL('../lib/plex-sync.js',import.meta.url),'utf8');
const display=await readFile(new URL('../lib/process-display.js',import.meta.url),'utf8');

test('MOV-001 individual and Batch share the canonical executor',()=>{assert.match(validation,/processCode:'PROC-MOV-001'/);assert.match(validation,/runKind:'individual'/);assert.match(validation,/executeMov001Canonical\(db\(\),imdbId/);assert.match(worker,/PROC-MOV-001/);assert.match(worker,/executeMov001Canonical/);assert.match(display,/Validar archivo físico/)});
test('MOV-001 detects duplicates from distinct plex_files, not rating keys',()=>{assert.match(canonical,/JOIN plex_files pf/);assert.match(canonical,/physicalKey/);assert.match(canonical,/distinct\.length>1/);assert.match(canonical,/physical_file_count/);assert.doesNotMatch(canonical,/if\(rows\.length>1\)/)});
test('movie file validation fingerprint follows media_index then part_index like lifecycle and Plex Sync',()=>{const rows=[{media_index:1,part_index:0,file_path:'/a.mkv',file_size_bytes:10,duration_ms:100,plex_part_id:'a'},{media_index:0,part_index:1,file_path:'/z.mkv',file_size_bytes:20,duration_ms:200,plex_part_id:'z'}];const expected=crypto.createHash('md5').update('/z.mkv|20|200|z,/a.mkv|10|100|a').digest('hex');assert.equal(ratingPhysicalFingerprint(rows),expected);assert.match(canonical,/canonicalPhysicalOrder/);assert.match(lifecycle,/ORDER BY pfv\.media_index,pfv\.part_index/);assert.match(plex,/ORDER BY pf\.media_index,pf\.part_index/)});
test('MOV-001 currentness uses the same effective duration fallback as validation',()=>{assert.match(canonical,/COALESCE\(pf\.duration_ms,pm\.duration_ms\) duration_ms/);assert.match(canonical,/FROM plex_media pmv WHERE pmv\.rating_key=pfv\.rating_key AND pmv\.media_index=pfv\.media_index/);assert.match(lifecycle,/FROM plex_media pmv WHERE pmv\.rating_key=pfv\.rating_key AND pmv\.media_index=pfv\.media_index/);assert.match(plex,/FROM plex_media pm WHERE pm\.rating_key=pf\.rating_key AND pm\.media_index=pf\.media_index/)});
test('MOV-001 Batch selects only the canonical pending stage and never starts automatically',()=>{assert.match(batch,/lifecycle_state='MOVIE_FILE_PENDING'/);assert.match(batch,/triggerSource:'calidad_peliculas_batch'/);assert.match(batch,/worker_pool:'fast'/);assert.match(batch,/startMov001Batch/);assert.doesNotMatch(plex,/startMov001Batch|executeMov001Canonical/)});
test('Plex Sync invalidates changed movie files without auto-running MOV-001',()=>{assert.match(plex,/recomputePhysicalMovieChanges/);assert.match(plex,/mfv\.source_fingerprint IS DISTINCT FROM/);assert.match(plex,/recomputeLifecycleForIds\(ids\)/);assert.doesNotMatch(plex,/validateMovieFile/)});
