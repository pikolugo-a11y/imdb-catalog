# PikoFilm V5 — Decisiones 02: Rendimiento

Estado: **EN REVISIÓN**  
Fecha de inicio: **2026-09-13**  
Rama: `audit/v5-02-performance`

Este documento registra las decisiones de la Fase 2 del Punto 2 — Rendimiento. Cada propuesta se revisa individualmente y se persiste antes de pasar a la siguiente. No implica implementación V5 inmediata.

---

## PERF-01 — Read model rápido para Personas

**Decisión:** APROBADA  
**Fecha:** 2026-09-13

### Problema observado

La pantalla de Personas construye el ranking global a partir de `people`, `movie_credits` y `catalog_read_model` antes de limitar a la página visible. En la auditoría se midió aproximadamente **1,26 s de tiempo PostgreSQL** para una consulta representativa de la página inicial, con el coste dominante en la agregación/ranking global de cientos de miles de créditos. La optimización existente que limita `person_filmography` a las personas visibles de la página se conserva.

### Decisión V5

Crear un **read model derivado y regenerable para Personas**, orientado a consulta y ordenación, que prepare las métricas necesarias para filtros/ranking sin recalcular el universo completo en cada request.

Debe poder incluir, según requiera el diseño final, métricas como número de obras relevantes, presencia Plex, agregados de PikoScore, popularidad y score de relevancia.

### Límites y condiciones

- No será fuente de verdad ni aceptará decisiones funcionales directas.
- Se derivará exclusivamente de datos canónicos.
- Debe soportar actualización incremental cuando sea razonable.
- Debe existir reconciliación/reconstrucción completa de seguridad.
- No se sustituirá una consulta cara por reconstrucciones completas frecuentes del read model.
- Los cambios en inputs relevantes —créditos, estado editorial, PikoScore, presencia Plex u otros finalmente definidos— deben invalidar o actualizar el dato derivado correspondiente.
- Se preserva `NoPrefetchLink` y la carga acotada de `person_filmography` para la página visible.

### Objetivo

Que el coste de servir Personas dependa principalmente de la página/filtros solicitados y no del volumen completo de créditos en cada navegación.

---

## PERF-02 — Clasificación, filtrado y paginación SQL reales para Calidad · Series

**Decisión:** APROBADA  
**Fecha:** 2026-09-13

### Problema observado

`getClassifiedSeries()` carga prácticamente todo `series_quality_read_model`, calcula `availability_due` mediante un agregado global sobre estados efectivos de episodios y después realiza en Node.js la clasificación funcional, los filtros, la prioridad, el orden y la paginación. En la auditoría se midió aproximadamente **201 ms** para la consulta base representativa antes del trabajo adicional en aplicación; el coste principal estaba en recorrer y agregar decenas de miles de episodios/diagnósticos para terminar mostrando como máximo una página de 50 series.

### Decisión V5

Hacer que la superficie Calidad · Series consulte un read model preparado para que PostgreSQL pueda aplicar **estado primario, filtros, prioridad, orden y paginación antes de devolver filas**. Las señales derivadas necesarias —incluido `availability_due` o su equivalente canónico— deberán estar persistidas o mantenidas incrementalmente cuando eso sea seguro, evitando reconstruir agregados globales en cada navegación.

### Límites y condiciones

- Debe existir una única lógica funcional canónica de clasificación; no se mantendrán reglas divergentes en SQL y JavaScript.
- El read model seguirá siendo derivado y reconstruible, nunca fuente de verdad.
- Los cambios de inputs relevantes deben actualizar o invalidar sólo lo necesario cuando sea razonable.
- Debe existir reconciliación completa de seguridad para detectar deriva del read model.
- Los filtros reales deben reducir trabajo en base de datos, no limitar únicamente el número de filas enviado al navegador.
- La optimización no puede alterar la semántica actual de estados, overrides manuales, prioridades o reglas de Calidad de Series.

### Objetivo

Que una consulta como `missing`, `unmapped`, `tracking` u otra clasificación equivalente pueda resolverse conceptualmente con `WHERE ... ORDER BY ... LIMIT ...` sobre datos derivados preparados, haciendo que el coste interactivo dependa de la selección solicitada y no del universo completo de episodios en cada request.
