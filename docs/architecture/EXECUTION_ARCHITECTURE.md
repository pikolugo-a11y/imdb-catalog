# PikoFilm — Arquitectura de ejecución

Estado: **canónico**.

## Modelo común

PikoFilm distingue proceso funcional, observabilidad y mecanismo de ejecución.

- El **PROC** define la intención funcional.
- La **operación canónica** implementa la receta.
- `process_runs` registra la ejecución.
- El **executor** decide dónde se ejecuta.
- Batch añade orquestación, nunca una segunda receta.

```text
acción individual
 -> process_run
 -> canonicalOperation(entity, context)

Batch
 -> process_run padre
 -> batch_run_control
 -> batch_run_items
 -> worker pool
 -> process_run hijo por intento
 -> canonicalOperation(entity, context)
```

## Executors actuales

### Vercel
Ejecuciones manuales, control plane y procesos globales acotados que no requieren worker persistente.

### Railway API
Pool `api`. Procesos vigentes: ID-001, IV-001, DATA-001, DATA-002, SER-003, SER-004, PER-001.

### Railway FAST
Pool `fast`. Procesos vigentes: IV-002, DATA-003, MOV-001.

### Railway Plex
Pool `plex`. Proceso vigente: SER-002.

### Railway Technical
Modelo persistente especializado para PROC-PQ-002. No se fuerza dentro del Batch Engine común.

### GitHub Actions
Excepción no persistente: PROC-NOV-001 Discovery IMDb. Debe recibir/propagar el `run_id` canónico.

## Batch Engine

Estado operativo:
- `batch_run_control` — ejecución Batch;
- `batch_run_items` — unidades materializadas;
- `batch_engine_control` — control global;
- `batch_api_source_limits` y uso asociado — gobierno de APIs cuando aplica.

Observabilidad funcional:
- `process_runs` — padre y children;
- `process_run_events`;
- `process_run_errors`.

No forman parte de la arquitectura actual: `batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits`, `batch_runtime_control`.

## Semántica de paridad

- **EXACTA**: individual y Batch llaman al mismo core.
- **PARCIAL controlada**: mismo core, con guards o postprocesado explícito y cubierto por contrato.
- **NO APLICA**: decisión humana que no debe masificarse.
- **SIN BATCH**: proceso global/unitario sin Batch común.
- **MODELO ESPECIAL**: ejecución global/persistente cuya unidad no encaja artificialmente en el Batch Engine.

La clasificación proceso por proceso vive en `PROCESS_CATALOG.md`.

## Gobierno operativo

Batch puede añadir:
- selección;
- prioridad;
- concurrencia;
- leases y heartbeat;
- pause/resume/cancel;
- retries/backoff;
- rate limiting y cuotas;
- circuit breaker;
- métricas agregadas.

Estas capacidades son infraestructura. No pueden alterar silenciosamente la receta funcional del PROC.

## Compatibilidad pendiente

- `pipeline_runs`: compatibilidad histórica; PQ-001 ya no escribe sus chunks ahí. Su retirada física requiere auditoría/gate separado.
- `series_quality_runs`: compatibilidad temporal todavía leída/escrita por flujo vigente de Series; no retirar sin convergencia previa.

## Regla de cambio

Cualquier modificación de un proceso con Batch debe comprobar explícitamente ambos entrypoints. Si cambia la lógica funcional, el cambio debe hacerse en la operación canónica compartida, no duplicarse en el adapter Railway.
