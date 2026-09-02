# PikoFilm — Arquitectura canónica de Batch

Estado: **contrato arquitectónico vivo**. Consolidado tras cierre P5.

## Principio innegociable

Batch no es una segunda implementación. Es selección + orquestación + ejecución repetida de la misma operación canónica individual.

```text
Individual UI/API
  -> process_run individual
  -> canonicalOperation(entity, context)

Batch UI
  -> process_run batch
  -> batch_run_control
  -> batch_run_items
  -> worker pool
  -> process_run hijo por item/intento
  -> canonicalOperation(entity, context)
```

El contexto puede cambiar `lane`, API governance, trazabilidad, cancelación cooperativa o concurrencia. No puede cambiar la receta funcional.

## Persistencia vigente

Observabilidad:
- `process_runs`
- `process_run_events`
- `process_run_errors`

Orquestación:
- `batch_run_control`
- `batch_run_items`
- `batch_engine_control`
- `batch_api_source_limits` / uso asociado

Retiradas y prohibidas en código vivo:
- `batch_runs`
- `batch_jobs`
- `batch_process_state`
- `batch_source_limits`
- `batch_runtime_control`

## Runtime común

`lib/batch-worker-runtime.mjs` posee claim, lease, heartbeat, retry/requeue, child `process_run`, finalización y reconciliación. Los adapters de worker no deben reimplementar esas responsabilidades.

## Pools Railway

| Pool | Servicio | PROC actuales |
|---|---|---|
| `api` | `pikofilm-worker-api-v3` | ID-001, IV-001, DATA-001, DATA-002, SER-003, SER-004, PER-001 |
| `fast` | `pikofilm-batch-fast-worker-v1` | IV-002, DATA-003, MOV-001 |
| `plex` | `pikofilm-batch-plex-worker-v2` | SER-002 |
| technical especializado | `pikofilm-technical-snapshot-worker-v1` | PQ-002 |

Los nombres/sufijos no determinan legacy; P4 auditó los cuatro servicios como vigentes.

## Paridad viva

| PROC | Operación | Estado |
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
| PER-001 | `refreshPersonFilmographyCanonical` | EXACTA |

PER-001 ya no llama desde Batch al wrapper observado individual: el worker ejecuta directamente `refreshPersonFilmographyCanonical` dentro del child `process_run` creado por el runtime. El core propaga los errores de API governance y distingue `lane='batch'`.

SER-003/004 comparten core y reconstruyen el read model en ambos caminos; un contrato de CI fija la equivalencia del postprocesado.

## Modelos especializados

### PQ-001
C6 usa un único `process_run` global canónico y procesa chunks mediante `processC6Batch`. Los chunks actualizan progreso/heartbeat del mismo run. PQ-001 ya no escribe `pipeline_runs`. No se fuerza al Batch Engine común porque su unidad/vectorización es especializada.

### PQ-002
Technical Snapshot mantiene control persistente especializado. No debe mezclarse artificialmente con `batch_engine_control`.

## Pausa, cancelación, retry e idempotencia

Los Batch comunes usan estado deseado y control cooperativo. Items iniciados pueden terminar; no se reclama trabajo nuevo cuando el estado lo impide. Leases vencidos se reconcilian.

Cada item tiene identidad durable y genera child `process_run`. Los adapters clasifican errores retryable/permanent cuando aplica; el runtime gobierna requeue/backoff. Los cores deben soportar reejecución segura mediante upsert, fingerprints, completar faltantes o persistencia determinista según dominio.

## API governance

Procesos externos usan el gate común. `lane='manual'` y `lane='batch'` comparten core pero permiten priorización/contabilidad diferenciada. Un Batch no puede saltarse rate limits ni cambiar silenciosamente la cascada de fuentes.

## Compatibilidad pendiente

- `pipeline_runs`: histórica; PQ-001 ya no escribe. No eliminar físicamente hasta gate de consumidores.
- `series_quality_runs`: temporal; Series aún mantiene consumidores vivos.

Estas compatibilidades no definen la arquitectura Batch.

## Cómo modificar un proceso

1. localizarlo en `PROCESS_CATALOG.md`;
2. identificar core y callers vivos;
3. cambiar el core funcional una sola vez;
4. mantener guards/orquestación fuera de la receta;
5. actualizar contratos de paridad;
6. revisar observabilidad, Lifecycle y side effects;
7. actualizar catálogo + este documento en el mismo cambio.

Si una modificación obliga a copiar la misma receta en `app/...` y `worker/...`, el diseño es incorrecto.

## Contratos de regresión

CI debe detectar, según aplique:
- adapter Batch que deja de usar el core esperado;
- lógica de negocio sustancial duplicada en worker;
- divergencia de postprocesado individual/Batch;
- doble frontera `process_run`;
- reaparición de tablas Batch V1 retiradas.

La matriz exhaustiva y los procesos sin Batch/manuales viven en `PROCESS_CATALOG.md`.