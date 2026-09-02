# PikoFilm — Arquitectura del sistema

Estado: **canónico**. Fecha de consolidación PRE-V4 P6: 2026-09-02.

## Principio

PikoFilm separa interfaz/control, datos/estado y ejecución persistente. La responsabilidad se decide por el comportamiento real, no por nombres históricos de servicios.

```text
Usuario
  |
  v
Vercel / Next.js ------------------------------+
  | UI + Server Actions + control plane         |
  |                                             |
  +----> Neon PostgreSQL <----------------------+---- Railway workers
  |      datos + Lifecycle + observabilidad     |     ejecución persistente
  |                                             |
  +----> APIs externas                          +---- APIs externas
  |
  +----> GitHub Actions (excepciones explícitas, no persistentes)
```

## Fronteras físicas

### Vercel — UI y control plane

Responsabilidades:
- aplicación Next.js y navegación;
- acciones manuales/individuales ligeras;
- creación y consulta de `process_runs`;
- creación/control de Batch;
- disparo explícito de procesos globales compatibles;
- presentación de Catálogo, Novedades, Calidad, Series, Personas, Sagas, PikoQuality, Operaciones y Batch.

Vercel no debe convertirse en un worker persistente para tareas pesadas de larga duración.

### Neon PostgreSQL — data/state plane

Responsabilidades:
- datos funcionales canónicos;
- Lifecycle;
- read models;
- observabilidad (`process_runs`, eventos, errores);
- estado operativo Batch;
- estado funcional especializado de Series, Personas, PikoQuality, etc.

Neon no es sólo almacenamiento: es el punto compartido de coordinación entre Vercel y executors. Las estructuras de compatibilidad no se consideran canónicas sólo porque todavía existan físicamente.

### Railway — execution plane persistente

Servicios vigentes auditados en P4:
- API worker — procesos gobernados por APIs externas y pool `api`;
- FAST worker — operaciones rápidas/CPU o sin pool API principal;
- Plex worker — operaciones específicas Plex;
- Technical Snapshot worker — captura técnica persistente para PikoQuality.

Los nombres con sufijos históricos no implican por sí mismos legacy. La existencia de cada servicio se justifica por su responsabilidad y consumidores vivos.

### GitHub Actions — excepción controlada

No es el motor persistente de Lifecycle ni del Batch Engine. Se utiliza cuando existe una razón explícita para una tarea no persistente y controlada. El caso canónico actual es Discovery IMDb (`PROC-NOV-001`), disparado manualmente con un `run_id` de observabilidad.

## Operación canónica y executors

La arquitectura funcional no depende del executor:

```text
individual -> process_run -> operación canónica X
Batch -> cola/lease -> child process_run -> operación canónica X
```

El executor puede cambiar guards, gobierno de concurrencia, leases o rate limits, pero no debe mantener una segunda receta funcional. La matriz completa vive en `docs/processes/PROCESS_CATALOG.md` y `docs/processes/BATCH_ARCHITECTURE.md`.

## Observabilidad transversal

`process_runs`, `process_run_events` y `process_run_errors` son la frontera canónica de observabilidad. Las tablas de control Batch o los estados funcionales de dominio no deben convertirse en un segundo sistema de tracing.

## Cambios de arquitectura

Antes de modificar una frontera física o mover un proceso entre executors:
1. verificar consumidores vivos;
2. verificar datos y side effects;
3. conservar la operación canónica;
4. actualizar catálogo de procesos y documentación de ejecución;
5. añadir/actualizar contratos de CI;
6. no inferir legacy por nombre;
7. no realizar cambios destructivos de infraestructura sin gate explícito.
