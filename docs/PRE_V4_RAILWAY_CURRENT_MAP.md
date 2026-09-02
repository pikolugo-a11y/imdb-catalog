# PikoFilm — PRE-V4 · Mapa Railway vigente

Fecha: 2026-09-02  
Proyecto Railway: `PikoFilm Batch`

## Regla de clasificación

La nomenclatura histórica NO determina vigencia. Un servicio llamado `batch-*`, `worker-*`, `*-v1` o `*-v2` puede ser parte del Centro de Operaciones / Batch Engine actual.

La clasificación se basa en:

`servicio → source → Dockerfile → start command → worker → runtime/tablas → PROC adapters → consumidor frontend`.

## Servicios productivos

### `pikofilm-batch-fast-worker-v1`

**Clasificación:** CURRENT / PROTECTED.

- source: `pikolugo-a11y/imdb-catalog`, branch `main`;
- Dockerfile: `Dockerfile.batch-fast`;
- start: `node worker/batch-fast-worker.mjs`;
- variables de responsabilidad: `BATCH_FAST_CAPACITY`, `BATCH_HEARTBEAT_MS`, `BATCH_IDLE_MS`, `BATCH_LEASE_SECONDS`, `DATABASE_URL`, `PIKOFILM_WORKER_KIND`;
- runtime: `lib/batch-worker-runtime.mjs`;
- modelo: `process_runs` + `batch_run_control` + `batch_run_items` + `batch_engine_control`;
- adapters auditados: `PROC-DATA-003`, `PROC-MOV-001`, `PROC-IV-002`.

El sufijo `v1` es sólo histórico. NO es evidencia de legacy.

### `pikofilm-worker-api-v3`

**Clasificación:** CURRENT / PROTECTED.

- source: repo `pikolugo-a11y/imdb-catalog`, branch `main`;
- Dockerfile: `Dockerfile.batch-api`;
- config: `railway.batch-api.toml`;
- start: `npm run worker:batch-api`;
- variables: `BATCH_API_CAPACITY`, `BATCH_API_WORKER_ID`, `BATCH_LEASE_SECONDS`, `BATCH_POLL_MS`, `DATABASE_URL`, credenciales de fuentes API y `PIKOFILM_WORKER_KIND`;
- último deployment auditado: SUCCESS;
- log de arranque confirma `worker/batch-api-worker.mjs`;
- adapters en runtime: `PROC-ID-001`, `PROC-IV-001`, `PROC-DATA-001`, `PROC-DATA-002`, `PROC-SER-003`, `PROC-SER-004`, `PROC-PER-001`.

Existe warning Node `MODULE_TYPELESS_PACKAGE_JSON`; es deuda menor de runtime, no un fallo de servicio. No añadir `type: module` globalmente sin auditoría porque podría afectar el resto de la aplicación.

### `pikofilm-batch-plex-worker-v2`

**Clasificación:** CURRENT / PROTECTED.

- source: repo `pikolugo-a11y/imdb-catalog`, branch `main`;
- Dockerfile: `/Dockerfile.batch-plex`;
- start: `npm run worker:batch-plex`;
- variables: `BATCH_HEARTBEAT_MS`, `BATCH_IDLE_MS`, `BATCH_PLEX_CAPACITY`, `DATABASE_URL`, `PLEX_TOKEN`;
- último deployment auditado: SUCCESS;
- pool operativo actual para `PROC-SER-002`.

Este servicio fue creado durante PRE-V4 para resolver la ausencia real del executor Plex. No pertenece al antiguo `/admin/batch` aunque conserve `batch` en el nombre.

### `pikofilm-technical-snapshot-worker-v1`

**Clasificación:** CURRENT / PROTECTED / FRONTEND-CONSUMED.

- source: repo `pikolugo-a11y/imdb-catalog`, branch `main`;
- Dockerfile: `Dockerfile.technical`;
- config: `railway.technical.toml`;
- start: `node worker/technical-snapshot-worker.mjs`;
- restart policy: `NEVER`;
- variables: `DATABASE_URL`, `PIKOFILM_WORKER_KIND`, `PLEX_TOKEN`, `TECHNICAL_SNAPSHOT_*`;
- último deployment auditado: SUCCESS;
- frontend: Calidad → PikoQuality → controles `Iniciar/Reanudar/Pausar/Detener` de `PROC-PQ-002`.

La antigua rama de source `feat/pikoquality-technical-snapshot` ya fue reemplazada por `main` y retirada.

## Servicios retirados durante PRE-V4

- `pikofilm-backup-temp`: retirado tras aprobación; no formaba parte del execution plane actual.
- servicio Plex accidental v1 creado durante la remediación: retirado después de validar `pikofilm-batch-plex-worker-v2`.

## Conclusión

Railway queda actualmente con cuatro responsabilidades reales y trazadas. No hay evidencia para eliminar ninguno de estos cuatro servicios.

La limpieza PRE-V4 de `Admin/Batch` se limita a la generación antigua de UI/modelo, no a estos executors. Cualquier futura normalización de nombres debe tratarse como rename operativo independiente y sólo después de verificar que no rompe referencias/configuración.
