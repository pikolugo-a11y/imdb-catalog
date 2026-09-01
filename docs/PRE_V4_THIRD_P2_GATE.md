# PRE-V4 — Tercer gate P2: retirada coordinada de ejecución Lifecycle histórica

Fecha: 2026-09-01
Rama: `pre-v4-readiness`

Este documento prepara el tercer lote destructivo PRE-V4. No autoriza por sí mismo ningún borrado.

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

Estado del bloque histórico propuesto: `FRONTEND=NO` para los executors/launchers antiguos.

La navegación y estados visibles del producto consumen `catalog_lifecycle` y el core de recomputación actual, no el worker histórico. Las operaciones actuales de Calidad llegan a Batch API/FAST/Plex o a cores unitarios actuales.

People actual:

- flujo individual: `/personas/[id]` -> `refreshPersonFilmographyAction` -> `lib/people-v2.js`;
- Batch: `/calidad/personas` -> Batch API -> `PROC-PER-001` -> la misma `refreshPersonFilmography` canónica.

Plex actual:

- Novedades usa su flujo Vercel `syncPlexFromNews` / sync global actual;
- Series SER-002 usa el pool `plex` actual y necesita `worker/batch-plex-worker.mjs`.

Por tanto NO deben retirarse esos caminos actuales.

## 3. Railway vivo

No existe servicio productivo que use:

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

## 4. Arquitectura histórica cerrada

`railway.lifecycle.toml` arranca `Dockerfile.lifecycle` y `worker/combined-worker.mjs`.

`combined-worker.mjs` lanza tres procesos históricos:

1. `worker/lifecycle-worker.mjs`;
2. `worker/people-worker.mjs`;
3. `worker/plex-reconcile-worker.mjs`.

### Lifecycle worker histórico

`worker/lifecycle-worker.mjs` depende de:

- `batch_jobs`;
- `batch_runs`;
- `batch_runtime_control`;
- `batch_source_limits`;
- `batch_job_steps`;
- `batch_process_state`;
- `lib/lifecycle-processes.mjs`;
- `worker/lifecycle-runtime.mjs`;
- executors `worker/lifecycle-*-executor.mjs`.

El mantenimiento actual de `catalog_lifecycle` ya está demostrado en los caminos canónicos actuales, por ejemplo `worker/batch-api-worker.mjs`, `worker/batch-fast-worker.mjs`, DATA-003 y MOV-001.

### People histórico

`worker/people-worker.mjs` reclama `batch_jobs` con `orchestration='people'` y ejecuta `worker/people-executor.mjs`. Esa implementación duplica el dominio actual de `lib/people-v2.js` y no forma parte de los dos flujos visibles actuales.

### Plex Reconcile histórico

`worker/plex-reconcile-worker.mjs` reclama `pipeline_runs.job_type='plex_full_reconcile'`, pero la ejecución real está hardcodeada como `debug_probe`, `probe_limit:5`, `LIMIT 5` y final `DEBUG PROBE 5`.

Clasificación: `TEMP/DEBUG + LEGACY`.

## 5. Generic entrypoint

`Dockerfile.worker` arranca `worker/entrypoint.mjs`.

Ese entrypoint afirma que `fast` y `api` están retirados y recomienda `lifecycle`, lo contrario del plano productivo actual: Batch FAST y Batch API son precisamente los workers canónicos vivos.

No existe consumidor Railway actual de este entrypoint.

Clasificación: `LEGACY / MISLEADING / FRONTEND=NO`.

## 6. CI y package deben cambiar en el mismo lote

`package.json` todavía expone:

- `worker:lifecycle` -> `node worker/lifecycle-worker.mjs`.

Ese script debe retirarse en la misma operación para no dejar un comando muerto.

La workflow `.github/workflows/ci.yml` todavía llama “workers canónicos” a:

- `worker/lifecycle-pikoscore-executor.mjs`;
- `worker/lifecycle-worker.mjs`.

Al retirar el bloque histórico, CI debe actualizarse, no simplemente romperse. Propuesta:

- conservar check de `worker/imdb-discovery.mjs`;
- añadir checks explícitos de `worker/batch-api-worker.mjs`, `worker/batch-fast-worker.mjs` y `worker/batch-plex-worker.mjs`;
- conservar `lib/lifecycle-data-stage.mjs` y el selfcheck de PikoScore 3;
- eliminar checks de executors Lifecycle históricos.

## 7. Candidato P2-C — borrado coordinado

### Infra/config de repo

1. `railway.lifecycle.toml`
2. `Dockerfile.lifecycle`
3. `Dockerfile.worker`

### Launchers / workers históricos

4. `worker/entrypoint.mjs`
5. `worker/combined-worker.mjs`
6. `worker/lifecycle-worker.mjs`
7. `worker/lifecycle-runtime.mjs`
8. `worker/people-worker.mjs`
9. `worker/people-executor.mjs`
10. `worker/plex-reconcile-worker.mjs`

### Executors Lifecycle históricos

11. `worker/lifecycle-data-executor.mjs`
12. `worker/lifecycle-identity-executor.mjs`
13. `worker/lifecycle-movie-file-executor.mjs`
14. `worker/lifecycle-pikoscore-executor.mjs`
15. `worker/lifecycle-series-executor.mjs`
16. `worker/lifecycle-tech-executor.mjs`
17. `worker/lifecycle-validation-executor.mjs`
18. `lib/lifecycle-processes.mjs`

### Ajustes coordinados, NO borrados ciegos

19. `package.json` -> retirar únicamente `worker:lifecycle`.
20. `.github/workflows/ci.yml` -> sustituir checks de Lifecycle histórico por checks de workers Batch actuales.

## 8. Elementos explícitamente protegidos y fuera del lote

No borrar ni renombrar en este lote:

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

Tampoco se borran aún las tablas históricas Neon. P3 de base de datos sigue bloqueado por NEON-001 y requiere inventario real antes de cualquier DROP.

## 9. Riesgos y mitigación

Riesgo principal: que exista un productor externo no visible en Railway que escriba en `batch_jobs`/`pipeline_runs` esperando estos workers.

Mitigaciones disponibles:

- no existe servicio Railway vivo asociado;
- los consumidores frontend actuales ya fueron trazados a caminos canónicos diferentes;
- `package.json` sólo conserva el launcher manual histórico `worker:lifecycle`;
- CI es el único consumidor repo confirmado adicional y se actualizará coordinadamente;
- no se toca la persistencia Neon en este lote, por lo que el rollback de código sigue siendo posible desde Git history.

## 10. Estado de `pikofilm-backup-temp`

Railway Agent aceptó su eliminación y la marcó para removal, pero `get-status` posterior todavía la muestra sin deployment. Se mantiene como `REMOVAL IN PROGRESS / VERIFY`; no se repite la eliminación mientras Railway propaga el cambio.

## 11. Decisión requerida

El lote P2-C se considera `LISTO PARA DECISIÓN`, con frontend=`NO` para el plano histórico y preservación explícita del read-model Lifecycle y de todos los caminos actuales.

No ejecutar ninguna eliminación de este bloque hasta autorización explícita del usuario.
