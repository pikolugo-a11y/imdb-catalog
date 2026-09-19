# PikoFilm V5 — Innovaciones 03: Base de datos y modelo de datos

Estado: **EN REVISIÓN**  
Fecha de inicio: **2026-09-19**  
Rama: `audit/v5-03-database`

Este documento registra las decisiones de la Fase 3 del Punto 3 — Base de datos y modelo de datos. Las innovaciones se revisan una a una y cada decisión se persiste antes de presentar la siguiente. Sólo las aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

La ronda exige al menos 5 propuestas deliberadamente rompedoras. Mejoras incrementales, simples optimizaciones SQL o medidas ya incluidas en DB-01..DB-11 no cuentan como innovación.

---

## INNO-DB-01 — PikoFilm Data Twin

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-19

### Idea evaluada

Crear bajo demanda un gemelo temporal de la base real en una rama aislada de Neon para ejecutar sobre él cambios de alto impacto, backfills y procesos completos, y generar un diff semántico del resultado antes de tocar producción.

La propuesta iba más allá del smoke test de migraciones: pretendía comparar entidades, decisiones manuales, Series, Personas, almacenamiento y resultados funcionales entre el estado actual y el estado simulado.

### Motivo del rechazo

El usuario rechaza incorporar esta idea al Road Map Innovador. Aunque podría aumentar la seguridad de cambios grandes, añade una capa relevante de simulación, aislamiento, ejecución y mantenimiento que no se considera una apuesta futura prioritaria para PikoFilm.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantiene el workflow branch-first ya aprobado en DB-05 para migraciones y pruebas controladas.
- Esta decisión no impide utilizar ramas temporales de Neon para tests/migraciones concretas cuando formen parte del trabajo normal.
