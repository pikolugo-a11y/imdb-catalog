# PikoFilm V5 — Innovaciones 04: Procesos automáticos y Batch

Estado: **FASE 3 ACTIVA**  
Rama: `audit/v5-04-processes`

Este documento registra la ronda de innovación del Punto 4. Las innovaciones se revisan una a una. Sólo las aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

---

## INNO-PROC-01 — PikoFilm Event Fabric

**Estado: RECHAZADA.**

### Idea revisada

Evolucionar en una versión futura desde un modelo primariamente basado en planner/cron hacia una arquitectura de eventos de dominio durables:

- cambios del catálogo generan eventos;
- consumidores reaccionan a esos eventos;
- timers quedan principalmente para vencimientos temporales;
- posibilidad futura de trazabilidad causal y replay selectivo;
- implementación ligera sobre Neon/outbox, sin requerir Kafka u otra infraestructura pesada.

### Decisión

**RECHAZADA por el usuario.**

No se añade a `docs/ROADMAP_INNOVADOR.md` y no queda como backlog implícito.

La arquitectura aprobada para V5 permanece basada en el planner horario único de PROC-06 y en continuaciones durables explícitas cuando un proceso necesite reacción inmediata.
