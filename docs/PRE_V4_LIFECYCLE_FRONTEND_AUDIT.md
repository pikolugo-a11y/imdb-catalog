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

## Próximo gate

1. Trazar quién recompone `catalog_lifecycle` en las operaciones canónicas actuales.
2. Separar People y Plex Reconcile del launcher histórico y comprobar reemplazos vivos.
3. Terminar referencias de `tt8442644` y temporales Sagas/CI.
4. Presentar al usuario el primer lote P2 sólo cuando todos sus miembros tengan frontend=`NO` demostrado.

**Estado:** auditoría Lifecycle abierta; read-model protegido; ejecución histórica todavía bloqueada para borrado.
