# PikoFilm — PRE-V4 · Generaciones de Batch / ADMIN

Fecha: 2026-09-02  
Rama: `pre-v4-readiness`

## 1. Decisión cerrada

Roberto confirma que **Admin/Batch fue la primera versión y ya no existe funcionalmente como producto**. La decisión PRE-V4 es retirar por completo esa generación y conservar como superficie canónica el **Centro de Operaciones `/admin`**, junto con los controles Batch situados en las páginas funcionales de Calidad.

Regla crítica: **el nombre `batch` no clasifica una pieza como legacy**. Algunos servicios Railway, workers, Dockerfiles y helpers mantienen ese término porque fueron reaprovechados o forman parte del Batch Engine actual. Se clasifican por su implementación y consumidores reales, nunca por nomenclatura.

## 2. Modelo antiguo retirado

La primera generación vivía bajo `app/admin/batch/` y usaba:

- `lib/batch-control.js`;
- `lib/batch-ui-metrics.js`;
- `lib/batch-source-control.js`;
- tablas `batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits`, `batch_runtime_control`;
- además intentaba leer la ya retirada `batch_job_steps`.

La ruta ofrecía UI propia para crear runs genéricos por etapas, pausar motor, administrar fuentes y abrir detalles de jobs. No aparecía en la navegación principal vigente, pero seguía siendo una ruta frontend directa; por eso su retirada pasó por el Frontend Safety Gate y fue aprobada expresamente por Roberto.

Retirada en `pre-v4-readiness`:

- `app/admin/batch/AutoRefresh.js`
- `app/admin/batch/actions.js`
- `app/admin/batch/batch.css`
- `app/admin/batch/compact.css`
- `app/admin/batch/layout.js`
- `app/admin/batch/page.js`
- `app/admin/batch/job/[id]/page.js`
- `app/admin/batch/personas/page.js`

Commit: `936ac4f0dc409d22968d2932aa7becc2c60e6b55`.

Después de retirar la única superficie consumidora conocida, se retiraron también los tres helpers exclusivos de esa generación:

- `lib/batch-control.js`
- `lib/batch-ui-metrics.js`
- `lib/batch-source-control.js`

Commit: `ffc8586b1d9722cc6581a5f6b5f5f9377abf8837`.

No se ha hecho deployment ni push destructivo sobre `main` durante esta limpieza.

## 3. Modelo actual protegido

Los workers Railway actuales usan el modelo común:

- `process_runs` / `process_run_events` / `process_run_errors`;
- `batch_run_control` / `batch_run_items` / `batch_engine_control`;
- child runs individuales por proceso estable (`PROC-*`);
- pools FAST/API/Plex.

`lib/batch-worker-runtime.mjs` crea child runs en `process_runs`, registra eventos/errores en el modelo común y gobierna items mediante `batch_run_items`.

El Centro de Operaciones `/admin` usa `getOperationsOverview()` y `OperationsBatchControl`; este último lee `batch_engine_control` y `batch_run_control`.

También son actuales los Batch lanzados desde las páginas funcionales, por ejemplo Identidad, Validación, Datos, Películas, Series y Personas. Sus archivos pueden contener `batch` en el nombre, pero pertenecen al motor vigente y quedan protegidos.

## 4. Railway: nombres reutilizados, no borrar por nombre

Los servicios activos deben auditarse por su worker/configuración real. En particular, `pikofilm-batch-fast-worker-v1` ejecuta `worker/batch-fast-worker.mjs`, que importa `lib/batch-worker-runtime.mjs`, reclama `batch_run_items` y ejecuta adapters `PROC-*`. Por tanto es **CURRENT** aunque el nombre conserve `batch` y sufijo `v1`.

La misma regla se aplica a los servicios FAST/API/Plex y a sus `Dockerfile.batch-*` / `railway.batch-*.toml`: no se consideran restos de `/admin/batch` por nomenclatura.

## 5. Objetos de base de datos antiguos

Los objetos `batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits` y `batch_runtime_control` pertenecían a la primera generación. Tras retirar su UI/helpers quedan como **candidatos a retirada física**, pero NO se borrarán todavía:

1. hay que completar la comprobación de referencias residuales de código/documentación/tests;
2. la retirada de objetos Neon pertenece a P3;
3. P3 sigue bloqueada por `NEON-001` (incompatibilidad del conector SQL disponible).

`batch_job_steps` ya había sido retirado previamente y era precisamente una lectura residual que rompía la vieja pantalla.

## 6. Estado de issues

- #190, que proponía reconstruir el antiguo Lifecycle Control Center sobre `/admin/batch`, queda cerrado `not planned`: no se reconstruirá esa pantalla.
- #272 conserva la decisión arquitectónica vigente: las páginas funcionales lanzan/deciden y `/admin` observa, gobierna y diagnostica.

## 7. Resultado PRE-V4

- `/admin/batch`: **RETIRED** en la rama PRE-V4.
- `/admin`: **CANONICAL OPERATIONS UI**.
- Batch Engine actual (`process_runs` + `batch_run_control` + `batch_run_items` + `batch_engine_control`): **CURRENT / PROTECTED**.
- Servicios Railway con `batch` en nombre: **NO CLASIFICAR POR NOMBRE; TRAZAR IMPLEMENTACIÓN**.
- tablas de la primera generación: **LEGACY DB CANDIDATES / P3 BLOCKED**.
