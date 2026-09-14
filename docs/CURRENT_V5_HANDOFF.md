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

Presentar como mínimo 10 propuestas concretas derivadas de la auditoría. Revisarlas UNA A UNA. Cada una debe quedar APROBADA o RECHAZADA y persistida en Git antes de pasar a la siguiente.

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

- Auditoría: `docs/V5_AUDIT_01_ARCHITECTURE.md`.
- 15/15 propuestas V5 aprobadas.
- Ronda de innovación completada.
- Innovación aprobada: `INNO-01 — PikoFilm Autopilot`.

### Punto 2 — Rendimiento

CERRADO.

- Auditoría: `docs/V5_AUDIT_02_PERFORMANCE.md`.
- Fase 2: `PERF-01` a `PERF-10` aprobadas y persistidas en `docs/V5_DECISIONS_02_PERFORMANCE.md`.
- Fase 3: cinco innovaciones revisadas y persistidas en `docs/V5_INNOVATIONS_02_PERFORMANCE.md`.
- Rechazadas: `INNO-PERF-01`, `INNO-PERF-02`, `INNO-PERF-03` e `INNO-PERF-05`.
- Aprobada: `INNO-PERF-04 — PikoFilm Native / Local-First`, registrada en `docs/ROADMAP_INNOVADOR.md` como `INNO-02`.
- Criterio reforzado: una innovación del Road Map debe ser una ruptura real de paradigma; patrones técnicos habituales o mejoras incrementales no alcanzan el listón por sí solos.
- Límite de `INNO-02`: debe aportar valor completo con un único ordenador. No presupone NAS, granja de equipos ni infraestructura doméstica adicional.

### Punto 3 — Base de datos y modelo de datos

SIGUIENTE PUNTO.

El siguiente paso exacto es iniciar la **Fase 1 — auditoría extremadamente detallada** del sistema real de datos. Debe revisarse, entre otros aspectos:

- esquema real de Neon y dependencias entre tablas/vistas;
- datos canónicos frente a read models/proyecciones;
- tablas redundantes, históricas, temporales u obsoletas;
- tamaños, crecimiento, churn, dead tuples y bloat;
- índices existentes, ausentes, duplicados o poco útiles;
- claves, constraints, integridad referencial e identidades;
- retención y limpieza, especialmente tablas operativas/logs;
- migraciones y compatibilidad con el workflow branch-first;
- patrones reales de escritura/lectura desde Vercel y Railway;
- coste, escalabilidad, recuperación y riesgos de consistencia.

La auditoría debe contrastar Git con Neon vivo y persistirse en un nuevo documento del Punto 3 antes de presentar ninguna propuesta `DB-xx`.

## Contexto funcional reciente ya cerrado

Durante la revisión de Rendimiento se corrigieron problemas reales detectados usando la aplicación. No reabrirlos salvo nueva evidencia.

- PR #553: capítulos combinados dobles/triples.
- PR #556: corrección doble→triple.
- PR #557: prioridad España y perfil TMDb de Series.
- PR #558: detalle de Calidad · Series aligerado.
- PR #560: exclusión manual reversible de episodios oficiales en Calidad · Series mediante `series_episode_overrides.decision='unavailable'`.
- PR #560 está desplegado en Vercel Production en el commit `bccf8ffe81d8eaeda22c547e97c7c6e9ad920132`; la migración Neon branch-first también quedó aplicada en producción.

## Persistencia y documentos canónicos

- Marco/metodología/20 puntos/estado: `docs/V5_ROADMAP_FRAMEWORK.md`
- Auditoría Punto 2: `docs/V5_AUDIT_02_PERFORMANCE.md`
- Decisiones Punto 2: `docs/V5_DECISIONS_02_PERFORMANCE.md`
- Innovaciones Punto 2: `docs/V5_INNOVATIONS_02_PERFORMANCE.md`
- Innovaciones aprobadas: `docs/ROADMAP_INNOVADOR.md`
- Punto de reentrada de chat: `docs/CURRENT_V5_HANDOFF.md`

Al iniciar el Punto 3, usar una única rama dirigida por bloque y mantener este handoff actualizado para que un chat nuevo pueda continuar sin pedir al usuario que repita contexto.
