# PikoFilm — Arquitectura canónica de Batch

Estado: **anexo arquitectónico vivo de V4**. Complementa `docs/V4_ARCHITECTURE.md` y `docs/processes/PROCESS_CATALOG.md`.

## Principio innegociable

Batch no es una segunda implementación. Es selección + orquestación + ejecución repetida de la misma operación canónica individual.

```text
Individual UI/API
  -> process_run individual
  -> canonicalOperation(entity, context)

Batch UI/planner
  -> process_run batch
  -> batch_run_control
  -> batch_run_items
  -> worker pool
  -> process_run hijo por item/intento
  -> canonicalOperation(entity, context)
```

El contexto puede cambiar `lane`, API governance, trazabilidad, cancelación cooperativa o concurrencia. No puede cambiar la receta funcional.

## Persistencia vigente

### Observabilidad

- `process_runs`
- `process_run_events`
- `process_run_errors`

### Orquestación

- `batch_run_control`
- `batch_run_items`
- `batch_engine_control`
- `batch_api_source_limits` y uso/leases de fuente asociados

### Relaciones retiradas y prohibidas en código vivo

- `batch_runs`
- `batch_jobs`
- `batch_process_state`
- `batch_source_limits`
- `batch_runtime_control`

Su reaparición como dependencia de aplicación constituye una regresión arquitectónica.

## Runtime común

`lib/batch-worker-runtime.mjs` posee las responsabilidades transversales:

- claim de item;
- lease;
- heartbeat;
- creación de child `process_run` por intento;
- ejecución y clasificación del resultado;
- retry/requeue/backoff;
- finalización;
- reconciliación de trabajo interrumpido.

Los adapters de worker no deben reimplementar estas responsabilidades ni contener una receta funcional alternativa.

## Pools Railway

| Pool | Servicio vigente | PROC actuales |
|---|---|---|
| `api` | `pikofilm-worker-api-v3` | ID-001, IV-001, DATA-001, DATA-002, SER-003, SER-004, SAGA-001, PER-001 |
| `fast` | `pikofilm-batch-fast-worker-v1` | IV-002, DATA-003, MOV-001 |
| `plex` | `pikofilm-batch-plex-worker-v2` | SER-002 |
| technical especializado | `pikofilm-technical-snapshot-worker-v1` | PQ-002 |

Los nombres o sufijos no determinan si un servicio es legacy. Se clasifica por consumidores, comando y responsabilidad viva.

## Paridad viva

| PROC | Operación canónica por item | Estado |
|---|---|---|
| ID-001 | `executeId001Canonical` | EXACTA |
| IV-001 | `refreshIdentityEvidenceCanonical` | PARCIAL por guard humano |
| IV-002 | `validateIdentityCanonical` | PARCIAL por guard humano |
| DATA-001 | `executeData001Canonical` | EXACTA |
| DATA-002 | `refreshRatingsCanonical` | EXACTA funcional |
| DATA-003 | `executeData003Canonical` | EXACTA |
| MOV-001 | `executeMov001Canonical` | EXACTA |
| SER-002 | `syncPlexSeriesDetailCore` | EXACTA |
| SER-003 | `refreshSeriesUnitaryCanonical` | PARCIAL controlada |
| SER-004 | `confirmSeriesEsAvailabilityCanonical` | PARCIAL controlada |
| SAGA-001 | `refreshSagaCollectionCanonical` | EXACTA por colección |
| PER-001 | `refreshPersonFilmographyCanonical` | EXACTA |

### SAGA-001

El refresco global de Sagas es un Batch común real:

1. `lib/saga-batch.js` obtiene el universo completo de colecciones relevante para PikoFilm;
2. crea/materializa el Batch en pool `api` sin el antiguo límite funcional global de 120;
3. Railway reclama una colección por item;
4. cada child run ejecuta `refreshSagaCollectionCanonical` con API governance;
5. la ficha individual usa exactamente ese mismo core mediante `lib/saga-unitary.js`;
6. las escrituras de colección/miembros son atómicas por colección;
7. pausa, reanudación y cancelación se integran en los controles comunes.

`lib/sagas-v2.js::refreshSagas()` se conserva sólo como ruta interna/acotada o compatibilidad. No define el refresco global visible de V4.

### PER-001

El Batch ejecuta directamente `refreshPersonFilmographyCanonical` dentro del child `process_run`; no llama al wrapper observado individual y por tanto no crea observabilidad anidada.

### SER-003 / SER-004

Comparten core funcional con individual. El adapter Railway reconstruye explícitamente el read model tras cada item y el wrapper individual hace el postprocesado equivalente. Los contratos de CI fijan esa equivalencia.

## Modelos especializados

### PQ-001

C6 usa un único `process_run` global canónico y procesa chunks mediante `processC6Batch`. Los chunks actualizan progreso/heartbeat del mismo run. No se fuerza dentro del Batch Engine común porque su unidad/vectorización es especializada.

### PQ-002

Technical Snapshot mantiene control persistente especializado y worker Railway propio. No debe mezclarse artificialmente con `batch_engine_control`.

## Creación de un Batch

Un starter canónico debe, según el proceso:

1. validar que la operación es Batch-compatible;
2. impedir/reutilizar un Batch ya activo cuando el contrato exige unicidad;
3. crear el parent `process_run`;
4. crear `batch_run_control` con pool/configuración solicitada;
5. seleccionar entidades con SQL acotado y reglas funcionales correctas;
6. materializar `batch_run_items` durables;
7. dejar el trabajo disponible para el worker correspondiente.

No se precrean child runs para todos los items: cada intento real crea su child al ser reclamado.

## Estados y control

El estado funcional del proceso y el estado operativo del Batch son conceptos distintos.

Estados operativos permiten, según backend:

- queued;
- running;
- paused;
- cancelling/cancelled;
- retry/requeue;
- succeeded/failed/terminal.

La UI sólo debe ofrecer acciones válidas para el estado efectivo. Pausar impide reclamar trabajo nuevo; items ya iniciados pueden terminar de forma cooperativa según runtime.

## Lease, heartbeat y reconciliación

Un item reclamado posee lease/owner. El worker renueva heartbeat durante trabajo largo. Si un worker cae y el lease vence:

- el runtime/reconciliador detecta el item abandonado;
- clasifica si puede reintentarse;
- lo devuelve a cola o terminaliza según política;
- no reutiliza falsamente el child run anterior como si el intento siguiera vivo.

Operaciones debe poder mostrar lease/heartbeat cuando sea necesario para diagnóstico, pero no convertir estos campos en UX cotidiana.

## Retry e idempotencia

Los retries son:

- limitados;
- espaciados;
- condicionados por clasificación retryable/permanent;
- observados por intento;
- seguros respecto a side effects.

Los cores soportan reejecución mediante estrategias adecuadas al dominio: upsert, completar faltantes, fingerprints, transacciones atómicas o persistencia determinista.

Un resultado `partial` no debe contarse automáticamente como item `succeeded` si el contrato del proceso exige éxito completo.

## API governance

Los procesos del pool API que llaman TMDb/OMDb/MDBList usan el gate común. Manual y Batch comparten configuración persistida y hard caps; cambia la `lane` cuando corresponde.

Reglas:

- cada llamada externa adquiere permiso real;
- la concurrencia del worker no sustituye la concurrencia de fuente;
- un Batch no puede saltarse cuota/breaker/rate limit;
- si falta el gate para una fuente gobernada, el core falla cerrado antes del fetch;
- 429/gobernanza no se convierten en `not_found` ni activan fallbacks incorrectos.

## Planner y Batch

`PROC-PLAN-002` puede iniciar Batch únicamente para procesos declarados seguros en la especificación V4. El planificador reutiliza los starters canónicos; no escribe directamente items simulando el comportamiento de cada dominio.

El sync Plex global (`PROC-NOV-009`) permanece manual y **no** entra en el planner.

## Observabilidad Batch

El modelo esperado es:

```text
parent process_run (Batch)
  +-- batch_run_control
  +-- batch_run_items
       +-- child process_run intento 1
       +-- child process_run intento 2 si hubo retry
```

`process_runs` sigue siendo la verdad de ejecución. Las tablas Batch son estado de orquestación, no un segundo tracing.

## Retención

La retención técnica detallada V4 es de 30 días, pero la purga nunca elimina estado necesario para un Batch vivo:

- parent activo/pausado;
- item queued/running/retryable;
- lease o reconciliación pendiente;
- child necesario para una relación activa;
- estado global/configuración actual.

Sólo el histórico terminal y seguro puede purgarse conforme al mecanismo canónico de retención.

## Compatibilidad conocida

- `pipeline_runs`: histórica; PQ-001 ya no escribe. No eliminar hasta demostrar ausencia de consumidores.
- `series_quality_runs`: compatibilidad temporal con consumidores vivos.

Estas estructuras no definen la arquitectura Batch actual.

## Cómo modificar un proceso Batch

1. localizar PROC en `PROCESS_CATALOG.md`;
2. identificar core y todos los callers vivos;
3. cambiar la receta funcional sólo en el core;
4. mantener selección/guards/orquestación fuera del core cuando corresponda;
5. verificar API governance;
6. verificar side effects/Lifecycle/read models;
7. actualizar contratos de paridad;
8. comprobar retry/idempotencia;
9. revisar Operaciones/Actividad si cambia observabilidad;
10. actualizar este documento, catálogo y tríada V4 en el mismo cambio.

Si una modificación obliga a copiar la misma receta en `app/...` y `worker/...`, el diseño es incorrecto.

## Contratos de regresión

CI debe detectar, según aplique:

- adapter Batch que deja de usar el core esperado;
- lógica funcional sustancial duplicada en worker;
- divergencia no documentada de postprocesado;
- doble frontera `process_run`;
- reaparición de tablas Batch V1 retiradas;
- fuente gobernada consumida sin gate;
- pérdida de `NoPrefetchLink` que genere fanout de navegación;
- regresiones específicas de cada proceso, incluida la paridad SAGA-001 individual/global.

La matriz completa de procesos, incluidos manuales y sin Batch, vive en `PROCESS_CATALOG.md`. La arquitectura global vive en `docs/V4_ARCHITECTURE.md`.