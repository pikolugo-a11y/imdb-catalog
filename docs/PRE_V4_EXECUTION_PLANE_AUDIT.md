# PikoFilm — Auditoría PRE-V4 del execution plane

Fecha: 2026-09-01  
Rama de trabajo: `pre-v4-readiness`  
Estado: **P1 en curso; sin cambios destructivos**

Este documento complementa `PRE_V4_AUDIT.md` con el cruce vivo GitHub ↔ Railway ↔ Vercel y deja decisiones provisionales reproducibles.

## 1. Railway vivo

Proyecto Railway: `PikoFilm Batch` (`f5e8a573-8715-4ed5-8689-54d456ea2de5`)  
Entorno: `production` (`39c3bd9c-5ce3-46e3-a8ea-1a80bcdc9497`)

Servicios observados:

| Servicio | Fuente | Runtime real | Estado | Clasificación P1 |
|---|---|---|---|---|
| `pikofilm-worker-api-v3` | `main` | `Dockerfile.batch-api` + `npm run worker:batch-api` | SUCCESS | **CANONICAL** |
| `pikofilm-batch-fast-worker-v1` | `main` | `Dockerfile.batch-fast` + `node worker/batch-fast-worker.mjs` | SUCCESS | **CANONICAL** |
| `pikofilm-technical-snapshot-worker-v1` | `feat/pikoquality-technical-snapshot` | `Dockerfile.technical` + `node worker/technical-snapshot-worker.mjs` | SUCCESS | **CANONICAL runtime / fuente a corregir** |
| `pikofilm-backup-temp` | imagen `postgres:18` | comando diagnóstico + `sleep 300` | sin deployment | **TEMP de alta confianza** |

## 2. Resolución de RAIL-004: FAST/API no son legacy funcional

La contradicción detectada en `worker/entrypoint.mjs` queda resuelta a nivel funcional.

El Batch V1 actual utiliza explícitamente pools `fast`, `api` y `plex` y encola trabajo en `batch_run_control` / `batch_run_items`. Los workers actuales reutilizan funciones canónicas:

### Pool API

`worker/batch-api-worker.mjs` ejecuta actualmente:

- `PROC-ID-001` → `executeId001Canonical`
- `PROC-IV-001` → `refreshIdentityEvidenceCanonical`
- `PROC-DATA-001` → `executeData001Canonical`
- `PROC-DATA-002` → `refreshRatingsCanonical`
- `PROC-SER-003` → `refreshSeriesUnitaryCanonical`
- `PROC-SER-004` → `confirmSeriesEsAvailabilityCanonical`
- `PROC-PER-001` → `refreshPersonFilmography`

Además usa gobernanza de fuentes/API y actualiza Lifecycle/read models donde corresponde.

### Pool FAST

`worker/batch-fast-worker.mjs` ejecuta actualmente:

- `PROC-DATA-003` → `executeData003Canonical`
- `PROC-MOV-001` → `executeMov001Canonical`
- `PROC-IV-002` → `validateIdentityCanonical`

### Conclusión

**Batch API y Batch FAST son parte de la arquitectura canónica actual y NO deben retirarse.**

La afirmación de `worker/entrypoint.mjs` que define `fast`/`api` como arquitectura retirada es una reliquia de otra generación. Ese entrypoint y la arquitectura `Dockerfile.worker` / `railway.lifecycle.toml` / `combined-worker.mjs` deben auditarse como LEGACY/DEAD, no utilizarse como evidencia contra los workers Batch V1 actuales.

## 3. Hallazgo crítico: falta el worker Plex de Batch V1

`lib/series-batch.js` define la arquitectura actual de Series Batch así:

- `PROC-SER-002` → pool `plex`, concurrency 1, executor `railway_batch_plex`
- `PROC-SER-003` → pool `api`
- `PROC-SER-004` → pool `api`

`worker/batch-plex-worker.mjs` existe y registra exactamente `PROC-SER-002` mediante `syncPlexSeriesDetailCore`.

Sin embargo Railway producción **no tiene ningún servicio Batch Plex activo**.

### Impacto

La UI/código desplegado puede crear items `PROC-SER-002` en pool `plex`, pero no existe en el inventario vivo un consumidor Railway para reclamarlos. Hasta poder leer Neon directamente no se puede afirmar si hay items actualmente atascados, pero arquitectónicamente falta el executor requerido.

**Clasificación:** DEFECTO OPERACIONAL / deuda PRE-V4 crítica.  
**Decisión provisional:** no borrar `railway.batch-plex.toml`, `Dockerfile.batch-plex` ni `worker/batch-plex-worker.mjs`. Son piezas necesarias de la arquitectura Batch V1 actual. Antes del Gate V4 debe existir un worker Plex operativo o cambiarse explícitamente la arquitectura para que otro executor consuma ese pool.

## 4. Arquitectura Lifecycle antigua: fuerte evidencia de LEGACY

`railway.lifecycle.toml` arranca `worker/combined-worker.mjs`, y éste inicia simultáneamente:

- `lifecycle-worker.mjs`
- `people-worker.mjs`
- `plex-reconcile-worker.mjs`

No existe actualmente un servicio Railway que use esta configuración.

Además, `worker/lifecycle-worker.mjs` depende de la arquitectura histórica `batch_jobs`, `batch_runs`, `batch_runtime_control`, `batch_source_limits` y, de forma explícita, `batch_job_steps`.

El repositorio contiene una migración y un workflow específicos para retirar `batch_job_steps` como legacy. Por tanto, salvo que el inventario Neon demuestre lo contrario, el antiguo Lifecycle worker es **incompatible conceptualmente con la arquitectura Batch V1 actual y candidato LEGACY de alta confianza**.

### Candidatos asociados

Quedan en clasificación LEGACY probable, pendientes de último chequeo de consumidores:

- `railway.lifecycle.toml`
- `Dockerfile.lifecycle`
- `worker/combined-worker.mjs`
- `worker/lifecycle-worker.mjs`
- executors `worker/lifecycle-*-executor.mjs`
- `worker/lifecycle-runtime.mjs`
- `lib/lifecycle-processes.mjs`
- posibles tablas/configuración `batch_jobs`, `batch_runs`, `batch_runtime_control`, `batch_source_limits` si Neon confirma ausencia de consumidores actuales.

No borrar todavía: primero se debe cruzar con UI, procesos manuales y esquema Neon.

## 5. Technical Snapshot: la rama feature ya no contiene delta propio

Comparación GitHub:

- `feat/pikoquality-technical-snapshot` está **0 commits por delante y 240 por detrás de `main`**.
- Su merge base es `0ade4e4eabbbb7bbeaacd376b03fa5b1e370ef51`.
- `worker/technical-snapshot-worker.mjs` en esa rama tiene el mismo blob SHA que el fichero actual observado en `main`: `40735fe98e5b1e551ef247bbf86c2e66a745d5ba`.
- En la comparación desde ese merge base hasta `main` no aparecen modificados `worker/technical-snapshot-worker.mjs`, `Dockerfile.technical`, `railway.technical.toml` ni las librerías `plex-technical-*` / observabilidad técnica importadas por el worker.

### Conclusión

La rama ya no aporta código técnico exclusivo: es una rama ancestral que Railway sigue usando como fuente.

**Acción PRE-V4 propuesta:** cambiar la fuente de `pikofilm-technical-snapshot-worker-v1` a `main`, verificar un deployment equivalente y sólo después retirar/archivear `feat/pikoquality-technical-snapshot`.

Esto es una corrección de reproducibilidad de infraestructura, no una reescritura funcional.

## 6. Railway configs: clasificación actualizada

| Pareja | Clasificación | Decisión provisional |
|---|---|---|
| `railway.batch-api.toml` + `Dockerfile.batch-api` | CANONICAL | conservar |
| `railway.batch-fast.toml` + `Dockerfile.batch-fast` | CANONICAL | conservar |
| `railway.batch-plex.toml` + `Dockerfile.batch-plex` | CANONICAL NECESARIO, servicio ausente | conservar y resolver despliegue |
| `railway.technical.toml` + `Dockerfile.technical` | CANONICAL | conservar; fuente Railway → `main` |
| `railway.api.toml` + `Dockerfile.api` | LEGACY alta confianza | borrar en P2 tras último chequeo |
| `railway.lifecycle.toml` + `Dockerfile.lifecycle` | LEGACY probable | borrar tras cerrar consumidores/esquema |
| `Dockerfile.worker` + `worker/entrypoint.mjs` | LEGACY/COMPATIBILITY probable | investigar consumidores; probablemente retirar |
| `railway.toml` global vacío/documental | COMPATIBILITY CONFIG | conservar mientras evite precedencia accidental; revaluar tras simplificación |

## 7. Vercel vivo

Equipo: `PikoFilm` (`team_6fBCnlAa2wA8DuuJtNbVzqaC`).

Se observan dos proyectos:

### Proyecto canónico probable

`imdb-catalog` (`prj_iApLZEUtSy3MTd6KT39PvagJrra2`)

- enlazado a `pikolugo-a11y/imdb-catalog`;
- Next.js;
- Node 24.x;
- tres dominios/aliases;
- despliegues de producción recientes desde `main`;
- último deployment observado READY: commit `b9ecdd824f9fbc15ad50855a6cc6ec5a0362835c` (merge PR #446 PER-002).

El `main` GitHub actual está 8 commits por delante de ese deployment; parte de ese delta incluye documentación PRE-V4 y aliases, por lo que esto no implica automáticamente un defecto de producción. Confirma que los deployments no siguen cada commit automáticamente, coherente con `vercel.json` (`deploymentEnabled: false`).

### Proyecto histórico probable

`imdb-catalog2` (`prj_kQwCLBVOiwZVdfQt1RgRxsUYTP6J`)

- enlazado al repo anterior `hpf6zr8jw5-sketch/imdb-catalog`;
- sin dominios actuales;
- último deployment READY mucho más antiguo;
- historial ligado al repositorio previo.

**Clasificación:** LEGACY/ORPHAN probable de alta confianza.  
**Acción:** antes de eliminarlo, confirmar que ningún dominio, variable, integración o rollback necesario depende de él. Después, candidato claro a limpieza de Vercel PRE-V4.

## 8. Cron Vercel

`vercel.json` mantiene:

`15 2 * * *` → `/api/cron/dashboard-snapshot`

Sigue pendiente decidir si es proceso automático canónico o deuda histórica. Debe entrar en `PROCESS_CATALOG.md` si se conserva.

## 9. Neon

Se descubrió una acción específica `get_database_tables`, pero el mismo defecto de contrato persiste: la herramienta expone `projectId`/`branchId` y el servidor interno exige `project_id`/`branch_id`, rechazando los argumentos antes de ejecutar la lectura.

**NEON-001 continúa bloqueado por el conector.** No se harán afirmaciones sobre tablas existentes ni borrados de datos basados sólo en migraciones.

## 10. Decisiones ya suficientemente sólidas para la matriz P1

| Elemento | Clasificación | Confianza |
|---|---|---:|
| Batch API worker | CANONICAL | Muy alta |
| Batch FAST worker | CANONICAL | Muy alta |
| Batch Plex worker/config | CANONICAL NECESARIO PERO NO DESPLEGADO | Muy alta |
| Technical Snapshot runtime | CANONICAL | Muy alta |
| fuente Railway Technical en rama feature | COMPATIBILITY/DEUDA INFRA | Muy alta |
| `railway.api.toml` | LEGACY/DEAD | Muy alta |
| arquitectura `combined-worker`/Lifecycle antigua | LEGACY probable | Alta |
| `pikofilm-backup-temp` | TEMP | Muy alta |
| Vercel `imdb-catalog` | CANONICAL | Muy alta |
| Vercel `imdb-catalog2` | LEGACY/ORPHAN probable | Alta |

## 11. Próximo bloque

1. Auditar consumidores de la arquitectura Lifecycle antigua y del generic `entrypoint`.
2. Trazar `sagas-v2`, `series-v2`, PikoScore generaciones y CSS generacional.
3. Revisar los 8 workflows y convertir la lista en decisión final.
4. Comparar las 11 PR abiertas con `main` y preparar cierre/consolidación.
5. Mantener pendiente Neon hasta que el conector permita inventario real.
6. Tras completar esas verificaciones, presentar el **primer lote P2 de borrados seguros** para aprobación antes de ejecutar cambios destructivos.
