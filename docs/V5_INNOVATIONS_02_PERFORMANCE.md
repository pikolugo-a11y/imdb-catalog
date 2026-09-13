# PikoFilm V5 — Innovaciones 02: Rendimiento

Estado: **EN REVISIÓN**  
Fecha de inicio: **2026-09-14**  
Rama: `audit/v5-02-performance`

Este documento registra las decisiones de la Fase 3 del Punto 2 — Rendimiento. Se revisan una a una y cada decisión se persiste antes de presentar la siguiente. Sólo las innovaciones aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

---

## INNO-PERF-01 — Snapshots instantáneos para superficies de lectura

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-14

### Idea evaluada

Generar snapshots compactos, inmutables, derivados y versionados para superficies de lectura poco volátiles y muy consultadas como Catálogo, Personas, Sagas y partes de Calidad, publicándolos atómicamente y cacheándolos cerca del frontend.

### Motivo del rechazo

PikoFilm se considera un sistema vivo. Un snapshot publicado con cadencia propia introduce una ventana en la que una alta o modificación recién realizada —por ejemplo añadir una película— podría no aparecer inmediatamente en el frontal.

La alternativa de invalidar o regenerar el snapshot de forma inmediata ante cada mutación reduciría ese desfase, pero añade una capa importante de complejidad de invalidación, publicación y versionado. Para el objetivo actual, esa complejidad no compensa frente a read models incrementales, consultas preparadas y caché con invalidación ligada a cambios reales.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantiene como principio de producto que las mutaciones relevantes deben reflejarse de forma prácticamente inmediata en las superficies de lectura afectadas.
- Las optimizaciones de rendimiento no deben convertir Catálogo, Calidad u otras superficies funcionales en vistas periódicamente congeladas.
