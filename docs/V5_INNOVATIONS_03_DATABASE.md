# PikoFilm V5 — Innovaciones 03: Base de datos y modelo de datos

Estado: **EN REVISIÓN**  
Fecha de inicio: **2026-09-19**  
Rama: `audit/v5-03-database`

Este documento registra las decisiones de la Fase 3 del Punto 3 — Base de datos y modelo de datos. Las innovaciones se revisan una a una y cada decisión se persiste antes de presentar la siguiente. Sólo las aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

La ronda exige al menos 5 propuestas deliberadamente rompedoras. Mejoras incrementales, simples optimizaciones SQL o medidas ya incluidas en DB-01..DB-11 no cuentan como innovación.

---

## INNO-DB-01 — PikoFilm Data Twin

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-19

### Idea evaluada

Crear bajo demanda un gemelo temporal de la base real en una rama aislada de Neon para ejecutar sobre él cambios de alto impacto, backfills y procesos completos, y generar un diff semántico del resultado antes de tocar producción.

La propuesta iba más allá del smoke test de migraciones: pretendía comparar entidades, decisiones manuales, Series, Personas, almacenamiento y resultados funcionales entre el estado actual y el estado simulado.

### Motivo del rechazo

El usuario rechaza incorporar esta idea al Road Map Innovador. Aunque podría aumentar la seguridad de cambios grandes, añade una capa relevante de simulación, aislamiento, ejecución y mantenimiento que no se considera una apuesta futura prioritaria para PikoFilm.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantiene el workflow branch-first ya aprobado en DB-05 para migraciones y pruebas controladas.
- Esta decisión no impide utilizar ramas temporales de Neon para tests/migraciones concretas cuando formen parte del trabajo normal.


---

## INNO-DB-02 — PikoFilm Truth Engine

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-19

### Idea evaluada

Introducir una capa de evidencias estructuradas por campo y fuente para que PikoFilm pudiera conservar no sólo el valor canónico final, sino también qué fuentes sostienen valores alternativos, qué regla resolvió el conflicto y por qué un dato concreto se considera verdadero.

La arquitectura propuesta era:

`fuentes → claims estructurados → reglas canónicas versionadas → valor canónico`.

### Motivo del rechazo

El usuario no aprecia una utilidad práctica suficiente. Para el tamaño y uso actual de PikoFilm, las reglas canónicas explícitas, los procesos de Calidad y la trazabilidad ya disponible cubren adecuadamente las necesidades funcionales.

La propuesta añadiría una capa de modelado y mantenimiento considerable —prácticamente una base explicativa sobre la base principal— sin aportar un beneficio proporcional en el uso real.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantienen los modelos canónicos simples como fuente de verdad.
- Cuando existan discrepancias entre fuentes, se resolverán mediante reglas de producto/datos concretas y tests, sin crear un motor general de claims/evidencias.


---

## INNO-DB-03 — PikoFilm Phoenix

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-19

### Idea evaluada

Separar conceptualmente PikoFilm en un núcleo mínimo irremplazable —catálogo, decisiones manuales, overrides, reglas y configuración— y una gran capa reconstruible de metadata, ratings, Plex, Personas, Calidad, read models y estados derivados.

El objetivo era poder levantar una base prácticamente desde cero restaurando sólo el núcleo y regenerando automáticamente todo lo demás.

### Motivo del rechazo

El usuario no considera útil orientar el producto hacia una capacidad de reconstrucción total de este tipo. Aunque puede aportar resiliencia y portabilidad, añade complejidad de diseño y recovery que no aporta suficiente valor práctico frente a backups, migraciones seguras y mecanismos de rebuild específicos ya previstos para los dominios que realmente lo necesitan.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantienen backups y recovery convencionales, más rebuilds específicos donde DB-06 los declare necesarios.
- No se perseguirá una reconstrucción integral de toda la plataforma como objetivo de producto.


---

## INNO-DB-04 — PikoFilm Self-Healing Data

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-19

### Idea evaluada

Crear una capa autónoma de integridad capaz de detectar drift funcional, clasificar incidencias y reparar automáticamente sólo aquellas incoherencias que afecten a datos derivados, tengan una fuente canónica clara y puedan reconstruirse de forma determinista y segura.

La propuesta incluía integración con Calidad/Actividad, reparación automática de read models/caches/metadata reconstruible y escalado manual de cualquier caso ambiguo o que afectase decisiones del usuario.

### Motivo del rechazo

El usuario rechaza incorporar esta idea al Road Map Innovador. Aunque podría reducir trabajo manual de mantenimiento, añade una capa autónoma adicional de reparación que no se considera necesaria ni prioritaria.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantienen diagnósticos, rebuilds y reparaciones explícitas por dominio cuando sean necesarias.
- Las decisiones manuales y datos no reconstruibles continúan protegidos por DB-06 sin introducir un motor general de autoreparación.
