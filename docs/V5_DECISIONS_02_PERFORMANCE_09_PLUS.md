# PikoFilm V5 — Decisiones 02: Rendimiento (continuación)

Estado: **EN REVISIÓN**  
Fecha: **2026-09-13**  
Rama: `audit/v5-02-performance`

Continuación de `V5_DECISIONS_02_PERFORMANCE.md`. Cada decisión se persiste antes de revisar la siguiente propuesta.

---

## PERF-09 — Filtrado, orden y paginación SQL reales para Sagas

**Decisión:** APROBADA  
**Fecha:** 2026-09-13

### Problema observado

La superficie de Sagas repite el antipatrón de construir un conjunto agregado amplio y realizar después parte del filtrado, cálculo, ordenación o paginación en Node antes de devolver la página visible. Hoy no es un hotspot crítico porque el universo es relativamente pequeño, pero su coste crecería con el conjunto completo de sagas, relaciones y miembros en vez de con el tamaño de página solicitado.

### Decisión V5

Hacer que Sagas filtre, ordene y pagine en PostgreSQL sobre una **proyección preparada para lectura**, de modo que una petición de 50 sagas entregue esas 50 ya seleccionadas y ordenadas sin cargar previamente el universo completo en aplicación.

La proyección podrá preparar las métricas que realmente se utilicen para ranking o filtros —por ejemplo número de miembros, cobertura, agregados de PikoScore, estado editorial u otras señales finalmente justificadas— siempre como datos derivados y reconstruibles.

### Límites y condiciones

- No crear infraestructura específica compleja sólo para Sagas si una proyección PostgreSQL sencilla resuelve el problema.
- El filtrado y orden reales deben reducir trabajo en base de datos antes del `LIMIT`, no limitar únicamente las filas enviadas al navegador.
- Toda métrica persistida será derivada, regenerable y nunca fuente de verdad.
- Mantener semántica funcional y orden determinista.
- Aplicar como regla de diseño V5 que una lista paginada no debe cargar el universo completo para mostrar una página salvo justificación medida y documentada.

### Objetivo

Evitar que Sagas reproduzca a futuro los cuellos de botella ya detectados en Personas y Series y hacer que su coste normal dependa principalmente de la selección/página solicitada, no del universo total.
