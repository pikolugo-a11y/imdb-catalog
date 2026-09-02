# PikoFilm — Producto y Lifecycle

Estado: **canónico a nivel de contrato**. Las recetas ejecutables proceso por proceso viven en `docs/processes/PROCESS_CATALOG.md` y en el código vivo.

## Propósito

PikoFilm gobierna una base audiovisual personal maestra: selección editorial, identidad, metadatos, ratings/PikoScore, relación con Plex, calidad física/técnica, Series, Personas, Sagas, búsqueda y explotación del catálogo.

Plex gobierna presencia física y reproducción. PikoFilm no gestiona visto/no visto, progreso ni hábitos de consumo.

## Flujo conceptual

```text
Novedades / universo editorial
 -> identidad
 -> validación de identidad
 -> datos y ratings
 -> PikoScore
 -> estado físico Plex cuando aplica
 -> validación de archivo / Series
 -> PikoQuality cuando aplica
 -> COMPLETE
```

Lifecycle no es un executor. Es estado funcional derivado. Los PROC son las operaciones que resuelven o modifican cada dimensión.

## Principios Lifecycle

1. una entidad no avanza por ocultar un problema, sino por resolver la condición que bloquea;
2. las decisiones humanas se mantienen fuera del Batch automático;
3. un cambio de contexto externo puede volver a abrir trabajo sobre una entidad antes completa;
4. recalcular Lifecycle debe usar fuentes canónicas, no flags paralelos creados para una pantalla;
5. el Batch repite operaciones unitarias canónicas y respeta estados de revisión humana;
6. observabilidad y Lifecycle son conceptos distintos: `process_runs` explica qué se ejecutó; Lifecycle explica el estado funcional resultante.

## Dominios funcionales y PROC

### Novedades
Discovery, altas/reintentos/exclusiones, admisión al catálogo, Plex global y acciones de Saga. PROC-NOV-* en el catálogo de procesos.

### Identidad
Resolución y corrección de IDs externos. PROC-ID-*.

### Validación de identidad
Obtención de evidencia, validación automática y decisiones/correcciones manuales. PROC-IV-*.

### Datos y PikoScore
Completar datos estructurales, refrescar ratings, calcular PikoScore y aceptar excepciones manuales. PROC-DATA-*.

### Películas físicas
Validar archivos Plex, findings y resets tras corrección. PROC-MOV-*.

### Series
Sync Plex, referencia TMDb, disponibilidad España y overrides/revisiones manuales. PROC-SER-*.

### Personas
Perfil/filmografía canónicos con operación compartida individual/Batch. PROC-PER-001.

### Sagas
Refresco global de colecciones/miembros TMDb y relación con Novedades. PROC-SAGA-001 + acciones NOV relacionadas.

### PikoQuality
C6 global por chunks (PQ-001) y captura técnica persistente (PQ-002). PikoQuality es calidad técnica y permanece separada de PikoScore.

### Operaciones
Reparaciones administrativas explícitas y observadas, como reset a Novedades. No deben convertirse en flujos automáticos por comodidad.

## Estados de revisión humana

Los estados/acciones que implican decisión editorial o excepción no deben ser absorbidos por Batch sin una decisión de producto explícita. Esto incluye correcciones/validaciones manuales de identidad, aceptación de datos incompletos, findings físicos, overrides de Series, exclusiones/admisiones y resets destructivos.

## Fuentes externas

TMDb, IMDb/OMDb, FilmAffinity, Wikidata, Plex y otras integraciones son fuentes/pasos de operaciones, no procesos independientes por el mero hecho de existir. La cascada concreta pertenece al core canónico del PROC correspondiente.

## Contrato de evolución

Para cambiar Lifecycle:
1. demostrar qué condición funcional cambia;
2. identificar PROC/canonical operation afectada;
3. comprobar individual + Batch;
4. comprobar datos/read models/side effects;
5. actualizar tests de contrato;
6. actualizar este documento sólo si cambia el modelo de producto y `PROCESS_CATALOG.md` si cambia la receta/ejecución.

`docs/LIFECYCLE_CANONICAL_PROCESSES.md` está retirado y no debe reutilizarse como especificación.