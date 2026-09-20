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


---

## INNO-WKR-02 — PikoFilm Burst Mode

**RECHAZADA.**

### Motivo

La propuesta planteaba aumentar temporalmente el número de workers ante picos extraordinarios de backlog y volver después a una sola réplica.

Se rechaza porque PikoFilm es una aplicación personal con un catálogo de unas 20.000 películas y el volumen real esperado no justifica diseñar autoescalado para escenarios artificiales de miles o decenas de miles de trabajos simultáneos.

En este contexto:

- una réplica por servicio tiene capacidad suficiente según la auditoría real;
- WKR-13 ya gobierna correctamente la concurrencia segura;
- añadir autoescalado introduce complejidad operacional y potencial coste sin una necesidad demostrada;
- un sistema personal debe priorizar simplicidad, fiabilidad y eficiencia sobre elasticidad pensada para plataformas multiusuario.

### Decisión

No se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Invariante derivada

> Las innovaciones de infraestructura deben dimensionarse para el producto real: PikoFilm es una aplicación personal y no debe diseñarse como una plataforma SaaS masiva sin una necesidad concreta.
