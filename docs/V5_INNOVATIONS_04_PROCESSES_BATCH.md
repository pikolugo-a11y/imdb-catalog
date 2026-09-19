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


---

## INNO-PROC-02 — PikoFilm Shadow Scheduler

**Estado: APROBADA.**

### Idea revisada

Crear un planificador futuro en modo sombra capaz de simular varios repartos posibles de la demanda real sin ejecutar ninguno de ellos.

El sistema combinaría:

- demanda agregada de PROC-07;
- capacidad de workers;
- deadlines y prioridades;
- límites de APIs;
- duraciones históricas;
- picos deliberados;
- ventanas funcionales de los procesos.

Podría comparar escenarios como carga uniforme, mayor concentración nocturna o picos deliberados, estimando duración, backlog, presión de APIs y fecha de finalización.

### Modo shadow

La simulación no modifica el planner real ni materializa Batches.

El sistema real ejecuta su política vigente mientras Shadow Scheduler calcula qué habría ocurrido con políticas alternativas y compara posteriormente previsión frente a resultado observado.

### Evolución posible

En una fase posterior podría:

- responder preguntas “qué pasa si…”;
- recomendar repartos de carga;
- aprender de duraciones reales sin necesidad de IA;
- proponer políticas mejores;
- servir como capacidad especializada de PikoFilm Autopilot.

Nunca adopta automáticamente una estrategia nueva sólo por existir una simulación; cualquier promoción a automatismo requerirá una decisión futura específica.

### Decisión

**APROBADA por el usuario.**

Se incorpora a `docs/ROADMAP_INNOVADOR.md` como **INNO-03 — PikoFilm Shadow Scheduler**.

No entra automáticamente en V5, V6 ni V7.


---

## INNO-PROC-03 — PikoFilm Adaptive Freshness

**Estado: APROBADA.**

### Idea revisada

Evolucionar desde cadencias fijas de mantenimiento hacia un motor que calcule cuándo conviene refrescar cada dato o entidad según su probabilidad real de cambio, ciclo de vida y SLA funcional.

El intervalo recomendado podría considerar, entre otras señales:

- antigüedad del título;
- fecha de estreno;
- estado activo/finalizado de una serie;
- variación observada en comprobaciones anteriores;
- velocidad de crecimiento de votos;
- frecuencia de `no_change`;
- estabilidad de la fuente;
- errores recientes;
- SLA máximo del dominio.

### Principio

La optimización siempre queda limitada por guardrails funcionales.

Si la probabilidad calculada sugiere revisar en 45 días pero el SLA máximo del proceso es 14 días, la siguiente comprobación será como máximo a 14 días.

Un cambio nuevo puede acelerar temporalmente una entidad previamente estable.

### Relación con planificación

Adaptive Freshness decide **cuándo** necesita revisión una entidad.

Shadow Scheduler puede decidir después **cómo** repartir esa demanda en el tiempo.

### Decisión

**APROBADA por el usuario.**

Se incorpora a `docs/ROADMAP_INNOVADOR.md` como **INNO-04 — PikoFilm Adaptive Freshness**.

No entra automáticamente en V5, V6 ni V7.
