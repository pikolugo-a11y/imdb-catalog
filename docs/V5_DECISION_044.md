# PikoFilm V5 — Decisión 44

### Mejora 44 · V5-C044 — Crear snapshots diarios para análisis de evolución

**Estado:** RECHAZADA  
**Prioridad definitiva:** No entra como mejora nueva en V5.  
**Categoría:** Inicio · Analítica · Snapshots · Arquitectura

**Motivo de rechazo**

La capacidad propuesta ya existe en esencia dentro de la arquitectura V4 mediante `dashboard_snapshots` y el proceso/cron de `dashboard-snapshot`. Crear otra capa de snapshots diarios duplicaría una capacidad ya existente y generaría riesgo de dos mecanismos paralelos para representar el mismo histórico.

**Consecuencia para V5**

- No se creará un sistema nuevo de snapshots diarios.
- Durante la implantación de las mejoras de Inicio se revisará si los snapshots actuales contienen los indicadores necesarios y se generan correctamente.
- Si falta algún dato concreto para una comparativa útil, se ampliará puntualmente la capacidad existente en vez de crear otra arquitectura.
- Debe preservarse una única fuente canónica para este tipo de fotografía histórica.

**Resultado esperado para el usuario**

V5 reutilizará la capacidad ya existente para históricos y comparativas, evitando duplicidad técnica y almacenamiento innecesario. Sólo se ampliará lo existente cuando haya una necesidad funcional concreta.

**Decisión del usuario:** rechazada por duplicidad con capacidad existente.
