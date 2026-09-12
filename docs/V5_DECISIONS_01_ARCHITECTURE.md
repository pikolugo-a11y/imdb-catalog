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

## ARQ-02 — Gateway único para lanzar trabajo largo

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 tendrá una única capa canónica para solicitar ejecuciones durables, de modo que las superficies de producto, automatizaciones y orquestadores pidan la ejecución de un proceso sin conocer directamente los detalles de la infraestructura que lo ejecuta.

La interfaz conceptual será equivalente a `enqueueProcess(...)` o similar. Su nombre exacto se decidirá durante implementación.

### Responsabilidades del gateway

- Resolver el destino correcto del proceso (`api`, `fast`, `plex` o una excepción explícita como GitHub Actions).
- Crear o reutilizar el `process_run` canónico aplicando la política de idempotencia correspondiente.
- Crear el control e items Batch cuando el proceso sea durable.
- Persistir `executor`, `worker_pool`, correlación y contexto de forma coherente.
- Rechazar combinaciones de proceso/pool/executor no permitidas por el registro canónico.
- Centralizar la trazabilidad mínima necesaria para que Actividad y Operaciones puedan seguir la ejecución.

### Límites

- No introduce un nuevo servicio ni un nuevo broker.
- Neon sigue siendo la coordinación durable.
- Railway y GitHub Actions conservan sus funciones actuales como executors donde corresponda.
- No obliga a convertir en asíncrono el trabajo que deba seguir siendo síncrono y corto.

### Motivo

La auditoría encontró que varios puntos del sistema conocen y construyen por separado detalles de `process_runs`, Batch, pools y executors. Esa dispersión aumenta el acoplamiento y facilita inconsistencias como asignar un executor incorrecto aunque el trabajo llegue al pool correcto.

ARQ-02 también será la vía natural para ARQ-01: Vercel solicitará `PROC-NOV-009` mediante el gateway y no necesitará conocer cómo se materializa la cola Plex.

### Alcance V5

La implementación deberá preservar idempotencia y semántica funcional de cada proceso. El gateway será una frontera arquitectónica común, no un lugar donde duplicar lógica de negocio propia de los procesos.
