# PikoFilm — PRE-V4 · Generaciones de Batch / ADMIN

Fecha: 2026-09-02  
Rama: `pre-v4-readiness`

## 1. Dos modelos Batch coexisten en el repositorio

La auditoría confirma que no hay una única capa Batch homogénea.

### Modelo antiguo `/admin/batch`

`app/admin/batch/page.js` usa:

- `lib/batch-control.js`;
- tablas `batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits`, `batch_runtime_control`;
- además intenta leer `batch_job_steps`.

La ruta ofrece UI propia para crear runs por etapas genéricas (`IDENTITY_PENDING`, `DATA_INCOMPLETE`, etc.), pausar motor, administrar fuentes y abrir detalle de jobs.

### Modelo actual Batch Engine / procesos observados

Los workers Railway actuales usan:

- `process_runs` / `process_run_events` / `process_run_errors`;
- `batch_run_control` / `batch_run_items` / `batch_engine_control`;
- child runs individuales por proceso estable (`PROC-*`);
- pools FAST/API/Plex.

`lib/batch-worker-runtime.mjs` crea child runs en `process_runs`, registra eventos en `process_run_events`, errores en `process_run_errors` y gobierna items mediante `batch_run_items`.

El Centro de Operaciones `/admin` actual lee el modelo común mediante `getOperationsOverview()` y muestra `OperationsBatchControl`; no usa `app/admin/batch/page.js` como pantalla principal.

## 2. Navegación actual

`components/Nav.js` enlaza `Operaciones` a `/admin`. No hay enlace principal a `/admin/batch`.

`/admin/page.js` tampoco muestra un enlace a `/admin/batch`: funciona como Centro de Operaciones canónico sobre `process_runs`.

Conclusión: `/admin/batch` es una ruta accesible directamente pero no forma parte de la navegación principal vigente.

## 3. Incompatibilidad de esquema confirmada

`lib/batch-control.js` todavía lee `batch_job_steps`, tabla que ya no existe en producción según evidencia runtime Vercel.

Eso explica el error histórico de `/admin/batch` y confirma que esa pantalla pertenece a una generación no completamente migrada.

## 4. Clasificación

- `/admin`: **CANONICAL OPERATIONS UI**.
- `process_runs` + `batch_run_control` + `batch_run_items` + `batch_engine_control`: **CURRENT EXECUTION/OBSERVABILITY MODEL**.
- `/admin/batch` + `lib/batch-control.js` + tablas `batch_runs/batch_jobs/...`: **LEGACY/COMPATIBILITY UI GENERATION**, pero todavía contiene controles visibles y no se elimina sin decisión explícita del usuario.
- `batch_job_steps`: **REMOVED DB OBJECT WITH RESIDUAL CODE READS**.

## 5. Frontend Safety Gate

Aunque `/admin/batch` no esté en navegación principal, sigue siendo una ruta frontend con formularios y controles. Por tanto cualquier retirada/reemplazo es **FRONTEND=SÍ** y requiere decisión de Roberto.

No borrar la ruta, `lib/batch-control.js` ni sus tablas como parte de una limpieza automática.

## 6. Recomendación PRE-V4

Antes de V4 se debe elegir explícitamente entre:

A. retirar la generación `/admin/batch` después de demostrar que todas sus capacidades útiles ya existen/reubican en `/admin` y páginas funcionales; o

B. migrar esa ruta al modelo actual `process_runs/batch_run_items` y convertirla en una vista especializada del mismo motor.

No recomendamos recrear `batch_job_steps` sólo para mantener viva la generación anterior: el runtime actual ya registra eventos/errores bajo el modelo común y reconstruir una tabla retirada aumentaría duplicidad.

Este punto queda como **DECISIÓN DE USUARIO** dentro del gate PRE-V4, después de terminar el inventario de capacidades de `/admin/batch` (issue #272).
