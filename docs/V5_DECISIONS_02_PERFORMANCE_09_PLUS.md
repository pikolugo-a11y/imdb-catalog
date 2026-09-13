# PikoFilm V5 — Decisiones 02: Rendimiento (continuación)

Estado: **PROPUESTAS COMPLETADAS · PENDIENTE INNOVACIÓN**  
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

---

## PERF-10 — Presupuesto estructural de rendimiento por pantalla crítica

**Decisión:** APROBADA  
**Fecha:** 2026-09-13

### Problema observado

Las regresiones de rendimiento detectadas en la auditoría no proceden de un único hotspot, sino de patrones que pueden reaparecer silenciosamente al evolucionar el producto: cargar universos completos antes de paginar, multiplicar operaciones DB por render, refrescar árboles completos para mostrar progreso, volver a introducir consultas caras ya eliminadas o convertir una proyección en una fuente de write amplification.

Medir únicamente milisegundos absolutos en CI sería frágil porque el tiempo de pared depende de máquina, red, caché y estado de la base de datos. Sin contratos estructurales, una pantalla puede volver a degradarse aunque todas las pruebas funcionales sigan pasando.

### Decisión V5

Definir un **presupuesto estructural de rendimiento por superficie crítica**, verificable mediante tests/contratos de regresión en CI. Los límites se centrarán en propiedades estables del diseño, no en umbrales rígidos de tiempo de pared.

Los contratos deberán cubrir, según la superficie:

- paginar y filtrar antes de materializar conjuntos amplios;
- presupuesto razonable de operaciones DB por render;
- prohibición de `router.refresh()` completo a intervalos agresivos para progreso ordinario;
- uso de payloads/lecturas ligeras para estado vivo;
- protección de consultas o patrones caros ya conocidos;
- idempotencia de proyecciones/read models cuando no cambian sus inputs;
- ausencia de reconstrucciones globales innecesarias en caminos interactivos.

Cuando exista un benchmark suficientemente estable, podrá añadirse una comparación contra baseline o una tolerancia relativa. Los milisegundos absolutos no serán el mecanismo principal de bloqueo de CI.

### Límites y condiciones

- Los presupuestos deben ser específicos por superficie y justificarse con evidencia real.
- No convertir los tests de rendimiento en snapshots frágiles de implementación interna sin valor funcional.
- Permitir excepciones sólo con justificación medida y documentada.
- Los contratos deben detectar regresiones antes del merge, no sustituir la observabilidad de producción.
- Mantener separados rendimiento estructural, corrección funcional y disponibilidad externa.
- Revisar los presupuestos cuando cambien de forma material el volumen, la arquitectura o la UX.

### Objetivo

Evitar que PikoFilm vuelva a introducir silenciosamente los mismos cuellos de botella ya detectados y convertir el rendimiento en una propiedad protegida del diseño V5, no en una limpieza puntual posterior.

---

## Cierre de propuestas de Rendimiento

Con PERF-01 a PERF-10 aprobadas queda completado el mínimo de propuestas exigido para la Fase 2 del Punto 2 — Rendimiento. El siguiente paso obligatorio es la fase de **innovación disruptiva**, con un mínimo de cinco propuestas revisadas individualmente antes de cerrar el punto.
