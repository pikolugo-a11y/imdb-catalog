# PikoFilm V4 — Actividad

Estado: **contrato funcional en construcción**.

Este documento fija las decisiones aprobadas para Actividad V4. Cada decisión se persiste aquí antes de avanzar a la siguiente. La implementación debe respetar `AGENTS.md`, `docs/PROJECT_RULES.md`, la arquitectura canónica y la frontera de observabilidad basada en `process_runs` + eventos/errores.

## Decisión 1 — Propósito de Actividad

**Aprobada.**

Actividad V4 será el **historial funcional, humano y comprensible de lo que PikoFilm ha hecho**.

Debe permitir entender hechos como, por ejemplo:

- se actualizó una película o serie;
- se sincronizó Plex;
- se recalculó PikoScore;
- se admitió, excluyó o restauró un título;
- se refrescaron datos, calidad, personas o sagas;
- una acción o proceso falló;
- cuando exista una entidad afectada, se podrá navegar hacia ella.

Actividad **no** será la consola técnica del sistema. Los detalles de `process_runs`, workers, Batch, colas, leases, reintentos, métricas, errores técnicos y mantenimiento administrativo pertenecen a **Operaciones V4**.

### Separación funcional aprobada

- **Actividad V4** = visión funcional orientada al usuario: qué ocurrió en PikoFilm y sobre qué entidad.
- **Operaciones V4** = visión técnica/administrativa: cómo se ejecutó, estado operativo, errores, retry, Batch, workers y mantenimiento.

Esta separación no crea una nueva fuente de verdad de observabilidad: Actividad debe construirse sobre la información canónica existente y sus read models/derivados cuando corresponda, sin inventar un sistema paralelo de logs.
