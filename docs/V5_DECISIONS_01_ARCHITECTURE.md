# PikoFilm V5 — Decisiones 01: Arquitectura general

Estado: **EN REVISIÓN**  
Rama de trabajo: `roadmap/v5-01-architecture-decisions`

Este documento registra las decisiones del Punto 1 — Arquitectura general. Cada decisión se persiste antes de pasar a la siguiente propuesta.

## ARQ-01 — Sacar `PROC-NOV-009` de la ejecución larga de Vercel

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

Vercel conservará la responsabilidad de iniciar y controlar la operación, pero no ejecutará la sincronización global de Plex de larga duración. La ejecución real de `PROC-NOV-009` se moverá a un executor durable en Railway, preferentemente al pool Plex, utilizando Neon como estado y coordinación durable.

### Comportamiento esperado

- El usuario seguirá iniciando la sincronización desde PikoFilm de forma manual.
- Vercel creará/encolará el trabajo y responderá rápidamente.
- Railway ejecutará la sincronización hasta completar, sin depender del límite temporal de una Server Action de Vercel.
- Neon mantendrá el estado canónico del run, progreso, eventos y resultado.
- Actividad/Operaciones seguirán mostrando el estado y resultado al usuario.
- No se introduce automatización nueva de Plex por esta decisión; sólo cambia el lugar de ejecución.

### Motivo

La auditoría detectó que `PROC-NOV-009` es trabajo pesado que actualmente contradice la frontera arquitectónica Vercel=control / Railway=ejecución durable. La incidencia real de timeout/504 y el límite preventivo de 280 s demuestran que mantener esta operación dentro de Vercel es frágil.

### Alcance V5

Esta decisión define la dirección arquitectónica. La implementación concreta se diseñará después de cerrar el roadmap V5 y deberá preservar trazabilidad, idempotencia, recuperación y UX existentes.
