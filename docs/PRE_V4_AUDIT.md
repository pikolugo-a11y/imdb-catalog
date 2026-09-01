# PikoFilm — Auditoría PRE-V4

> Documento de trabajo persistente para P0/P1. Complementa `PRE_V4_READINESS_PLAN.md` y registra evidencia antes de cualquier limpieza destructiva.
>
> Baseline V3: `dc5381afce4a628e9c36835c349cba97ff13ff82`
> Rama de trabajo: `pre-v4-readiness`
> Inicio: 2026-09-01

## Estado

**P0 BASELINE: EN CURSO / sustancialmente inventariado**  
**P1 AUDITORÍA: EN CURSO**  
**BORRADOS DESTRUCTIVOS: BLOQUEADOS hasta revisión de matriz.**

## 1. Baseline GitHub

- Rama por defecto: `main`.
- Baseline: `dc5381afce4a628e9c36835c349cba97ff13ff82`.
- Rama PRE-V4: `pre-v4-readiness`.
- Inventario observado: **345 ramas**. Existe una proliferación importante de ramas históricas `feat/`, `fix/`, `validate/`, `tmp/`, `noop/`, `ops/`, `architecture/`, etc. Esto es deuda de higiene de repositorio y requerirá una política de retención antes de eliminar ramas.
- PR abiertas observadas: **11** (#261, #258, #218, #217, #216, #215, #214, #213, #212, #211, #99). Varias son PR de validación antiguas o parten de baselines muy anteriores; se compararán con `main` antes de cerrarlas.
- Workflows presentes: 8.

## 2. Baseline Railway

Proyecto: `PikoFilm Batch`, entorno `production`.

Servicios observados:

| Servicio | Estado observado | Fuente/configuración | Clasificación inicial |
|---|---|---|---|
| `pikofilm-worker-api-v3` | deployment SUCCESS | `main`, `Dockerfile.batch-api`, `railway.batch-api.toml` | CANONICAL probable |
| `pikofilm-batch-fast-worker-v1` | deployment SUCCESS | `main`, `Dockerfile.batch-fast`, `railway.batch-fast.toml` | CANONICAL probable |
| `pikofilm-technical-snapshot-worker-v1` | deployment SUCCESS | **rama `feat/pikoquality-technical-snapshot`**, `Dockerfile.technical`, `railway.technical.toml` | INVESTIGAR / riesgo alto |
| `pikofilm-backup-temp` | sin deployment | imagen `postgres:18`; utilidad temporal de backup/diagnóstico | TEMP probable |

### Hallazgo RAIL-001 — Technical Snapshot no ejecuta desde `main`

El servicio técnico de producción está configurado contra `feat/pikoquality-technical-snapshot`, mientras el mismo runtime también existe en `main`. Esto rompe la expectativa de que producción sea reproducible desde el código canónico y bloquea la eliminación de esa rama.

**Acción propuesta:** comparar rama con `main`, identificar cualquier delta funcional necesario, integrar/canonizar lo que falte y sólo entonces mover Railway a `main` y retirar/archivear la rama histórica.

### Hallazgo RAIL-002 — Configuraciones Railway exceden servicios activos

El repo contiene:

- `railway.api.toml`
- `railway.batch-api.toml`
- `railway.batch-fast.toml`
- `railway.batch-plex.toml`
- `railway.lifecycle.toml`
- `railway.technical.toml`
- `railway.toml`

además de siete Dockerfiles Railway/worker. Railway vivo sólo muestra tres workers desplegados más `backup-temp`.

**Acción:** clasificar cada pareja TOML/Dockerfile contra servicios reales y contra consumidores indirectos antes de borrar.

### Hallazgo RAIL-003 — `railway.api.toml` apunta a un entrypoint inexistente

`railway.api.toml` declara `node worker/batch-api.mjs`; el árbol actual contiene `worker/batch-api-worker.mjs`, no `worker/batch-api.mjs`. El servicio API vivo usa `railway.batch-api.toml`, no este fichero.

**Clasificación inicial:** LEGACY/DEAD probable.  
**Acción:** comprobar que ningún servicio/branch externo lo consume y proponer borrado junto con `Dockerfile.api` si queda huérfano.

### Hallazgo RAIL-004 — Arquitecturas de worker contradictorias

`worker/entrypoint.mjs` afirma explícitamente que los kinds `fast` y `api` son legacy pre-Lifecycle y lanza error si se intentan activar; sin embargo Railway producción mantiene workers Batch FAST y Batch API activos mediante entrypoints específicos. A su vez `railway.lifecycle.toml` inicia `combined-worker.mjs`, que arranca Lifecycle + Personas + Plex Reconcile, pero no existe actualmente un servicio Railway Lifecycle en producción.

Esto no demuestra por sí solo que FAST/API sean legacy: demuestra que hay **dos generaciones de arquitectura coexistiendo en código/configuración** y que la documentación/guardias no representan de forma inequívoca el execution plane vivo.

**Prioridad P1: crítica.** Hay que decidir cuál arquitectura es realmente canónica antes de retirar workers.

## 3. Baseline Neon

- Proyecto: `pikofilm` (`red-silence-53441102`).
- PostgreSQL 18.
- Rama observada: `production` (`br-crimson-tooth-b2k4s1jw`), única rama en la inspección inicial.
- Tamaño lógico observado inicialmente: ~744 MB.
- No existe deuda de proliferación de ramas Neon en este momento.

### Bloqueo NEON-001 — inventario SQL directo

La acción SQL del conector presenta una incompatibilidad entre el schema expuesto (`projectId`/`branchId`) y el validador interno (`project_id`/`branch_id`). Se intentaron ambas formas y ambas fueron rechazadas por capas distintas del conector.

**Consecuencia:** todavía NO se considera completado el inventario de tablas/vistas/índices/triggers/tamaños.

**Regla:** no inferir objetos Neon sólo desde migraciones. Se buscará una vía de lectura alternativa antes de P3 destructivo.

## 4. Inventario físico inicial del repositorio

### 4.1 Workers presentes

El árbol contiene actualmente:

- `batch-api-worker.mjs`
- `batch-fast-worker.mjs`
- `batch-plex-worker.mjs`
- `combined-worker.mjs`
- `entrypoint.mjs`
- `imdb-discovery.mjs`
- `lifecycle-worker.mjs` + executors de identity/validation/data/pikoscore/movie-file/series/tech
- `people-worker.mjs` + executor
- `plex-reconcile-worker.mjs`
- `technical-snapshot-worker.mjs`
- dos resolvers FA Python locales/CLI

Esto invalida cualquier documentación antigua que describa `worker/` como compuesto únicamente por Discovery y ratings.

### 4.2 Dos raíces de migraciones

`db/migrations/` contiene las migraciones recientes de observabilidad, Batch Engine/API y fingerprint físico; `migrations/` contiene dos migraciones PikoQuality Technical del 27/08.

**Clasificación:** DUPLICATE-STRUCTURE / INVESTIGAR.  
**Objetivo:** una sola ubicación canónica para nuevas migraciones y una política clara para históricas/aplicadas.

### 4.3 Temporales/diagnósticos de alta confianza

Candidatos TEMP fuertes:

- workflow `revalidate-mov001-tt8442644.yml`;
- `scripts/revalidate-mov001-once.mjs`;
- `ops/diagnose/tt8442644.*`;
- `ops/revalidate/tt8442644.*`;
- `tmp/validate-saga-availability-*` (múltiples versiones y blobs repetidos);
- `ci/sagas-v2-pr.txt`;
- `ci/sagas-v2-validation.txt`.

El workflow `revalidate-mov001-tt8442644.yml` está explícitamente limitado a un único IMDb y sólo se dispara por cambios de un fichero marcador concreto. Es un patrón one-shot, no infraestructura de producto.

**Decisión provisional:** BORRAR en P2 tras comprobar que la incidencia ya está cerrada y que ninguna prueba actual depende de estos marcadores.

### 4.4 Workflow de DROP legacy

`drop-legacy-batch-job-steps.yml` sólo se dispara en la rama `cleanup/drop-batch-job-steps-direct` y existe para auditar/eliminar una tabla que su propio nombre define como legacy.

**Clasificación:** TEMP / MIGRATION ONE-SHOT probable.  
**Acción:** verificar que `batch_job_steps` ya no existe y después retirar workflow; conservar o mover la migración a la política histórica que se acuerde.

### 4.5 `neon-access-check.yml`

Es un workflow manual que únicamente comprueba conexión, database/role/tamaño/versión. No contiene lógica de producto.

**Clasificación:** OPERATIONS UTILITY, no necesariamente legacy.  
**Decisión pendiente:** conservar como herramienta de diagnóstico documentada o sustituir por runbook/health check canónico.

## 5. Coexistencia generacional — hotspots

### CSS/UI

Se observan, entre otros:

- `app/v1.css`, `v12.css`, `v2.css`, `v3-shell.css`;
- `home-dashboard.css`, `home-dashboard-v2.css`, `home-dashboard-v4.css`;
- `catalog-v3.css`, `catalog-r4.css`;
- `series-command.css`, `series-command-v3.css`;
- `people-v2.css`, `excluded-v3.css`.

No se borrará ninguno por nombre. P1 debe trazar imports efectivos y decidir cuál es canónico, qué reglas siguen vivas y si se consolidan nombres para V4.

### Librerías

Hotspots que requieren mapa de consumidores:

- `sagas-v2.js` / `sagas-v3.js`;
- `series-v2.js` y capas modernas de Series;
- `pikoscore.js`, `pikoscore-core.mjs`, `pikoscore-v3.js`, `pikoscore-v3-core.mjs`;
- `people-v2.js`;
- `catalog-v3-queries.js`;
- `plex-queries-v2.js`;
- `news-v1.js`;
- múltiples capas PikoQuality/Technical;
- wrappers unitary/batch/canonical.

Primer dato confirmado: `/sagas` importa `getSagasDashboard` desde `@/lib/sagas-v3`; por tanto `sagas-v3` está vivo. `sagas-v2` queda en INVESTIGAR hasta revisar detalle/acciones/otros consumidores.

### Wrappers sin extensión

- `lib/db` contiene únicamente `export * from './db.js';`.
- `lib/process-runtime` contiene únicamente `export * from './process-runtime.js';`.

Son aliases de compatibilidad potenciales.

**Acción:** buscar importadores exactos. Si no existen, BORRAR; si existen, migrar imports explícitos y después BORRAR para reducir resolución ambigua.

## 6. Vercel / automatismos

`vercel.json` tiene deployments Git deshabilitados y un cron diario `15 2 * * *` que invoca `/api/cron/dashboard-snapshot`.

### Hallazgo AUTO-001 — cron automático contradictorio con documentación/manual-only

La existencia del cron confirma la duda registrada en #273: hay al menos una automatización programada activa en configuración de aplicación.

**Acción:** documentar exactamente qué escribe `dashboard-snapshot`, su coste/retención y decidir si forma parte de la arquitectura final o si debe retirarse.

## 7. Documentación

Existen documentos V2, varios roadmaps históricos, notas de hotfix, múltiples fórmulas candidatas/frozen/final de PikoQuality y un inventario parcial de procesos.

**Clasificación global inicial:** CONSOLIDAR.  
No se borrarán antes de extraer decisiones todavía vigentes hacia la documentación canónica P6.

## 8. Riesgos principales detectados hasta ahora

| ID | Riesgo | Severidad | Estado |
|---|---|---:|---|
| RAIL-001 | Servicio técnico en rama feature, no `main` | Alta | INVESTIGAR |
| RAIL-004 | FAST/API activos pero entrypoint genérico los declara retirados | Crítica | INVESTIGAR |
| GH-001 | 345 ramas históricas | Media | INVENTARIADO |
| GH-002 | 11 PR abiertas antiguas/validación | Media | INVESTIGAR |
| DB-001 | dos raíces de migraciones | Media | INVESTIGAR |
| AUTO-001 | cron Vercel automático no reflejado claramente en estado documental | Media | INVESTIGAR |
| DOC-001 | documentación de arquitectura no coincide con ejecución viva | Alta | CONFIRMADO |
| TEMP-001 | artefactos one-shot/diagnóstico dentro de `main` | Baja/Media | CANDIDATO BORRAR |
| NEON-001 | bloqueo del conector para inventario SQL | Alta para P3 | BLOQUEADO |

## 9. Primera matriz de decisiones — BORRADOR, no ejecutar todavía

| Elemento | Clasificación inicial | Acción propuesta | Confianza |
|---|---|---|---|
| `revalidate-mov001-tt8442644.yml` + marcadores/script tt8442644 | TEMP | BORRAR como bloque | Alta |
| `tmp/validate-saga-availability-*` | TEMP | BORRAR | Alta |
| `ci/sagas-v2-*.txt` | TEMP | BORRAR si CI no los consume | Alta |
| `drop-legacy-batch-job-steps.yml` | TEMP one-shot | BORRAR tras verificar DB | Alta |
| `railway.api.toml` | LEGACY probable | BORRAR tras verificar consumidores | Alta |
| `Dockerfile.api` | LEGACY probable | BORRAR con `railway.api.toml` si queda huérfano | Media/Alta |
| `pikofilm-backup-temp` Railway | TEMP probable | ELIMINAR servicio tras confirmar propósito | Alta |
| rama `feat/pikoquality-technical-snapshot` | COMPATIBILITY LIVE | NO BORRAR; canonizar primero | Alta |
| `railway.lifecycle.toml` / `combined-worker.mjs` | UNKNOWN | INVESTIGAR | Alta |
| `railway.batch-plex.toml` / worker Plex | UNKNOWN | INVESTIGAR | Alta |
| `lib/sagas-v3.js` | CANONICAL (overview confirmado) | CONSERVAR; posible renombre futuro | Alta |
| `lib/sagas-v2.js` | UNKNOWN | INVESTIGAR | Media |
| `lib/db` alias | COMPATIBILITY/DEAD | revisar importadores; probable BORRAR | Media |
| `lib/process-runtime` alias | COMPATIBILITY/DEAD | revisar importadores; probable BORRAR | Media |
| dos raíces de migrations | DUPLICATE STRUCTURE | CONSOLIDAR | Alta |
| cron `dashboard-snapshot` | CANONICAL o LEGACY pendiente | INVESTIGAR funcionalidad/coste | Alta |
| docs V2/roadmaps/notas hotfix | HISTORICAL | CONSOLIDAR y retirar después | Alta |
| ramas antiguas | HISTORICAL | limpieza masiva con allowlist | Alta |
| PR antiguas | HISTORICAL/SUPERSEDED probable | comparar y cerrar | Alta |

## 10. Siguiente bloque P1

1. Resolver mapa real de execution plane: Batch FAST/API/Plex vs Lifecycle/combined/People/Technical.
2. Revisar todos los TOML/Dockerfiles y sus consumidores.
3. Comparar `feat/pikoquality-technical-snapshot` con `main`.
4. Trazar imports de aliases/versiones CSS y librerías V1/V2/V3.
5. Revisar los 8 workflows uno por uno.
6. Revisar `dashboard-snapshot` y retención.
7. Clasificar PR abiertas mediante `compare`.
8. Definir allowlist de ramas que no pueden borrarse.
9. Seguir buscando vía de lectura de esquema Neon.

---

Última actualización: 2026-09-01. Este documento debe actualizarse conforme se cierren hallazgos.