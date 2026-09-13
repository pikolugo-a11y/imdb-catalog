# PikoFilm V5 — Handoff actual

Fecha: 2026-09-14

Este documento es el punto de reentrada canónico para continuar la definición de V5 sin depender del historial del chat.

## Repositorio y forma de trabajo

Repositorio: `pikolugo-a11y/imdb-catalog`.

Antes de continuar hay que leer, como mínimo:

- `AGENTS.md`
- `docs/README.md`
- `docs/PROJECT_RULES.md`
- `docs/AI_DEVELOPMENT_GUIDE.md`
- `docs/V5_ROADMAP_FRAMEWORK.md`
- este `docs/CURRENT_V5_HANDOFF.md`
- los documentos de auditoría/decisiones del punto activo
- `docs/ROADMAP_INNOVADOR.md`

Reglas operativas:

- El asistente hace auditoría, diseño/UX, implementación cuando corresponda, tests, PR, CI y merge.
- El usuario sólo hace el deploy de Vercel Production y la validación visual/funcional final.
- El asistente NO despliega Vercel Production.
- Una única rama dirigida por corrección/bloque; evitar proliferación de ramas.
- Cada decisión V5 aprobada o rechazada se persiste en Git ANTES de presentar la siguiente.
- La documentación no prevalece sobre el estado real: contrastar código, Neon, Railway, Vercel y ejecución viva cuando aplique.

## Frontera de producto fija

PikoFilm gestiona BBDD, catálogo, calidad, procesos, integraciones y operaciones. Plex gestiona historial personal de visionado y señales de gusto.

PikoFilm no debe convertirse en gestor de visto/no visto ni construir perfiles/recomendaciones personales basados en historial de visionado. Si el catálogo necesita conocer un estado de visionado, se trata como dato externo de Plex.

## Método obligatorio para CADA UNO de los 20 puntos

No saltarse fases ni reducirlas.

### Fase 1 — Auditoría

Auditoría completa, profunda y extremadamente detallada del sistema REAL del dominio. Revisar lo materialmente relevante: código, datos, esquema e índices, infraestructura, ejecución, colas, workers, integraciones, frontend/UX, CI/CD, seguridad, costes, logs, métricas y documentación. Identificar bugs, deuda, duplicidades, incoherencias, costes, cuellos de botella, resiliencia y oportunidades. Persistir la auditoría en Git.

### Fase 2 — Propuestas V5

Presentar como mínimo 10 propuestas concretas derivadas de la auditoría. Pueden ser mejoras funcionales, bugs, simplificaciones, UX, rendimiento, arquitectura, costes, seguridad, etc. Revisarlas UNA A UNA. Cada una debe quedar APROBADA o RECHAZADA y persistida en Git antes de pasar a la siguiente.

### Fase 3 — Road Map Innovador

Después de las propuestas, presentar como mínimo 5 innovaciones deliberadamente rompedoras para futuro. Revisarlas UNA A UNA. Sólo las aprobadas se añaden a `docs/ROADMAP_INNOVADOR.md`. Una innovación aprobada no entra automáticamente en V5/V6/V7.

Un punto sólo se cierra cuando las tres fases están completas y persistidas.

## Los 20 puntos

1. Arquitectura general
2. Rendimiento
3. Base de datos y modelo de datos
4. Procesos automáticos y Batch
5. Observabilidad y errores
6. Workers y servicios persistentes
7. Integraciones externas
8. Frontend y UX
9. Sistema de diseño / CSS
10. Código legacy y deuda técnica
11. Tests
12. CI/CD
13. Seguridad
14. Coste
15. Mantenibilidad
16. Escalabilidad
17. Consistencia funcional
18. Recuperación y resiliencia
19. Calidad de datos
20. Gobierno del producto

La definición extensa y el estado formal viven en `docs/V5_ROADMAP_FRAMEWORK.md`.

## Estado actual

### Punto 1 — Arquitectura general

CERRADO.

- Auditoría: `docs/V5_AUDIT_01_ARCHITECTURE.md`
- Decisiones: `docs/V5_DECISIONS_01_ARCHITECTURE.md` y `docs/V5_DECISIONS_01_ARCHITECTURE_10_15.md`
- 15/15 propuestas V5 aprobadas.
- Ronda de innovación completada.
- Innovación aprobada: `INNO-01 — PikoFilm Autopilot`, registrada en `docs/ROADMAP_INNOVADOR.md`.

### Punto 2 — Rendimiento

ACTIVO. Rama de trabajo documental: `audit/v5-02-performance`.

Fase 1 — AUDITORÍA: COMPLETADA y persistida en `docs/V5_AUDIT_02_PERFORMANCE.md`.

Fase 2 — PROPUESTAS: COMPLETADA. `PERF-01` a `PERF-10` están APROBADAS y persistidas en `docs/V5_DECISIONS_02_PERFORMANCE.md`.

Última decisión: `PERF-10 — Presupuesto de rendimiento por pantalla crítica`, aprobada y persistida en commit `5091b953...` de esta rama. La idea es proteger con contratos estructurales el rendimiento de superficies críticas, evitando umbrales frágiles de milisegundos en CI.

Fase 3 — INNOVACIONES: ACTIVA.

La primera propuesta ya fue presentada al usuario pero NO fue aprobada ni rechazada porque la conversación se desvió a correcciones funcionales. Hay que reanudar exactamente aquí:

`INNO-PERF-01 — Snapshots instantáneos para superficies de lectura`

Idea: para superficies de lectura poco volátiles y muy consultadas (Catálogo, Personas, Sagas y partes de Calidad), generar snapshots compactos, inmutables, derivados y versionados, publicados atómicamente y cacheables cerca del frontend. No son fuente de verdad y no se aplican a Actividad/Operaciones/estado vivo. Objetivo: navegación casi instantánea, menos fanout y menos tráfico Vercel↔Neon. Riesgos: invalidación, frescura y complejidad de versiones. Horizonte sugerido: experimento V6 tras los read models V5.

SIGUIENTE PASO EXACTO: pedir al usuario `¿Apruebas o rechazas INNO-PERF-01?`. No presentar INNO-PERF-02 antes de esa decisión y de persistirla si corresponde.

Después hay que completar una ronda de AL MENOS 5 innovaciones de Rendimiento, una a una. Sólo las aprobadas entran en `docs/ROADMAP_INNOVADOR.md`. Cuando termine esa ronda, marcar el Punto 2 como CERRADO en el framework y pasar al Punto 3 — Base de datos y modelo de datos, empezando por su auditoría extremadamente detallada.

## Contexto funcional reciente que ya está en main

Durante la pausa de PERF se corrigieron problemas reales detectados usando la aplicación. No reabrirlos salvo nueva evidencia.

- PR #553: soporte funcional de capítulos combinados dobles/triples.
- PR #556: corrección de ampliación doble→triple cuando el episodio intermedio ya estaba cubierto por el mismo archivo Plex.
- PR #557: prioridad España para Series sin depender de FilmAffinity, perfil TMDb de temporadas/episodios/origen/proveedores y visualización T/E en Catálogo/ficha; FilmAffinity queda fuera de esta solución.
- PR #558: detalle de Calidad · Series aligerado: temporadas/episodios siguen como cuerpo principal; pendientes y decisiones manuales se cargan sólo bajo demanda en paneles paginados; se retiró seguimiento batch del render normal de la ficha. Merge de main: `f56d1229ac83c87484af2e80293721f50f0fe5e3`; CI success.
- PR #560: exclusión manual reversible de episodios oficiales en Calidad · Series. Usa `series_episode_overrides.decision='unavailable'`; la exclusión cuenta como cobertura efectiva y deja de ser pendiente sin falsear la presencia física en Plex. La UI muestra `⊘ Exclusión`, permite `Quitar exclusión`, y el agregado se denomina `Cobertura efectiva`. Merge de main: `bccf8ffe81d8eaeda22c547e97c7c6e9ad920132`; CI y migración Neon branch-first success. Contrato persistido en `docs/changes/2026-09-14_SERIES_EPISODE_EXCLUSIONS.md`. Queda únicamente deploy Vercel Production y validación visual/funcional por el usuario.

Estas correcciones no cambian el punto exacto del roadmap: seguimos en la Fase 3 del Punto 2.

## Persistencia y documentos canónicos

- Marco/metodología/20 puntos/estado: `docs/V5_ROADMAP_FRAMEWORK.md`
- Auditoría Punto 2: `docs/V5_AUDIT_02_PERFORMANCE.md`
- Decisiones PERF-01..10: `docs/V5_DECISIONS_02_PERFORMANCE.md`
- Innovaciones aprobadas: `docs/ROADMAP_INNOVADOR.md`
- Punto de reentrada de chat: `docs/CURRENT_V5_HANDOFF.md`

Al cerrar cada punto, actualizar el framework y este handoff para que un chat nuevo pueda continuar sin pedir al usuario que repita contexto.
