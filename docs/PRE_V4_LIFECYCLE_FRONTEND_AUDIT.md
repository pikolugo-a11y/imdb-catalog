# PRE-V4 — Lifecycle frontend / execution-plane audit

## Objetivo

Separar con evidencia dos conceptos que comparten el nombre `Lifecycle` pero no deben limpiarse como un único bloque:

1. **Lifecycle de producto/read-model**, que alimenta el frontend actual.
2. **Lifecycle worker histórico**, una generación de ejecución Batch anterior.

La regla `PRE_V4_FRONTEND_SAFETY_GATE.md` se aplica a ambos por separado.

## LFC-001 — Lifecycle de catálogo: PROTEGIDO POR FRONTEND

Estado frontend: `INDIRECTO — FRONTEND-CONSUMED`.

`lib/catalog-v3-queries.js` importa `attachLifecycle` desde `lib/lifecycle.js`. `getCatalogV3()` consulta el catálogo actual y devuelve `attachLifecycle(rows)`.

`lib/lifecycle.js` lee `catalog_lifecycle` y adjunta a cada título el estado, etiqueta, área y tono definidos por `lifecycle-recompute-core.mjs`.

El catálogo visible utiliza estos valores para mostrar el flujo de cada título y enlazar al área de Calidad correspondiente. Por tanto quedan protegidos, mientras el frontal actual los consuma:

- `lib/lifecycle.js` en su faceta de lectura/adjunto del read-model;
- `lib/lifecycle-recompute-core.mjs` y su definición de estados, en la medida necesaria para mantener el read-model;
- tabla/read-model `catalog_lifecycle`;
- las etiquetas/rutas/tone de Lifecycle utilizadas en Catálogo.

**Conclusión:** no borrar `Lifecycle` como concepto ni `catalog_lifecycle` por asociación con el worker viejo.

## LFC-002 — El core de clasificación actual también está alineado con áreas frontend actuales

`lifecycle-recompute-core.mjs` define estados y destinos visibles como:

- IDENTITY_PENDING → `/calidad/identidad`
- IDENTITY_VALIDATION / REVIEW → `/calidad/validacion-identidad`
- DATA_INCOMPLETE / PIKOSCORE_PENDING → `/calidad/datos`
- MOVIE_FILE_PENDING / REVIEW → `/calidad/peliculas`
- SERIES_SYNC_PENDING / REVIEW → `/calidad/series`
- TECH_PENDING → `/calidad/pikoquality`
- COMPLETE → `/catalogo`
- EXCLUDED → `/catalogo/excluidas`

Esto confirma que el read-model Lifecycle sigue formando parte de la navegación/diagnóstico visual del producto.

## LFC-003 — Worker Lifecycle histórico: candidato LEGACY, pero no borrar todavía

Estado frontend del **worker histórico**: `NO DIRECTO ENCONTRADO / INDIRECTO AÚN POR CERRAR`.

El plano histórico está compuesto por:

- `railway.lifecycle.toml`
- `Dockerfile.lifecycle`
- `worker/combined-worker.mjs`
- `worker/lifecycle-worker.mjs`
- `worker/lifecycle-runtime.mjs`
- `worker/lifecycle-*-executor.mjs`
- `lib/lifecycle-processes.mjs`
- tablas históricas `batch_jobs`, `batch_runs`, `batch_runtime_control`, `batch_source_limits`, `batch_job_steps`

`railway.lifecycle.toml` arranca `worker/combined-worker.mjs`; el Dockerfile hace lo mismo. `combined-worker.mjs` lanza tres procesos: Lifecycle, Personas y Plex Reconcile.

El `lifecycle-worker.mjs` reclama trabajos desde `batch_jobs`/`batch_runs` con `orchestration='lifecycle'` y depende explícitamente de `batch_runtime_control`, `batch_source_limits` y `batch_job_steps`.

No existe servicio Railway productivo observado usando `railway.lifecycle.toml`.

### Advertencia de seguridad

Aunque el worker histórico parece legado, **no se puede borrar todavía como bloque** por dos motivos:

1. El read-model `catalog_lifecycle` sí está consumido por el frontend. Antes hay que demostrar quién lo mantiene hoy y que la retirada del worker antiguo no dejaría de actualizarlo.
2. `combined-worker.mjs` incluye también People y Plex Reconcile; hay que verificar que sus responsabilidades ya tienen reemplazo canónico antes de retirar el launcher y sus ejecutores.

Por tanto la clasificación correcta en este punto es:

- read-model Lifecycle: `CANONICAL / FRONTEND-CONSUMED`;
- worker Lifecycle histórico: `LEGACY PROBABLE / INVESTIGAR DEPENDENCIAS INDIRECTAS`;
- borrado del worker histórico: `BLOQUEADO` hasta cerrar mantenimiento actual de `catalog_lifecycle` + People + Plex Reconcile.

## LFC-004 — One-shot MOV-001 tt8442644

Estado frontend: `NO` para el workflow/script específico, sujeto a última comprobación de referencias externas.

La workflow `.github/workflows/revalidate-mov001-tt8442644.yml` no se dispara desde UI: sólo se activa por `push` a `main` cuando cambia el marcador `ops/revalidate/tt8442644.final`.

La workflow ejecuta exclusivamente:

`node scripts/revalidate-mov001-once.mjs tt8442644`

El script es un CLI genérico de una sola ejecución que recibe un IMDb ID por `process.argv`, abre Neon mediante `DATABASE_URL` y llama al core canónico `executeMov001Canonical` antes/después de sacar snapshots. No contiene interfaz ni Server Action.

Los marcadores inspeccionados documentan explícitamente diagnóstico/revalidación puntual de `tt8442644`, incluida la causa raíz del fingerprint Unicode y la revalidación final.

Esto confirma que **MOV-001 canónico sigue protegido por frontend**, pero esta maquinaria específica de `tt8442644` es una envoltura de diagnóstico one-shot separada.

Candidato P2 preliminar:

- `.github/workflows/revalidate-mov001-tt8442644.yml`
- `scripts/revalidate-mov001-once.mjs`
- `ops/diagnose/tt8442644.*`
- `ops/revalidate/tt8442644.*`

Clasificación provisional: `TEMP / DIAGNOSTIC / FRONTEND=NO`.

Antes de pedir autorización de borrado se hará una última comprobación de referencias del repositorio y se preservará en documentación la causa raíz útil si no está ya recogida en docs/issue.

## LFC-005 — Quién mantiene hoy `catalog_lifecycle`

La arquitectura canónica actual sí recompone Lifecycle fuera del worker histórico.

Evidencia:

- `worker/batch-api-worker.mjs` importa `recomputeLifecycleWithSql` y lo ejecuta explícitamente tras IV-001 y DATA-002. También dispone de una transición específica para ID-001.
- `worker/batch-fast-worker.mjs` importa `recomputeLifecycleWithSql` y lo ejecuta después de IV-002.
- los procesos SER-003/SER-004 devuelven el Lifecycle calculado por sus cores canónicos.
- `executeData003Canonical` persiste PikoScore y después recalcula/persiste `catalog_lifecycle`.
- `executeMov001Canonical` recalcula explícitamente la fase de película y actualiza `catalog_lifecycle`.

**Conclusión:** el mantenimiento del read-model Lifecycle ya existe dentro de caminos canónicos Batch/API/FAST/unitarios. Por tanto no depende en exclusiva del antiguo `worker/lifecycle-worker.mjs`.

### Deuda detectada LFC-DUP-001

`lib/data003-canonical.mjs` contiene una copia local sustancial de la clasificación Lifecycle (`classify`, `reason`, consulta de estado y upsert de `catalog_lifecycle`) en vez de reutilizar `lifecycle-recompute-core.mjs`.

`lib/mov001-canonical.mjs` también contiene una transición parcial local (`recomputeMovieStage`) para los estados de película.

Esto no es motivo de borrado inmediato porque ambos procesos están vivos, pero sí deuda PRE-V4: **consolidar la escritura de Lifecycle en un único core canónico** para evitar divergencias de reglas.

Clasificación:

- `lifecycle-recompute-core.mjs`: `CANONICAL`.
- lógica duplicada DATA-003: `DUPLICATE / CONSOLIDAR`.
- transición parcial MOV-001: `COMPATIBILITY / CONSOLIDAR`.

## LFC-006 — People histórico frente a People canónico

El launcher antiguo arranca `worker/people-worker.mjs`. Ese worker consume la generación histórica `batch_jobs` / `batch_runs` y ejecuta `worker/people-executor.mjs`.

Sin embargo, la superficie actual de Personas usa otra arquitectura:

- `/personas/[id]` muestra el botón **Actualizar perfil y filmografía**.
- ese botón llama `refreshPersonFilmographyAction`.
- la Server Action llama directamente `refreshPersonFilmography` de `lib/people-v2.js`.
- `refreshPersonFilmography` está observado como `PROC-PER-001`, executor `vercel` para el flujo individual.

Además existe Batch Personas actual:

- `/calidad/personas` → `startPeopleBatchAction` → `startPeopleBatch`.
- `startPeopleBatch` crea `batch_run_control`/`batch_run_items`, pool `api`, executor `railway_batch_api`.
- `worker/batch-api-worker.mjs` registra `PROC-PER-001` y reutiliza **la misma función canónica `refreshPersonFilmography` de `lib/people-v2.js`**.

Por tanto hay dos caminos actuales coherentes —individual Vercel y Batch API— que reutilizan el mismo core de Personas.

`worker/people-worker.mjs` + `worker/people-executor.mjs` implementan una generación distinta basada en tablas históricas y duplican gran parte de la lógica TMDb/filmografía.

Clasificación actual:

- `lib/people-v2.js`: `CANONICAL / FRONTEND-CONSUMED`.
- Batch `PROC-PER-001` sobre Batch API: `CANONICAL / FRONTEND-CONSUMED`.
- `worker/people-worker.mjs`: `LEGACY PROBABLE`.
- `worker/people-executor.mjs`: `DUPLICATE / LEGACY PROBABLE`.

Gate para borrado: confirmar que no existe productor vivo de `batch_jobs` con `orchestration='people'` ni dependencia externa. A nivel frontend actual, el People worker histórico **no es necesario** para los dos flujos visibles encontrados.

## LFC-007 — Plex Reconcile histórico es un DEBUG PROBE, no un reconciliador completo

`worker/plex-reconcile-worker.mjs`, arrancado por el antiguo `combined-worker`, contiene señales inequívocas de implementación temporal/diagnóstica:

- reclama `pipeline_runs` con `job_type='plex_full_reconcile'`;
- registra `stage:'debug_probe'`;
- fija `probe_limit:5`;
- selecciona `plex_items ... LIMIT 5`;
- termina con `stage:'debug_probe_done'`;
- el propio proceso escribe `plex-reconcile-worker listo DEBUG PROBE 5`.

Esto significa que el nombre `plex_full_reconcile` no describe la ejecución real actual de ese worker: sólo procesa cinco elementos tras un baseline.

La operación visible de Novedades **Actualizar Plex** ya fue trazada por el frontend gate y usa el camino canónico `syncPlexFromNews` / `syncPlexFast`, ejecutado en Vercel; SER-002 usa por separado el Batch Plex canónico.

Por tanto el `plex-reconcile-worker.mjs` del launcher histórico no debe confundirse con ninguno de esos dos flujos protegidos.

Clasificación: `TEMP/DEBUG + LEGACY PROBABLE`, con alta prioridad para retirar o reemplazar documentalmente tras verificar si queda algún productor real de `pipeline_runs.job_type='plex_full_reconcile'`.

Riesgo: si se mantuviera creyendo que hace una reconciliación completa, produciría una falsa sensación de cobertura porque sólo procesa cinco items.

## LFC-008 — Temporales Sagas/CI

El directorio `tmp/` del branch contiene exclusivamente una familia de validaciones `validate-saga-availability-*`: `main` y versiones `v2` a `v11`; múltiples versiones incluso comparten el mismo blob SHA, lo que confirma repetición de marcadores/artefactos de validación.

El directorio `ci/` sólo contiene:

- `sagas-v2-pr.txt`
- `sagas-v2-validation.txt`

La workflow CI actual no referencia `tmp/` ni esos dos ficheros `ci/`; sus pasos ejecutan checks de Node, selfcheck PikoScore, `test:quality` y build.

Además las páginas Sagas actuales ya están trazadas sobre `sagas-v3`.

Clasificación provisional:

- `tmp/validate-saga-availability-*`: `TEMP / FRONTEND=NO / CANDIDATO P2`.
- `ci/sagas-v2-pr.txt`: `TEMP / FRONTEND=NO / CANDIDATO P2`.
- `ci/sagas-v2-validation.txt`: `TEMP / FRONTEND=NO / CANDIDATO P2`.

Antes de borrar: comprobar que ninguna workflow histórica todavía abierta o PR pendiente usa estos artefactos como marcador; el CI actual no los consume.

## P2-A — Primer lote destructivo aprobado y ejecutado

Autorización explícita del usuario recibida el 2026-09-01 con **“Adelante”** sobre el lote presentado.

Se eliminaron **únicamente** en la rama `pre-v4-readiness` los elementos previamente clasificados con `FRONTEND=NO`:

- `.github/workflows/revalidate-mov001-tt8442644.yml`
- `scripts/revalidate-mov001-once.mjs`
- `ops/diagnose/tt8442644.fix-note`
- `ops/diagnose/tt8442644.once`
- `ops/diagnose/tt8442644.trigger`
- `ops/revalidate/tt8442644.final`
- `ops/revalidate/tt8442644.once`
- `tmp/validate-saga-availability-main.txt`
- `tmp/validate-saga-availability-v2.txt` … `v11.txt`
- `ci/sagas-v2-pr.txt`
- `ci/sagas-v2-validation.txt`

Verificación posterior: la ruta `tmp/` ya no existe en el branch tras retirar todos sus artefactos, confirmando que el directorio contenía únicamente estos temporales.

No se tocó:

- MOV-001 canónico;
- Sagas V3;
- Batch API/FAST/Plex;
- Lifecycle read-model;
- Railway/Neon/Vercel;
- PRs o ramas;
- ningún control o flujo con consumidor frontend `SÍ`/`INDIRECTO`.

**Resultado P2-A:** `COMPLETADO`.

## Estado tras este bloque

Se reduce significativamente el bloqueo del antiguo launcher Lifecycle:

- mantenimiento actual de `catalog_lifecycle`: **demostrado en caminos canónicos**;
- People histórico: **reemplazo canónico visible + Batch API demostrado**;
- Plex Reconcile histórico: **identificado como DEBUG PROBE 5, no reconciliador completo**;
- primer lote TEMP/diagnóstico: **eliminado tras autorización explícita y gate frontend=NO**.

## Próximo gate

1. Buscar productores/referencias restantes de `orchestration='people'`, `plex_full_reconcile` y `batch_jobs` Lifecycle.
2. Terminar la clasificación de los PR abiertos y rescatar únicamente ideas útiles de #258/#261/#99.
3. Construir allowlist de ramas que deben conservarse.
4. Preparar el siguiente lote P2 con evidencia de consumidor frontend por elemento.

**Estado:** P2-A completado; Lifecycle read-model protegido y ejecución histórica todavía pendiente de último gate externo antes de borrado.
