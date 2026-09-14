# PikoFilm V5 — Innovaciones 02: Rendimiento

Estado: **COMPLETADA**  
Fecha de inicio: **2026-09-14**  
Fecha de cierre: **2026-09-14**  
Rama: `audit/v5-02-performance`

Este documento registra las decisiones de la Fase 3 del Punto 2 — Rendimiento. Se revisan una a una y cada decisión se persiste antes de presentar la siguiente. Sólo las innovaciones aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

Criterio reforzado desde INNO-PERF-03: esta fase exige propuestas verdaderamente rompedoras, capaces de cambiar de forma sustancial la arquitectura o la experiencia de rendimiento de PikoFilm. Mejoras incrementales, patrones técnicos habituales o simples cambios de implementación no alcanzan por sí solos el listón de innovación de esta fase.

---

## INNO-PERF-01 — Snapshots instantáneos para superficies de lectura

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-14

### Idea evaluada

Generar snapshots compactos, inmutables, derivados y versionados para superficies de lectura poco volátiles y muy consultadas como Catálogo, Personas, Sagas y partes de Calidad, publicándolos atómicamente y cacheándolos cerca del frontend.

### Motivo del rechazo

PikoFilm se considera un sistema vivo. Un snapshot publicado con cadencia propia introduce una ventana en la que una alta o modificación recién realizada —por ejemplo añadir una película— podría no aparecer inmediatamente en el frontal.

La alternativa de invalidar o regenerar el snapshot de forma inmediata ante cada mutación reduciría ese desfase, pero añade una capa importante de complejidad de invalidación, publicación y versionado. Para el objetivo actual, esa complejidad no compensa frente a read models incrementales, consultas preparadas y caché con invalidación ligada a cambios reales.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantiene como principio de producto que las mutaciones relevantes deben reflejarse de forma prácticamente inmediata en las superficies de lectura afectadas.
- Las optimizaciones de rendimiento no deben convertir Catálogo, Calidad u otras superficies funcionales en vistas periódicamente congeladas.

---

## INNO-PERF-02 — Modo adaptativo según coste real

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-14

### Idea evaluada

Dotar a las superficies de lectura de un mecanismo adaptativo capaz de modificar automáticamente su estrategia de ejecución según latencia, carga, volumen o coste observado. Entre otras posibilidades, podría reducir cálculos secundarios, aplazar enriquecimientos no esenciales o elegir rutas de lectura más ligeras cuando el sistema estuviese bajo presión.

### Motivo del rechazo

El comportamiento adaptativo añade variabilidad funcional y operativa: una misma pantalla podría resolver peticiones equivalentes de forma distinta según el estado instantáneo del sistema. Esa pérdida de predictibilidad no encaja con el objetivo de que PikoFilm sea comprensible, estable y fácil de diagnosticar.

Las mejoras de rendimiento deben priorizar rutas de lectura deterministas, presupuestos claros, read models bien mantenidos y degradaciones explícitas sólo cuando exista una necesidad funcional real, evitando introducir un gobernador automático que cambie silenciosamente el trabajo realizado por cada request.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Se mantiene como principio que una misma operación debe tener una estrategia de lectura predecible y observable.
- La gestión de carga se resolverá preferentemente mediante arquitectura, colas, read models, límites y capacidad, no mediante cambios silenciosos de comportamiento en el frontal.

---

## INNO-PERF-03 — Actualización instantánea por eventos

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-14

### Idea evaluada

Hacer que cambios relevantes del sistema emitan eventos de dominio para actualizar o invalidar de forma granular los read models, contadores y superficies afectadas, reduciendo polling y refrescos generales.

### Motivo del rechazo

Aunque puede ser una buena decisión de arquitectura en determinados contextos, no constituye una innovación suficientemente rompedora para esta fase. Es un patrón técnico conocido y, en PikoFilm, se percibe principalmente como una mejora de implementación y coordinación entre componentes, no como un salto cualitativo en rendimiento o experiencia.

La ronda de innovación debe reservarse para ideas que cambien de verdad el paradigma de uso o de ejecución del sistema, no para etiquetar como innovación cualquier optimización arquitectónica razonable.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- Los eventos de dominio pueden volver a aparecer en fases de arquitectura, procesos, observabilidad o implementación sin considerarse por ello innovación.
- Las siguientes propuestas de esta ronda deberán superar explícitamente un listón de ruptura mucho mayor.

---

## INNO-PERF-04 — PikoFilm Native / Local-First

**Decisión:** APROBADA  
**Fecha:** 2026-09-14

### Idea aprobada

Transformar PikoFilm, a largo plazo, de una aplicación web ejecutada principalmente en Vercel a una plataforma instalada cuyo motor, almacenamiento de lectura y parte de los procesos se ejecutan directamente en el sistema operativo.

El objetivo no es envolver la web existente en una ventana, sino cambiar el lugar donde vive la ejecución principal de PikoFilm. En escritorio, una aplicación instalada para Windows, macOS y Linux podría mantener una base local sincronizada, índices locales, lógica de lectura y workers propios. La nube conservaría el papel de fuente de verdad central, sincronización, coordinación, respaldo e integraciones que requieran disponibilidad continua.

### Ruptura de paradigma

Modelo actual aproximado:

`Sistema operativo → navegador → Vercel → Neon → Vercel → navegador`

Modelo futuro propuesto:

`Sistema operativo → PikoFilm instalado → motor local + BBDD local`

con sincronización controlada:

`PikoFilm local ↔ capa segura de sincronización cloud ↔ Neon / servicios`

La navegación ordinaria —búsquedas, filtros, ordenaciones, fichas, Personas, Sagas y otras superficies de lectura— podría resolverse localmente sin viajes a Vercel/Neon por cada interacción. Las mutaciones confirmadas en cloud se propagarían como cambios incrementales para que el sistema siguiera siendo vivo y una película recién añadida apareciera inmediatamente tras su confirmación.

### Alcance potencial

- Prioridad inicial en aplicaciones de escritorio instalables para Windows/macOS/Linux.
- Posible extensión posterior a iPhone/iPad/Android, respetando las restricciones de ejecución en segundo plano de cada plataforma.
- Base local sincronizada para lectura rápida y posibilidad de funcionamiento parcial offline.
- Ejecución local de determinadas tareas y workers cuando sea seguro y útil.
- Posible comunicación directa con Plex en la red local, evitando recorridos cloud innecesarios para procesos que puedan resolverse en el dispositivo.
- Vercel dejaría de ser necesariamente el camino normal de ejecución del cliente instalado y podría quedar como web complementaria, API o desaparecer de determinadas rutas futuras.

### Guardrails obligatorios

- Neon o su sucesor cloud continúa siendo la autoridad canónica; la réplica local no se convierte en fuente de verdad global.
- Nunca incrustar credenciales privilegiadas de Neon en el binario distribuido.
- La sincronización debe pasar por una capa segura, autenticada y auditable.
- Diseñar resolución de conflictos, versionado de esquema, recuperación y reconstrucción de la réplica local.
- La transición debe ser progresiva: separar UI, motor funcional y sincronización antes de intentar mover toda la aplicación.
- No asumir que todo proceso debe moverse al cliente; los trabajos 24/7, coordinados o sensibles pueden seguir en infraestructura cloud.

### Valor potencial

El salto cambia la pregunta de rendimiento de «¿cómo hacemos más rápida la consulta Vercel→Neon?» a «¿por qué esta interacción necesita Internet?». El objetivo es una experiencia cercana a una aplicación nativa, con respuestas locales inmediatas y la nube reservada para sincronizar, coordinar y respaldar.

### Horizonte

Innovación de largo plazo. No implica implementación automática en V5/V6/V7. Requiere una futura decisión específica, prototipo de escritorio y evaluación profunda de sincronización, seguridad, portabilidad y coste de migración.

---

## INNO-PERF-05 — PikoFilm Compute Mesh

**Decisión:** RECHAZADA  
**Fecha:** 2026-09-14

### Idea evaluada

Convertir distintos equipos disponibles —PC, NAS, servidores domésticos o nodos cloud— en una malla coordinada de ejecución, repartiendo automáticamente trabajos de PikoFilm entre los nodos según proximidad a Plex, capacidad, disponibilidad o coste.

### Motivo del rechazo

No encaja con la realidad ni con la escala personal del producto. PikoFilm debe funcionar excelentemente con un único ordenador; no debe presuponer que el usuario compre, mantenga o administre infraestructura adicional para una aplicación personal.

Aunque una arquitectura distribuida pueda ser técnicamente interesante, aquí supondría una enorme complejidad de coordinación, seguridad y recuperación para resolver un problema que el producto no tiene. La innovación futura debe reducir dependencia de infraestructura o transformar la experiencia, no crear una pequeña plataforma de computación doméstica como requisito implícito.

### Consecuencia

- No se incorpora a `docs/ROADMAP_INNOVADOR.md`.
- `INNO-PERF-04 — PikoFilm Native / Local-First` debe diseñarse para obtener valor completo en un único ordenador.
- La capacidad cloud podrá seguir existiendo para tareas 24/7 o integraciones, pero no se plantea una malla personal de equipos como dirección de producto.

---

## Cierre de la ronda

Se han revisado individualmente las cinco innovaciones mínimas exigidas para el Punto 2 — Rendimiento.

- `INNO-PERF-01`: RECHAZADA.
- `INNO-PERF-02`: RECHAZADA.
- `INNO-PERF-03`: RECHAZADA.
- `INNO-PERF-04`: APROBADA y registrada en `docs/ROADMAP_INNOVADOR.md` como `INNO-02 — PikoFilm Native / Local-First`.
- `INNO-PERF-05`: RECHAZADA.

Con la auditoría, las diez decisiones V5 y esta ronda de innovación completadas, el Punto 2 — Rendimiento queda formalmente listo para cierre.