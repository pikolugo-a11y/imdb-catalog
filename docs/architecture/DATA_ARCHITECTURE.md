# PikoFilm — Arquitectura de datos

Estado: **canónico**.

## Principio

Neon/PostgreSQL mantiene datos editoriales, identidad, Lifecycle, referencias físicas, resultados de calidad, read models y estado/observabilidad de procesos. Plex sigue siendo la fuente de verdad de presencia física y reproducción; no sustituye al catálogo editorial.

## Capas

```text
Fuentes externas / Plex
        |
        v
operaciones canónicas
        |
        +--> datos funcionales canónicos
        +--> relaciones normalizadas
        +--> Lifecycle
        +--> read models
        +--> observabilidad
        +--> estado operativo de ejecución
```

### Datos funcionales
El universo editorial, identidad externa, metadatos, ratings normalizados, exclusiones y decisiones manuales viven en modelos canónicos. Una representación derivada no debe convertirse en segunda fuente de verdad.

### Normalización
Países y géneros usan vocabularios canónicos/aliases y relaciones N:M. Las fuentes externas se normalizan antes de convertirse en datos de producto. Los valores no resolubles deben permanecer trazables para revisión.

### Estado físico
Plex gobierna la existencia física. PikoFilm persiste referencias necesarias para cruzar esa realidad con el catálogo, validar archivos y calcular calidad técnica.

### Lifecycle
Lifecycle expresa estado funcional derivado. No debe existir una segunda máquina de estados paralela para resolver problemas locales. El contrato funcional vigente está en `../product/PRODUCT_AND_LIFECYCLE.md`.

### Read models
Son derivados para servir UI/agregaciones eficientemente. Pueden ser regenerables cuando así se documente. No deben recibir escrituras funcionales que los conviertan accidentalmente en fuente canónica.

### Ratings y PikoScore
`title_ratings` es la capa normalizada de ratings externos vigente. PikoScore 3 se calcula desde datos persistidos y no debe depender de llamadas externas durante el cálculo puro.

### Observabilidad
`process_runs`, `process_run_events` y `process_run_errors` son la frontera canónica de ejecución. Véase `OBSERVABILITY.md`.

### Batch
`batch_run_control`, `batch_run_items`, `batch_engine_control` y el gobierno API son coordinación operativa. No sustituyen a observabilidad ni a datos funcionales.

## Compatibilidad conocida

Las estructuras de compatibilidad se conservan sólo mientras existan consumidores reales. Su mera presencia no las convierte en arquitectura canónica. Cualquier retirada requiere consumer sweep; UNKNOWN bloquea borrado.

Las tablas Batch V1 retiradas (`batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits`, `batch_runtime_control`) no forman parte de la arquitectura.

## Reglas de eficiencia

- filtrar/agregar en PostgreSQL cuando sea razonable;
- evitar `SELECT *` y transferencias masivas innecesarias;
- paginar lecturas grandes;
- justificar índices, históricos y snapshots por valor/coste;
- conservar trazabilidad editorial necesaria;
- definir regenerabilidad/retención para derivados voluminosos.

## Cambio estructural

1. auditar readers/writers;
2. clasificar CANÓNICA / READ MODEL / COMPATIBILIDAD / REGENERABLE / LEGACY / UNKNOWN;
3. UNKNOWN bloquea eliminación;
4. cambios destructivos mediante migración revisable + smoke;
5. verificar producción;
6. actualizar arquitectura y catálogo de procesos si cambia una fuente de verdad.
