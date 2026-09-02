# PikoFilm — Arquitectura de datos

Estado: **canónico**.

## Principio

PikoFilm es la base audiovisual personal maestra. Neon/PostgreSQL mantiene datos editoriales, identidad, estados Lifecycle, referencias físicas, resultados de calidad, read models y estado/observabilidad de procesos. Plex sigue siendo la fuente de verdad de la presencia física y reproducción; no sustituye al catálogo editorial.

## Capas de datos

```text
Fuentes externas / Plex
        |
        v
operaciones canónicas
        |
        +--> datos funcionales canónicos
        +--> referencias / relaciones normalizadas
        +--> Lifecycle
        +--> read models
        +--> observabilidad
        +--> estado operativo de ejecución
```

### Datos funcionales canónicos

Incluyen el universo editorial de películas/series, identidad externa, metadatos, ratings, exclusiones y decisiones manuales. Una representación derivada no debe convertirse en segunda fuente de verdad.

### Normalización editorial

Países y géneros usan vocabularios canónicos y aliases. Las relaciones N:M representan coproducciones y taxonomías sin depender de strings de una fuente concreta. Los valores no resolubles deben permanecer trazables para revisión. La especificación detallada vigente se mantiene en `docs/CANONICAL_DATA.md` mientras se consolida P6.

### Estado físico

Plex gobierna la existencia física. PikoFilm persiste referencias necesarias para cruzar esa realidad con el catálogo, validar archivos y calcular calidad técnica. La ausencia/presencia en Plex no define por sí sola la pertenencia editorial al catálogo.

### Lifecycle

Lifecycle expresa el estado funcional derivado de cada entidad respecto al flujo de calidad/completitud. No debe existir una segunda máquina de estados paralela para resolver problemas locales. Su especificación funcional P6 debe derivarse del código vivo y del catálogo de procesos, no del documento histórico retirado `LIFECYCLE_CANONICAL_PROCESSES.md`.

### Read models

Read models existen para servir UI/agregaciones de forma eficiente y pueden ser regenerables cuando así se documente. Ejemplos auditados: `piko_quality_aggregates`, vistas de nombres normalizados y modelos derivados de Series/Personas. Un read model no debe recibir escrituras funcionales que lo conviertan accidentalmente en fuente canónica.

### Observabilidad

`process_runs`, `process_run_events` y `process_run_errors` son la fuente canónica de ejecución. Véase `OBSERVABILITY.md`.

### Estado Batch

`batch_run_control`, `batch_run_items`, `batch_engine_control` y gobierno API son coordinación operativa. No sustituyen a observabilidad ni a datos funcionales.

## Compatibilidad conocida

- `pipeline_runs`: compatibilidad histórica. PQ-001 ya no escribe sus chunks. Su retirada física requiere comprobar todos los consumidores restantes.
- `series_quality_runs`: compatibilidad temporal todavía usada por Series; no retirar hasta convergencia.

Las tablas Batch V1 retiradas no forman parte de la arquitectura: `batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits`, `batch_runtime_control`.

## Reglas de eficiencia

- filtrar, agregar y contar en PostgreSQL cuando sea razonable;
- evitar `SELECT *` y transferencias masivas sin necesidad;
- paginar lecturas grandes;
- justificar índices, históricos y snapshots por valor/coste;
- conservar trazabilidad editorial necesaria aunque un dato sea derivable;
- definir regenerabilidad/retención para datos derivados de volumen significativo.

## Cambios estructurales

1. auditar lectores y writers;
2. clasificar CANÓNICA / READ MODEL / COMPATIBILIDAD / REGENERABLE / LEGACY / UNKNOWN;
3. UNKNOWN bloquea eliminación;
4. cambios destructivos mediante migración revisable y smoke test;
5. verificar producción tras aplicar;
6. actualizar esta arquitectura y el catálogo de procesos si cambia una fuente de verdad.
