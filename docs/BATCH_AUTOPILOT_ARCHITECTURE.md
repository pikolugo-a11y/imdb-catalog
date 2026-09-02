# PikoFilm — Batch Engine / Autopilot (histórico)

> **Estado: RETIRADO como fuente canónica.**

Este documento describía la generación M46 inicial basada, entre otras estructuras, en `batch_runs` y `batch_jobs`. Esas tablas pertenecen a Batch V1 y fueron retiradas durante PRE-V4.

No usar este archivo para implementar, auditar ni modificar Batch.

## Fuentes vigentes

1. `docs/processes/PROCESS_CATALOG.md`
2. `docs/processes/BATCH_ARCHITECTURE.md`
3. `docs/architecture/EXECUTION_ARCHITECTURE.md`
4. `docs/architecture/OBSERVABILITY.md`
5. código vivo y estado real de Railway/Neon/Vercel

## Regla preservada

La idea arquitectónica que sí permanece vigente es: **Batch orquesta y repite la misma operación canónica que el individual; no mantiene una receta funcional paralela.**

El historial completo de este diseño permanece disponible en Git. Este tombstone evita que una IA futura confunda una especificación M46 con el sistema actual.