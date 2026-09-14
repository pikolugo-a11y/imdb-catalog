# PikoFilm V5 — Innovaciones 02: Rendimiento

Estado: **EN REVISIÓN**  
Fecha de inicio: **2026-09-14**  
Rama: `audit/v5-02-performance`

Este documento registra las decisiones de la Fase 3 del Punto 2 — Rendimiento. Se revisan una a una y cada decisión se persiste antes de presentar la siguiente. Sólo las innovaciones aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

Criterio reforzado desde INNO-PERF-03: esta fase exige propuestas verdaderamente rompedoras, capaces de cambiar de forma sustancial la arquitectura o la experiencia de rendimiento de PikoFilm. Mejoras incrementales, patrones técnicos habituales o simples cambios de implementación no alcanzan por sí solos el listón de innovación de esta fase.

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

---

## INNO-PERF-02 — Modo adaptativo según coste real

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-14

### Idea evaluada

Dotar a las superficies de lectura de un mecanismo adaptativo capaz de modificar automáticamente su estrategia de ejecución según latencia, carga, volumen o coste observado. Entre otras posibilidades, podría reducir cálculos secundarios, aplazar enriquecimientos no esenciales o elegir rutas de lectura más ligeras cuando el sistema estuviese bajo presión.

### Motivo del rechazo

El comportamiento adaptativo añade variabilidad funcional y operativa: una misma pantalla podría resolver peticiones equivalentes de forma distinta según el estado instantáneo del sistema. Esa pérdida de predictibilidad no encaja con el objetivo de que PikoFilm sea comprensible, estable y fácil de diagnosticar.

Las mejoras de rendimiento deben priorizar rutas de lectura deterministas, presupuestos claros, read models bien mantenidos y degradaciones explícitas sólo cuando exista una necesidad funcional real, evitando introducir un gobernador automático que cambie silenciosamente el trabajo realizado por cada request.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantiene como principio que una misma operación debe tener una estrategia de lectura predecible y observable.
- La gestión de carga se resolverá preferentemente mediante arquitectura, colas, read models, límites y capacidad, no mediante cambios silenciosos de comportamiento en el frontal.

---

## INNO-PERF-03 — Actualización instantánea por eventos

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-14

### Idea evaluada

Hacer que cambios relevantes del sistema emitan eventos de dominio para actualizar o invalidar de forma granular los read models, contadores y superficies afectadas, reduciendo polling y refrescos generales.

### Motivo del rechazo

Aunque puede ser una buena decisión de arquitectura en determinados contextos, no constituye una innovación suficientemente rompedora para esta fase. Es un patrón técnico conocido y, en PikoFilm, se percibe principalmente como una mejora de implementación y coordinación entre componentes, no como un salto cualitativo en rendimiento o experiencia.

La ronda de innovación debe reservarse para ideas que cambien de verdad el paradigma de uso o de ejecución del sistema, no para etiquetar como innovación cualquier optimización arquitectónica razonable.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Los eventos de dominio pueden volver a aparecer en fases de arquitectura, procesos, observabilidad o implementación sin considerarse por ello innovación.
- Las siguientes propuestas de esta ronda deberán superar explícitamente un listón de ruptura mucho mayor.
