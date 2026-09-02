# PikoFilm — Arquitectura canónica de Batch

Estado: **contrato arquitectónico vivo**.

## Principio innegociable

Batch no es una segunda implementación de un proceso. Batch es selección + orquestación + ejecución repetida de la **misma operación canónica individual**.

```text
Individual UI/API
  -> process_run individual
  -> canonicalOperation(entity, context)

Batch UI
  -> process_run batch
  -> batch_run_control
  -> batch_run_items
  -> worker pool
  -> process_run individual hijo por item
  -> canonicalOperation(entity, context)
```

El contexto puede cambiar `lane`, gobernanza de APIs, trazabilidad, cancelación cooperativa o límites de concurrencia. No puede cambiar la receta funcional.

## Modelo persistente actual

- `process_runs`: observabilidad canónica de ejecución; contiene parent Batch y ejecuciones individuales/child.
- `process_run_events`: eventos/steps.
- `process_run_errors`: errores estructurados.
- `batch_run_control`: control de un Batch (`process_code`, pool, desired state, concurrencia).
- `batch_run_items`: cola durable por entidad, leases, intentos y estado.
- `batch_engine_control`: control global del motor.
- `batch_api_source_limits` / usage: gobernanza de fuentes externas para lanes manual/Batch.

Las antiguas `batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits` y `batch_runtime_control` fueron retiradas y **no son parte de la arquitectura**.

## Runtime común

`lib/batch-worker-runtime.mjs` es responsable de claim, lease, heartbeat, retry/requeue, child `process_run`, finalización y reconciliación. Los workers no deben reimplementar estas responsabilidades.

## Pools Railway

| Pool | Servicio | Capacidad por defecto | PROC actuales |
|---|---|---:|---|
| `api` | `pikofilm-worker-api-v3` | 3 global; cada Batch limita además su concurrencia | ID-001, IV-001, DATA-001, DATA-002, SER-003, SER-004, PER-001 |
| `fast` | `pikofilm-batch-fast-worker-v1` | 8 | IV-002, DATA-003, MOV-001 |
| `plex` | `pikofilm-batch-plex-worker-v2` | 1 | SER-002 |
| technical especializado | `pikofilm-technical-snapshot-worker-v1` | control propio | PQ-002 |

## Batch disponibles y paridad

| PROC | Selección | Pool | Concurrencia solicitada | Operación ejecutada | Estado |
|---|---|---|---:|---|---|
| ID-001 | `IDENTITY_PENDING`, TMDb ausente | api | 3 | `executeId001Canonical` | EXACTA |
| IV-001 | validación con evidencia incompleta | api | 2 | `refreshIdentityEvidenceCanonical` | PARCIAL por guard |
| IV-002 | evidencia lista para validar | fast | 8 | `validateIdentityCanonical` | PARCIAL por guard |
| DATA-001 | `DATA_INCOMPLETE` | api | 2 | `executeData001Canonical` | EXACTA |
| DATA-002 | `PIKOSCORE_PENDING` con ratings ausentes/caducados | api | 2 | `refreshRatingsCanonical` | EXACTA funcional |
| DATA-003 | títulos listos para PikoScore | fast | 8 | `executeData003Canonical` | DIVERGENTE respecto al individual |
| MOV-001 | `MOVIE_FILE_PENDING` + película Plex activa | fast | 8 | `executeMov001Canonical` | EXACTA |
| SER-002 | detalle Plex ausente/invalidado | plex | 1 | `syncPlexSeriesDetailCore` | EXACTA |
| SER-003 | referencia TMDb vencida/invalidada | api | 2 | `refreshSeriesUnitaryCanonical` | PARCIAL |
| SER-004 | disponibilidad ES desconocida y recheck vencido | api | 2 | `confirmSeriesEsAvailabilityCanonical` | PARCIAL |
| PER-001 | persona relevante sin refresh o >30 días/error | api | 2 | `refreshPersonFilmography` wrapper | DIVERGENTE observabilidad |

## Pausa, reanudación y cancelación

Los Batch Engine comunes usan `desired_state` y las acciones `pauseBatch`, `resumeBatch`, `cancelBatch`. La pausa/cancelación es cooperativa: los items ya iniciados terminan; se impide reclamar nuevo trabajo según el estado del run/motor. Los leases vencidos se reconcilian por los workers.

PQ-002 usa un control técnico especializado (`plex_technical_control`) y no debe mezclarse artificialmente con Batch Engine mientras sus necesidades de scan/capture sean distintas.

## Retry e idempotencia

- El parent Batch usa un `process_run` único y un control durable.
- Cada item tiene identidad estable en `batch_run_items` y genera un child `process_run` mediante el runtime.
- Los adapters deben lanzar errores marcando `permanent`/`retryable` cuando corresponda; el runtime decide requeue/backoff según política.
- Los cores deben ser seguros frente a reejecución: upsert, comparación de fingerprint, completar sólo faltantes o persistencia determinista según proceso.
- La selección Batch es una optimización/precondición, nunca una sustitución de guards dentro del core cuando éstos sean necesarios para seguridad.

## Gobernanza de APIs

Los procesos que consumen APIs usan `createApiGate`. `lane='manual'` y `lane='batch'` comparten el mismo core pero permiten priorización/contabilidad diferenciada. Un Batch no debe saltarse rate limits ni introducir una cascada de fuentes diferente al individual.

## Cómo modificar un proceso con Batch

Antes de cambiar código:
1. localizar su ficha en `PROCESS_CATALOG.md`;
2. localizar la función canónica exacta;
3. comprobar todos los callers individual y Batch;
4. modificar **el core**, no copiar la modificación en dos sitios;
5. ejecutar pruebas de paridad con la misma entidad/contexto cuando sea posible;
6. actualizar `PROCESS_CATALOG.md` y este documento si cambia contrato/orquestación;
7. comprobar `process_runs`, Lifecycle y efectos persistentes esperados.

Un PR/cambio que requiere editar una receta en `app/.../actions.js` y repetirla en `worker/...` es una señal de diseño incorrecto: primero extraer/consolidar el core.

## Deudas P5 que afectan Batch

- **DATA-003:** mover el individual a `executeData003Canonical` o extraer un core superior único.
- **PER-001:** extraer core no observado; actualmente Batch llama al wrapper individual observado y produce doble frontera de ejecución.
- **IV-001/IV-002:** decidir si `IDENTITY_REVIEW_REQUIRED` es exclusivamente manual. Si sí, el individual automático debe usar el mismo guard que Batch o documentarse como acción explícita de revalidación; si no, el selector Batch debe reflejar la política.
- **SER-003/SER-004:** unificar postprocesado de read model dentro de la operación canónica o demostrar que ya ocurre dentro del core.
- **PQ-001:** retirar `pipeline_runs` interno cuando se consolide observabilidad; decidir si C6 vectorizado es una operación Batch especial válida o si debe existir core por item.

## Prueba de regresión arquitectónica recomendada

Mantener tests que fallen si:
- un adapter Batch deja de importar el core canónico esperado;
- aparece lógica de negocio sustancial en un worker adapter;
- individual y Batch producen distinto Lifecycle/functional_result para la misma entrada;
- un proceso con Batch deja de registrar child `process_runs`;
- se referencia cualquier tabla Batch V1 retirada.

Esta prueba es especialmente importante para desarrollo con IA: permite que una sesión futura detecte automáticamente una desviación aunque no conozca la historia del proyecto.
