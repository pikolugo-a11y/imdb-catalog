# PikoFilm V5 — Innovaciones Punto 6 · Workers y servicios persistentes

Estado: **Fase 3 activa**.

Regla: revisar al menos 5 innovaciones una a una. Sólo las aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

---

## INNO-WKR-01 — PikoFilm Runtime Fabric

**RECHAZADA.**

### Motivo

La propuesta abstraía los workers físicos en una malla genérica de capacidades capaz de elegir dinámicamente dónde ejecutar cada proceso.

Se rechaza porque, para el uso real y el horizonte próximo de PikoFilm:

- no aporta una mejora funcional clara;
- añade una capa importante de abstracción y complejidad;
- los cuatro workers actuales ya cubren correctamente las necesidades observadas;
- no existe necesidad demostrada de mover dinámicamente procesos entre múltiples infraestructuras;
- el valor potencial futuro no compensa hoy el coste conceptual y operativo.

### Decisión

No se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Invariante derivada

> Una innovación de infraestructura sólo merece entrar en el Road Map Innovador cuando ofrece una mejora comprensible y material para PikoFilm, no únicamente una arquitectura más genérica.
