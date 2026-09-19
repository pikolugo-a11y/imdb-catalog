# PikoFilm V5 — Innovaciones 05: Observabilidad y errores

Fecha: 2026-09-19  
Estado: **FASE 3 ACTIVA**

Este documento registra las innovaciones futuras del Punto 5 — Observabilidad y errores.

Reglas:

- se revisan como mínimo 5 innovaciones, una a una;
- cada una queda APROBADA o RECHAZADA antes de presentar la siguiente;
- sólo las aprobadas se añaden a `docs/ROADMAP_INNOVADOR.md`;
- una innovación aprobada no entra automáticamente en V5, V6 ni V7;
- no se implementa ninguna innovación durante esta fase salvo autorización explícita.


---

## INNO-OBS-01 — PikoFilm Causal X-Ray

**Estado: RECHAZADA.**

### Idea revisada

Reconstruir automáticamente la cadena causal completa de un cambio o incidencia —fuente externa, proceso, runtime, decisión, datos modificados y consecuencias posteriores— en una única vista explicable.

### Decisión

**RECHAZADA por el usuario.**

No se añade a `docs/ROADMAP_INNOVADOR.md` y no queda como backlog implícito.


---

## INNO-OBS-02 — PikoFilm Sentinel

**Estado: APROBADA.**

### Idea revisada

Crear una red futura de canarios sintéticos y pruebas extremo a extremo seguras para verificar que las rutas críticas están realmente operativas antes de lanzar trabajo importante.

Los canarios podrán validar, según la ruta:

- conectividad con Neon;
- disponibilidad y respuesta de APIs externas;
- autenticación y parsing;
- worker/adapter/capability desplegados;
- transformaciones en dry-run;
- invariantes funcionales;
- compatibilidad de versiones;
- estado de circuit breakers y dependencias.

### Disparadores futuros posibles

- antes de un Batch grande;
- después de un deploy relevante;
- tras recuperarse un breaker;
- cuando una ruta crítica lleve tiempo sin trabajo real;
- en una cadencia limitada para rutas especialmente sensibles.

### Guardrails

- preferencia por operaciones read-only;
- dry-run cuando exista transformación;
- datos sintéticos aislados/reversibles si una escritura es imprescindible;
- nunca modificar catálogo canónico sólo para probar;
- frecuencia y coste limitados;
- un canario fallido bloquea o demora trabajo de alto impacto sólo bajo reglas explícitas.

### Relación con decisiones existentes

- PROC-02 valida capacidades/versiones antes de materializar trabajo.
- Sentinel valida además que **la ruta completa funciona realmente**.
- OBS-05 aporta estado vigente.
- OBS-09 permite correlacionar canario, runtime y build.

### Decisión

**APROBADA por el usuario.**

Se incorpora a `docs/ROADMAP_INNOVADOR.md` como **INNO-06 — PikoFilm Sentinel**.

No entra automáticamente en V5, V6 ni V7.

### Visión

> PikoFilm prueba que el camino funciona antes de mandar trabajo real por él.


---

## INNO-OBS-03 — PikoFilm Anomaly Radar

**Estado: RECHAZADA.**

### Idea revisada

Detectar automáticamente desviaciones relevantes respecto al comportamiento normal de cada proceso —duración, volumen, distribución de resultados, errores, warnings, retries o consumo externo— antes de que aparezca un fallo técnico explícito.

### Decisión

**RECHAZADA por el usuario.**

No se añade a `docs/ROADMAP_INNOVADOR.md` y no queda como backlog implícito.


---

## INNO-OBS-04 — PikoFilm Blast Shield

**Estado: RECHAZADA.**

### Idea revisada

Aislar automáticamente sólo el proceso, fuente, adapter, worker, build o scope concreto que demuestra estar fallando, permitiendo que el resto de PikoFilm continúe y evitando cascadas de errores repetidos.

### Decisión

**RECHAZADA por el usuario.**

No se añade a `docs/ROADMAP_INNOVADOR.md` y no queda como backlog implícito.
