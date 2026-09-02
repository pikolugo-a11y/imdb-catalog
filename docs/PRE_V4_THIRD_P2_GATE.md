# PRE-V4 — Tercer gate P2: retirada coordinada de ejecución Lifecycle histórica

Fecha: 2026-09-01
Rama: `pre-v4-readiness`

Este documento prepara y registra el tercer lote destructivo PRE-V4.

## 1. Objetivo

Retirar únicamente el plano de ejecución histórico Lifecycle/People/Plex Reconcile que ya no corresponde a la arquitectura productiva actual, preservando expresamente:

- `catalog_lifecycle`;
- `lib/lifecycle.js`;
- `lib/lifecycle-recompute-core.mjs`;
- `lib/lifecycle-data-stage.mjs`;
- Batch API / FAST / Plex actuales;
- Technical Snapshot;
- todos los Server Actions y controles frontend actuales.

## 2. Frontend safety gate

Estado del bloque histórico retirado: `FRONTEND=NO` para los executors/launchers antiguos.

La navegación y estados visibles del producto consumen `catalog_lifecycle` y el core de recomputación actual, no el worker histórico. Las operaciones actuales de Calidad llegan a Batch API/FAST/Plex o a cores unitarios actuales.

People actual:

- flujo individual: `/personas/[id]` -> `refreshPersonFilmographyAction` -> `lib/people-v2.js`;
- Batch: `/calidad/personas` -> Batch API -> `PROC-PER-001` -> la misma `refreshPersonFilmography` canónica.

Plex actual:

- Novedades usa su flujo Vercel `syncPlexFromNews` / sync global actual;
- Series SER-002 usa el pool `plex` actual y necesita `worker/batch-plex-worker.mjs`.

## 3. Railway vivo previo al lote

No existía servicio productivo que usara:

- `railway.lifecycle.toml`;
- `Dockerfile.lifecycle`;
- `Dockerfile.worker`;
- `worker/entrypoint.mjs`;
- `worker/combined-worker.mjs`.

Los servicios vivos usan directamente:

- `Dockerfile.batch-api` / `worker/batch-api-worker.mjs`;
- `Dockerfile.batch-fast` / `worker/batch-fast-worker.mjs`;
- `Dockerfile.technical` / `worker/technical-snapshot-worker.mjs`.

Batch Plex sigue ausente de Railway, pero su código/config actual se conserva porque el frontend SER-002 lo necesita.

## 4. Arquitectura histórica retirada

`railway.lifecycle.toml` arrancaba `Dockerfile.lifecycle` y `worker/combined-worker.mjs`.

`combined-worker.mjs` lanzaba tres procesos históricos:

1. `worker/lifecycle-worker.mjs`;
2. `worker/people-worker.mjs`;
3. `worker/plex-reconcile-worker.mjs`.

El Lifecycle histórico dependía de `batch_jobs`, `batch_runs`, `batch_runtime_control`, `batch_source_limits`, `batch_job_steps`, `batch_process_state`, `lib/lifecycle-processes.mjs`, `worker/lifecycle-runtime.mjs` y executors `worker/lifecycle-*-executor.mjs`.

People histórico reclamaba `batch_jobs` con `orchestration='people'` y duplicaba el dominio actual de `lib/people-v2.js`.

Plex Reconcile histórico reclamaba `pipeline_runs.job_type='plex_full_reconcile'`, pero su ejecución real estaba hardcodeada como `debug_probe`, `probe_limit:5`, `LIMIT 5` y final `DEBUG PROBE 5`.

## 5. Generic entrypoint retirado

`Dockerfile.worker` arrancaba `worker/entrypoint.mjs`.

Ese entrypoint afirmaba que `fast` y `api` estaban retirados y recomendaba `lifecycle`, lo contrario del plano productivo actual. No existía consumidor Railway actual.

## 6. Ejecución P2-C aprobada

Autorización explícita del usuario recibida el 2026-09-01 con **“Apruebo”** sobre este lote.

Se eliminaron en `pre-v4-readiness` exactamente estos 18 ficheros:

1. `railway.lifecycle.toml`
2. `Dockerfile.lifecycle`
3. `Dockerfile.worker`
4. `worker/entrypoint.mjs`
5. `worker/combined-worker.mjs`
6. `worker/lifecycle-worker.mjs`
7. `worker/lifecycle-runtime.mjs`
8. `worker/people-worker.mjs`
9. `worker/people-executor.mjs`
10. `worker/plex-reconcile-worker.mjs`
11. `worker/lifecycle-data-executor.mjs`
12. `worker/lifecycle-identity-executor.mjs`
13. `worker/lifecycle-movie-file-executor.mjs`
14. `worker/lifecycle-pikoscore-executor.mjs`
15. `worker/lifecycle-series-executor.mjs`
16. `worker/lifecycle-tech-executor.mjs`
17. `worker/lifecycle-validation-executor.mjs`
18. `lib/lifecycle-processes.mjs`

Además se hicieron los dos ajustes coordinados aprobados:

- `package.json`: retirado únicamente el script `worker:lifecycle`; se conservan `worker:imdb-discovery`, `worker:batch-fast`, `worker:batch-api` y `worker:batch-plex`.
- `.github/workflows/ci.yml`: retirados los checks de Lifecycle histórico y añadidos checks de `worker/batch-api-worker.mjs`, `worker/batch-fast-worker.mjs` y `worker/batch-plex-worker.mjs`, conservando Discovery, `lib/lifecycle-data-stage.mjs`, PikoScore 3, `test:quality` y build.

## 7. Verificación posterior

Se leyó el árbol recursivo de `pre-v4-readiness` tras la operación. No aparecen `worker/lifecycle-worker.mjs`, `worker/combined-worker.mjs` ni `lib/lifecycle-processes.mjs`, mientras siguen presentes los Dockerfiles y workers Batch actuales.

Se releyeron `package.json` y `.github/workflows/ci.yml` y reflejan exactamente los ajustes coordinados anteriores.

## 8. Elementos explícitamente protegidos y no tocados

No se borró ni renombró:

- `catalog_lifecycle` ni objetos Neon;
- `lib/lifecycle.js`;
- `lib/lifecycle-recompute-core.mjs`;
- `lib/lifecycle-data-stage.mjs`;
- `lib/data003-canonical.mjs`;
- `lib/mov001-canonical.mjs`;
- `lib/people-v2.js`;
- `lib/people-batch.js`;
- `worker/batch-api-worker.mjs`;
- `worker/batch-fast-worker.mjs`;
- `worker/batch-plex-worker.mjs`;
- Technical Snapshot;
- Novedades Plex;
- SER-002/003/004;
- ningún Server Action/control frontend.

Tampoco se tocaron las tablas históricas Neon. P3 de base de datos sigue bloqueado por NEON-001 y requiere inventario real antes de cualquier DROP.

## 9. Estado de `pikofilm-backup-temp`

Railway Agent aceptó su eliminación en el lote anterior y la marcó para removal, pero lecturas posteriores todavía la muestran sin deployment. Se mantiene como `REMOVAL IN PROGRESS / VERIFY`; no se repite la eliminación mientras Railway propaga el cambio.

## 10. Resultado

**P2-C: COMPLETADO EN RAMA PRE-V4.**

El plano de ejecución Lifecycle/People/Plex Reconcile histórico ha sido retirado del código de trabajo, preservando el Lifecycle de producto y los executors canónicos actuales. No se ha desplegado automáticamente ni se ha modificado Neon.
