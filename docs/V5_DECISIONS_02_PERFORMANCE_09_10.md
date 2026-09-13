# PikoFilm V5 — Decisiones 02: Rendimiento (PERF-09 y PERF-10)

Estado: **COMPLETO — 2/2 decisiones registradas**  
Fecha: **2026-09-13**  
Rama: `audit/v5-02-performance`

Este documento continúa `docs/V5_DECISIONS_02_PERFORMANCE.md` y registra dos decisiones funcionales/performance aprobadas durante la revisión de Series. No implican implementación V5 inmediata.

---

## PERF-09 — Estado de episodios útil: totales globales y desglose por serie

**Decisión:** APROBADA  
**Fecha:** 2026-09-13

### Problema observado

La superficie de Series dispone de estado por episodio, pero hoy no ofrece una lectura operativa sencilla de lo que realmente importa: cuántos episodios faltan en Plex, cuántos son exigibles ya, cuántos están pendientes de disponibilidad en España y cuántos todavía no se han estrenado.

Además, la semántica actual puede clasificar como `missing_actionable` algunos episodios cuya `air_date` está todavía en el futuro si existe evidencia positiva de disponibilidad a nivel de temporada. La fecha de estreno debe tener precedencia para evitar exigir capítulos que todavía no han salido.

### Decisión V5

La página principal de Calidad · Series mostrará **totales agregados** del universo de episodios, pero el análisis detallado se hará **por serie**, evitando una lista global de miles de capítulos.

La lectura funcional mínima será:

- **En Plex**: episodios presentes o cubiertos de forma confirmada.
- **Faltan en Plex**: total de episodios oficiales no presentes, desglosado sin solapamientos en:
  - **Exigibles ahora**: ya estrenados y con evidencia suficiente de disponibilidad en España, pero ausentes en Plex.
  - **Pendientes en España**: ya estrenados, ausentes en Plex y todavía sin evidencia suficiente de disponibilidad en España.
  - **Pendientes de estreno**: `air_date` futura; nunca deben considerarse exigibles antes de esa fecha.

Los totales globales servirán para entender la situación general. Al profundizar, la navegación deberá llevar primero a las **series afectadas**, mostrando por cada serie sus propios contadores; sólo dentro de una serie se mostrará el listado de episodios correspondiente.

### Límites y condiciones

- No mostrar una lista global de miles de episodios como vista principal de trabajo.
- Los cuatro grupos deben ser mutuamente excluyentes y cuadrar con el total oficial considerado.
- `air_date > fecha actual` tendrá precedencia sobre señales territoriales: un episodio futuro no puede ser `missing_actionable`.
- Los episodios sin fecha de estreno suficiente no se declararán exigibles únicamente por inferencia.
- El desglose por serie debe poder filtrarse por cada categoría y ordenar las series por impacto/relevancia operativa.
- Se preservan overrides manuales, cobertura de capítulos dobles y demás reglas canónicas de Series.
- El cálculo debe integrarse en el read model/preparación aprobados en PERF-02 para no volver a agregar decenas de miles de episodios en cada navegación.

### Objetivo

Que el usuario pueda responder de un vistazo a "¿cuántos capítulos me faltan de verdad?" y, al entrar en el detalle, trabajar serie por serie en vez de gestionar una lista masiva de episodios.

---

## PERF-10 — Sincronización Plex rápida y diferencial de episodios, como ampliación de SER-001

**Decisión:** APROBADA  
**Fecha:** 2026-09-13

### Problema observado

`PROC-SER-001` realiza hoy una sincronización rápida global de Plex a nivel de **series**: detecta series nuevas, cambios en el fingerprint de una serie y series desaparecidas. El inventario de **episodios** se incorpora realmente en `PROC-SER-002`, que entra en una serie concreta, recorre temporadas y episodios y refresca también media/archivos físicos.

Eso obliga a depender de una actualización detallada por serie para descubrir capítulos nuevos. En una biblioteca viva es demasiado manual y, si se resolviera recorriendo siempre todos los episodios con el detalle completo, sería innecesariamente caro.

### Decisión V5

Ampliar la sincronización rápida existente de Series para añadir una **fase diferencial de episodios**. Debe ser un añadido a SER-001, no un reemplazo de su funcionalidad actual.

La sincronización rápida conservará íntegramente la detección actual de:

- series nuevas;
- series modificadas;
- series eliminadas o desaparecidas de Plex;
- invalidaciones necesarias por cambios de serie.

Y añadirá detección barata de cambios en el inventario de episodios para identificar:

- episodios nuevos que existen en Plex pero PikoFilm todavía no conoce;
- episodios eliminados de Plex;
- episodios corregidos o modificados en Plex cuando cambien sus datos relevantes;
- series afectadas por cualquiera de esas diferencias.

### Estrategia de rendimiento aprobada

El proceso tendrá dos niveles:

1. **Descubrimiento barato de diferencias**: leer sólo el inventario mínimo necesario para comparar identidad y huella/fecha de cambio de los episodios con lo ya almacenado en PikoFilm. No descargar media técnica completa de todos los capítulos.
2. **Enriquecimiento selectivo**: sólo para episodios nuevos o realmente modificados se obtendrá el detalle físico/media necesario y se ejecutará la reconciliación de las series afectadas.

Cuando sea posible utilizar una señal fiable de cambio a nivel de serie para acotar el trabajo, se usará como primera criba; no obstante, la implementación deberá demostrar que esa señal también cubre altas, bajas y correcciones de episodios antes de depender exclusivamente de ella. Si Plex no ofrece una señal suficientemente fiable, se preferirá un inventario global ligero de episodios antes que cientos de llamadas detalladas por serie.

### Límites y condiciones

- **No se pierde ninguna capacidad actual de SER-001**; la detección de altas, cambios y bajas de series sigue formando parte del proceso.
- No ejecutar SER-002 completo sobre todas las series en cada sincronización rápida.
- No volver a descargar media/archivos físicos de decenas de miles de episodios sin cambios.
- Un episodio ya conocido y sin cambios debe producir coste mínimo y **cero reescritura funcional** siempre que sea posible, alineado con PERF-08.
- Un episodio nuevo debe insertarse y provocar reconciliación sólo de su serie.
- Un episodio eliminado debe quedar inactivo/desaparecido y provocar reconciliación de su serie.
- Una corrección en Plex debe actualizar únicamente el episodio afectado y cualquier dato derivado dependiente.
- Si un episodio nuevo no puede vincularse por las reglas canónicas de temporada/número, se conservará como episodio Plex sin correspondencia para revisión; no se asignará por título/duración ni por heurísticas inseguras.
- El proceso debe ser idempotente: dos sincronizaciones consecutivas sin cambios deben terminar esencialmente en `no_change` y sin trabajo pesado repetido.
- Debe registrar métricas diferenciadas: series nuevas/modificadas/eliminadas, episodios nuevos/modificados/eliminados, episodios sin correspondencia, series reconciliadas y volumen de detalle físico realmente consultado.
- El resultado visible debe expresarse en lenguaje operativo, por ejemplo: `7 capítulos nuevos en 4 series; 1 capítulo corregido; 0 series nuevas`.

### Objetivo

Poder añadir o corregir capítulos en Plex y ejecutar una sola actualización rápida global de Series para que PikoFilm descubra automáticamente **sólo las diferencias**, sin entrar serie por serie y sin convertir la sincronización en un barrido pesado de toda la biblioteca.

---

Con PERF-01…PERF-10 quedan alcanzadas las **10 propuestas mínimas** exigidas para la Fase 2 del Punto 2 — Rendimiento. La siguiente fase del punto es revisar, una por una, un mínimo de cinco innovaciones disruptivas para `ROADMAP_INNOVADOR.md`.
