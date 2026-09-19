# PikoFilm V5 — Auditoría 05: Observabilidad y errores

Fecha: 2026-09-19  
Estado: **FASE 1 COMPLETADA — auditoría extremadamente detallada del sistema real**  
Rama: `audit/v5-05-observability`

## 1. Alcance y método

Esta auditoría revisa el Punto 5 — Observabilidad y errores contra el sistema vivo, no sólo contra la documentación.

Se contrastaron:

- contrato funcional/UX/arquitectónico V4;
- `process_runs`, `process_run_events`, `process_run_errors` y `admin_events` en Neon Production;
- runtime canónico `lib/process-runtime.js`;
- consultas de Operaciones `lib/operations-queries.js`;
- Actividad `lib/activity-v4.js`;
- UI de Operaciones y detalle de run;
- resolución manual de incidencias;
- retención de observabilidad;
- salud PikoQuality;
- logs reales de Railway API/FAST/Plex/Technical;
- errores runtime agrupados de Vercel;
- coherencia con las decisiones ya aprobadas del Punto 4.

La revisión fue **sólo lectura** sobre producción. No se modificaron datos de Neon, configuración Railway ni Vercel Production.

---

## 2. Contrato vigente que debe preservarse

La documentación canónica ya define correctamente varias fronteras:

1. `process_runs + process_run_events + process_run_errors` son la observabilidad canónica de ejecución.
2. Actividad explica **qué hizo PikoFilm y qué resultado funcional dejó**.
3. Operaciones explica **cómo se ejecutó técnicamente y qué requiere intervención**.
4. Error histórico no equivale a incidencia activa.
5. Resolver una incidencia no borra el hecho histórico.
6. Calidad no debe convertirse en visor de errores técnicos.
7. Trabajo automático pendiente no equivale a atención humana.
8. El detalle operativo tiene una ventana de 30 días.
9. Los estados técnico y funcional son dimensiones diferentes; PROC-05 ya formalizó que una ejecución terminada no implica necesariamente trabajo funcional terminado.

La auditoría confirma que estas fronteras son correctas, pero la implementación todavía tiene varios puntos donde la señal técnica, la validación funcional y la atención operativa se mezclan.

---

## 3. Foto real del almacenamiento de observabilidad

En Neon Production, en el momento de la auditoría:

| Tabla | Tamaño total aprox. | Filas aprox. |
|---|---:|---:|
| `process_run_events` | 61 MB | 166.432 |
| `process_runs` | 54 MB | 39.435 |
| `admin_events` | 41 MB | 64.637 |
| `process_run_errors` | 496 kB | 432 |

La observabilidad canónica de procesos ocupa por tanto del orden de **115 MB** sin contar `admin_events`; el segundo stream añade otros ~41 MB.

En este momento no existen filas de `process_runs`, eventos o errores con más de 30 días. La purga actual está cumpliendo la ventana temporal observada.

### Integridad estructural

Fortalezas verificadas:

- events y errors tienen FK a `process_runs`;
- las FK eliminan detalle al purgar el run;
- parent run usa FK con `ON DELETE SET NULL`;
- existen índices por run/tiempo, proceso/tiempo, entidad, activos y errores abiertos;
- `error_count` coincide exactamente con las filas reales de `process_run_errors` en todos los runs de 30 días auditados;
- no hay terminales sin `finished_at`;
- no había runs activos stale >15 min en la foto auditada;
- todos los runs tienen executor y trigger.

No hay evidencia de corrupción estructural del modelo canónico.

---

## 4. Calidad de `process_run_errors`

Los **432 errores** de los últimos 30 días están sorprendentemente bien estructurados:

- 0 sin `step`;
- 0 sin `source`;
- 0 sin `error_code` y `error_class` a la vez;
- 0 sin `entity_type`;
- 0 sin `entity_id`;
- 82 marcados retryable;
- 7 con `retry_attempt > 0`.

Esto es una fortaleza importante: V5 no necesita sustituir el modelo de error, sino **dar significado uniforme a qué merece convertirse en error técnico/incidencia**.

---

## 5. Estado técnico y resultado funcional son realmente independientes

Matriz real de los últimos 30 días:

- succeeded + updated: **36.936**;
- succeeded + NULL: **847**;
- succeeded + no_change: **753**;
- succeeded + blocked: **410**;
- succeeded + pending: **87**;
- failed + NULL: **277**;
- partial + no_change: **77**;
- partial + pending: **27**;
- partial + updated: **10**;
- otros terminales: minoritarios.

Esto demuestra que una UI o métrica no puede reducir el sistema a “success/failure”.

Ejemplos funcionalmente distintos:

- `succeeded + blocked`: técnicamente correcto, pero dejó una condición que requiere decisión/atención funcional;
- `succeeded + pending`: la ejecución funcionó pero el trabajo aún no está resuelto;
- `partial + pending`: terminó con trabajo real pendiente;
- `succeeded + updated + error_count>0`: hubo errores intermedios recuperados o degradación, pero el objetivo terminó.

PROC-05 ya aprobó la separación canónica. Punto 5 debe hacer que **logs, errores, incidencias y UX respeten esa misma semántica**.

---

## 6. “Succeeded con errores” es comportamiento actual, no sólo histórico

`PROC-LC-001` lo demuestra de forma contundente.

En 30 días:

- 155 runs;
- 148 succeeded;
- **55 succeeded con error_count > 0**;
- 56 errores registrados dentro de runs succeeded.

En las últimas ~72 h:

- 107 `succeeded + updated`;
- esos runs acumulan **53 errores**;
- existe además 1 `succeeded + pending` con error.

La causa principal reciente es un fallback que registra errores de la ruta TMDb antigua (`column "tmdb_rating" does not exist`) mientras Lifecycle continúa y puede terminar correctamente.

Conclusión:

> `error_count > 0` no significa por sí mismo que la ejecución haya fallado.

Pero también:

> un error recuperado no debe desaparecer semánticamente; debe poder distinguirse de un fallo activo.

---

## 7. Parents failed/partial sin error directo

Existen runs terminales con `error_count=0`:

- SER-003: 18 failed + 5 partial;
- ID-001: 3 failed + 1 partial;
- DATA-001: 3 failed + 1 partial;
- SER-001: 5 partial;
- SER-004: 83 partial;
- SER-007: 1 partial.

Esto no demuestra por sí solo pérdida de observabilidad. En varios casos el parent agrega el resultado de hijos/items y la causa vive en child runs o `batch_run_items`.

El riesgo está en la **presentación**: el detalle de un parent no debe afirmar “sin errores registrados” como sinónimo de “nada falló” cuando el fallo está delegado a hijos.

V5 necesita distinguir:

- error directo del run;
- fallo derivado de child/item;
- incidencia funcional agregada;
- parent parcial por composición.

---

## 8. Ciclo de incidencias: 432 errores, 0 activos según la regla actual

Para los últimos 30 días:

- errores históricos: **432**;
- manualmente resueltos/descartados: **310**;
- no resueltos en la fila pero considerados auto-resueltos por éxito posterior: **122**;
- activos según la regla actual de Operaciones: **0**.

Esto confirma que la portada de Operaciones no está mostrando simplemente “errores abiertos históricos”.

Sin embargo, la cifra 0 requiere contexto.

### Resolución manual no equivale a reparación

Todas las 310 resoluciones manuales usan exactamente:

> `Descartada manualmente desde Operaciones: ya no requiere atención`

No existe una clasificación estructurada que distinga:

- corregido;
- descartado/aceptado;
- falso positivo;
- obsoleto;
- no aplicable;
- absorbido por otro estado funcional.

`resolved_at` expresa hoy principalmente **“deja de pedir atención”**, no necesariamente “la causa técnica fue reparada”.

Esto ya aparece de forma explícita en la microcopy, pero el modelo y las métricas deben respetarlo.

---

## 9. Evidencia viva: PikoQuality puede seguir mal después de “resolver” sus errores

`PROC-PQ-002` tiene 20 errores históricos de los últimos 30 días y los 20 están manualmente descartados.

Sin embargo el estado físico actual de `plex_technical_state` contiene:

- **5** `snapshot_status='error'`;
- **6** elementos pendientes/no ready.

Cuatro errores siguen siendo los poison items repetidos:

- 79831 — sin streams;
- 128792 — sin streams;
- 127819 — sin streams;
- 73805 — sin streams.

Existe además un error histórico de Plex 404 para 154060.

La UI de Operaciones evita ocultar este problema porque `getPikoQualityOperationsHealth()` consulta el **estado actual físico** por separado.

Ésta es una buena separación y debe preservarse:

> histórico de error ≠ estado actual del dominio.

PROC-04 ya decidió la futura terminalización de poison items; Punto 5 no debe duplicar esa decisión, sino definir cómo se representa una incidencia conocida/terminal sin fingir que está reparada.

---

## 10. Auto-resolución actual demasiado amplia

La regla de Operaciones considera auto-resuelto un error si aparece después **cualquier run `technical_status='succeeded'`** del mismo:

- `process_code`;
- `entity_type`;
- `entity_id`.

No exige resultado funcional concluyente ni evidencia de que la causa concreta desapareció.

La auditoría encontró **3 errores de PROC-SER-005** considerados auto-resueltos únicamente porque hubo después un run técnicamente succeeded con `functional_result = NULL`.

Ejemplos reales incluyen fallos del tipo:

- “No existe en Plex S1E2 para usarlo como capítulo doble”;
- “No existe en Plex S1E2213 para usarlo como capítulo doble”.

Conclusión:

> éxito técnico posterior del mismo proceso/entidad es una señal útil, pero no siempre prueba que la incidencia concreta haya quedado resuelta.

La resolución automática necesita un contrato de evidencia más preciso.

---

## 11. Validaciones de usuario tratadas como errores técnicos

El patrón más claro de toda la auditoría:

`PROC-SER-005 / load_override` generó **204 errores** con:

> “No existe una decisión de capítulo combinado que deshacer”.

Estas 204 ocurrencias:

- entraron en `process_run_errors`;
- hicieron fallar el run;
- fueron después descartadas manualmente;
- aparecen también como el mayor cluster de errores runtime de Vercel de los últimos 7 días.

Otros ejemplos:

- “No existe en Plex S1E2 para usarlo como capítulo doble”;
- fuentes Plex inexistentes elegidas para una decisión manual.

En muchos de estos casos no estamos ante:

- caída de Vercel;
- fallo de Neon;
- worker roto;
- timeout de proveedor;
- corrupción del sistema.

Estamos ante una **precondición/validación funcional no satisfecha** durante una acción del usuario.

El runtime canónico captura cualquier excepción, crea `process_run_errors`, marca `failed` y re-lanza. Vercel termina registrándolo además como runtime error.

Consecuencia:

> la misma validación esperable contamina observabilidad canónica y observabilidad de plataforma como si fuera un defecto técnico.

Éste es el mayor origen de ruido observado.

---

## 12. Vercel: plataforma actualmente sana, histórico contaminado por errores de dominio

Errores runtime agrupados en 7 días:

- 204 × “No existe una decisión de capítulo combinado que deshacer”;
- 8 × “No existe en Plex S1E2…”;
- 3 × antiguo error SQL de Actividad;
- 2 × timeouts antiguos;
- 1 × cron rechazado por configuración antigua;
- 1 × fuente triple inválida;
- 1 × fallo transitorio de conexión Neon en Sistema.

En las últimas **24 horas no había errores runtime de Vercel**.

Por tanto:

- no hay evidencia actual de degradación general de Vercel;
- el histórico de errores de plataforma está dominado por excepciones funcionales que no deberían tener el mismo tratamiento que una caída real.

---

## 13. Eventos: cobertura excelente pero semántica “error” no es 1:1

Cobertura de 30 días:

- 39.435 runs;
- 39.435 tienen `run_started`;
- 39.430 tienen `run_finished`;
- sólo 5 runs terminales carecen de `run_finished`.

Distribución relevante:

- `step_completed`: 50.064;
- `run_started`: 39.435;
- `run_finished`: 39.430;
- `step_started`: 34.381;
- `manual_decision`: 898;
- `error`: 652;
- `step_warning`: 104;
- otros eventos de continuación/Batch/control.

Pero:

- hay **652 eventos `event_type='error'`**;
- sólo 432 filas `process_run_errors`;
- 83 runs tienen evento de error pero ninguna fila de error;
- existe un delta positivo de 220 eventos respecto a filas de error en esos runs.

Por tanto, `event_type='error'` no es actualmente una proyección 1:1 de `process_run_errors`.

No es necesariamente incorrecto: puede haber eventos técnicos auxiliares o repetidos. Pero el nombre “error” tiene dos semánticas distintas y debe gobernarse para que métricas/UX no cuenten cosas incompatibles.

---

## 14. Segundo stream vivo: `admin_events`

`admin_events` sigue siendo una tabla activa:

- ~64.637 filas;
- ~41 MB;
- escrituras hasta el mismo día de la auditoría;
- sin `run_id`;
- sin `correlation_key`;
- sin FK a observabilidad canónica.

Ejemplos de volumen:

- PikoScore `calculated_v3`: 20.798;
- movie file validation started: 11.563;
- movie file validation completed: 11.563;
- refreshes de data quality: miles de eventos;
- eventos de identity validation: miles;
- quality unitary/plex detail sigue escribiendo actualmente.

No forma parte del camino de lectura actual auditado de Actividad/Operaciones, que usa `process_runs/events/errors`.

No se concluye que `admin_events` pueda borrarse: puede conservar evidencia/auditoría consumida por otros módulos.

Sí se concluye:

> existe un segundo stream de eventos activo, voluminoso y sin correlación estructural con el modelo declarado canónico.

Debe clasificarse con DB-06: canónico, auditoría de dominio, compatibilidad o legacy/transición. Si conserva utilidad, debe tener owner/retención/correlación definidos. Si sólo duplica observabilidad, debe migrarse de forma controlada, nunca eliminarse por intuición.

---

## 15. Railway: logs estructurados útiles, pero separados de la observabilidad canónica

FAST y Plex emiten logs por item con atributos estructurados como:

- `process_code`;
- `item_id`;
- `entity_id`;
- `ok`;
- `requeued`;
- `child_run_id`.

Esto es útil para diagnóstico del executor, pero duplica parte de la información durable ya presente en Batch + process runs.

La UI de Operaciones no ingiere ni enlaza estos logs directamente. La investigación profunda sigue requiriendo saltar a Railway.

No se propone copiar todos los logs a Neon: eso duplicaría coste y ruido.

La oportunidad es preservar en PikoFilm **las correlaciones mínimas necesarias** para localizar el log externo cuando haga falta.

---

## 16. Technical Snapshot genera ruido extremo incluso detenido

En el worker Technical, con:

- `control='stopped'`;
- `claimed=0`;
- `ok=0`;
- `failed=0`;
- `scored=0`;

se observó un log repetitivo aproximadamente cada **10 segundos**.

En una ventana de ~84 minutos la consulta alcanzó el límite de **501 líneas**, casi todas repitiendo el mismo estado `stopped`. El intervalo medio observado fue ~10,1 s.

Eso no aporta 500 veces más capacidad diagnóstica que un heartbeat menos frecuente o un cambio-de-estado.

La existencia del worker vivo/parado se profundizará en Punto 6, pero desde Observabilidad la conclusión es clara:

> heartbeat y logging no deben ser sinónimos.

Un servicio puede mantener señal de vida sin producir una línea informativa idéntica cada 10 segundos.

---

## 17. Logs por item también necesitan política de volumen

FAST/Plex registran cada `batch_item_done` como info.

En un Batch grande esto puede generar miles de logs aunque el resultado durable ya exista en:

- `batch_run_items`;
- child `process_runs`;
- parent Batch.

La información tiene valor durante diagnóstico, pero debe existir una política explícita:

- qué eventos merecen info;
- qué va a debug;
- qué se samplea;
- qué se agrega por Batch;
- qué se mantiene sólo ante error.

No se observó saturación actual, pero es una fuente de coste/ruido que escala linealmente con items.

---

## 18. Agrupación de incidencias: útil, pero “Descartar grupo” tiene alcance amplio

La agrupación actual usa:

`process_code + step + error_code/error_class/message-prefix + source`.

No incluye entidad.

Ventaja:

- 200 errores equivalentes se presentan como un único problema, que es exactamente lo que pide UX.

Riesgo:

- `Descartar grupo` marca como resueltas **todas** las ocurrencias no auto-resueltas de esa huella dentro de 30 días y en múltiples entidades.

Esto puede ser correcto cuando el usuario decide que el patrón completo ya no requiere atención, pero necesita una semántica explícita:

- “descartar este patrón” no es lo mismo que “reparar todas estas entidades”;
- el alcance debe quedar visible antes de confirmar;
- una recurrencia futura debe poder reabrir atención.

---

## 19. Resolución carece de procedencia estructurada

Hoy `process_run_errors` tiene:

- `resolved_at`;
- `resolution` libre.

No hay campos estructurados para:

- modo: auto / manual / superseded / not_applicable;
- evidencia de resolución;
- run que la resolvió;
- identidad del patrón/grupo;
- razón normalizada;
- quién/qué tomó la decisión.

Parte puede derivarse de eventos `PROC-OPS-002`, pero el contrato no está expresado de forma directa en la fila de error.

Eso complica:

- métricas fiables;
- explicar por qué una incidencia dejó de estar activa;
- diferenciar “reparado” de “descartado”;
- reabrir correctamente por recurrencia.

No implica que hagan falta muchas columnas; sí un contrato canónico de procedencia.

---

## 20. Correlación de runs es muy buena pero no universal

En 30 días:

- executor ausente: 0;
- trigger ausente: 0;
- correlation_key NULL: **219**;
- idempotency_key NULL: **18**.

La cobertura es alta, pero no total.

PROC-01 ya aprobó un registro de procesos canónico; éste es el sitio adecuado para declarar:

- qué procesos requieren correlation;
- qué procesos requieren idempotency;
- qué procesos especiales tienen otra forma equivalente de correlación.

No conviene imponer un valor ficticio sólo para llenar el campo.

---

## 21. Retención: comportamiento actual correcto

`purgeTerminalProcessObservability()`:

- elimina terminales >30 días;
- protege parent activo;
- protege items queued/retry/leased/running;
- protege child activo;
- deja que FK cascade elimine events/errors del run purgado.

En la foto actual no hay material >30 días, por lo que no se observó sobre-retención.

La política DB-01 refuerza el principio:

> la purga de histórico nunca puede borrar el estado vigente.

No se propone ampliar por defecto la retención de detalle; los ~115 MB canónicos + ~41 MB de `admin_events` ya muestran que conservar todo indefinidamente sería caro sin beneficio probado.

---

## 22. Actividad y Operaciones: separación UX buena

### Actividad

Puntos fuertes:

- sólo parents en cronología normal;
- explica resultado en lenguaje funcional;
- raw errors quedan ocultos;
- errores del detalle se traducen a mensaje funcional;
- tiene enlace secundario a Operaciones;
- ruido del planner `no_change` se colapsa.

### Operaciones

Puntos fuertes:

- portada orientada a “¿hay algo que hacer?”;
- no carga un feed histórico infinito por defecto;
- active runs separados de incidencias;
- búsqueda técnica avanzada sólo al abrirla;
- run detail con events/errors/children/items;
- raw JSON queda dentro de detalle técnico;
- Activity ↔ Operations conserva `run_id`.

La arquitectura UX es sólida. V5 debe mejorar **semántica y calidad de señal**, no volver Operaciones un muro de logs.

---

## 23. Estado actual no debe confundirse con historial

En los últimos ~72 h:

- NOV-009: 4/4 succeeded;
- SER-003: 154 succeeded;
- SER-002: 40 succeeded;
- PLAN-002: 72 succeeded;
- no hay evidencia reciente de que antiguos timeouts/SQL errors sigan activos;
- Vercel no registra runtime errors en las últimas 24 h.

Por tanto, una métrica histórica bruta de “errores en 30 días” no representa salud actual.

Esta separación ya está bien planteada por el producto y debe reforzarse con mejores estados de resolución.

---

## 24. Hallazgos formales

### OBS-F01 — El modelo canónico de runs/events/errors es estructuralmente sano

Cobertura, FKs, índices y contadores son coherentes. No necesita sustitución.

### OBS-F02 — La señal “error técnico” mezcla excepciones de dominio/validación

204 rechazos de una operación manual válida como caso de negocio acabaron como process errors y runtime errors de Vercel.

**Riesgo:** ruido que oculta fallos reales y obliga a descartar incidencias manualmente.

### OBS-F03 — `resolved_at` significa hoy “deja de pedir atención”, no necesariamente “reparado”

Los 310 resueltos manualmente usan una única resolución genérica.

**Riesgo:** métricas de “resuelto” ambiguas.

### OBS-F04 — Auto-resolución por cualquier success posterior es demasiado gruesa

Se encontraron 3 SER-005 auto-resueltos sólo por un success posterior con `functional_result=NULL`.

**Riesgo:** cerrar atención sin evidencia funcional concluyente.

### OBS-F05 — Estado técnico, resultado funcional y error_count no pueden colapsarse en una sola salud

Hay succeeded+blocked, succeeded+pending y succeeded con errores recuperados.

**Riesgo:** KPIs engañosos.

### OBS-F06 — Parents pueden fallar/ser partial sin error directo

La evidencia puede vivir en child/items.

**Riesgo:** “sin errores registrados” puede interpretarse incorrectamente.

### OBS-F07 — `event_type='error'` y `process_run_errors` no tienen contrato 1:1

652 error events vs 432 error rows; 83 runs tienen error-event sin error-row.

**Riesgo:** dobles contadores y semánticas incompatibles.

### OBS-F08 — `admin_events` es un segundo stream vivo y voluminoso

~41 MB / 64,6k filas, sin run_id/correlation y con escrituras actuales.

**Riesgo:** doble observabilidad, coste y trazabilidad incompleta si no se clasifica.

### OBS-F09 — Technical Snapshot loguea estado parado aproximadamente cada 10 s

**Riesgo:** ruido y coste de logs sin nueva información.

### OBS-F10 — FAST/Plex loguean cada item terminado aunque ya existe estado durable

**Riesgo:** cardinalidad lineal en Batch grandes.

### OBS-F11 — Logs Railway y observabilidad Neon están correlacionables sólo de forma parcial/manual

Los logs tienen child_run_id en varios workers, pero Operaciones no enlaza con el backend de logs.

**Riesgo:** diagnóstico multi-plataforma fragmentado.

### OBS-F12 — Incidencia histórica y estado vigente son correctamente distintos en PikoQuality

Los errores se pueden descartar mientras el estado físico sigue marcando capture_errors.

**Conclusión:** preservar esta separación y hacerla explícita en lenguaje/estado.

### OBS-F13 — Resolución de grupo opera transversalmente a entidades

Es útil para deduplicación pero debe explicitar que se descarta un patrón, no que se reparan todas las entidades.

### OBS-F14 — Procedencia de resolución insuficientemente estructurada

Sólo `resolved_at + resolution` libre; el resto se infiere.

**Riesgo:** análisis y reapertura frágiles.

### OBS-F15 — Cinco terminales carecen de `run_finished`

Es una anomalía pequeña frente a 39.435 runs, pero indica paths especiales/reconciliaciones que no pasan siempre por el mismo cierre de evento.

### OBS-F16 — `error_count` sí es fiable como contador de filas de error

0 mismatches en la ventana auditada.

**Conclusión:** preservar esta integridad.

### OBS-F17 — Los errores actuales están bien enriquecidos

Step/source/code/entity completos en 432/432.

**Conclusión:** no degradar la calidad de contexto al simplificar observabilidad.

### OBS-F18 — La retención de 30 días está funcionando

No hay filas canónicas >30 días y las dependencias activas están protegidas.

### OBS-F19 — Operaciones es pull-based y evita ruido por diseño

No existe un feed histórico cargado por defecto; el usuario entra en diagnóstico sólo cuando hace falta.

**Conclusión:** preservar UX y mejorar señal, no exponer más volumen.

### OBS-F20 — La salud actual de plataforma es mejor que su histórico bruto

Vercel 24 h sin runtime errors y no había stale runs en Neon en la foto auditada.

**Conclusión:** KPIs deben priorizar estado actual y recurrencia, con histórico aparte.

### OBS-F21 — Correlation/idempotency tienen cobertura alta pero no contractual por proceso

219 runs sin correlation y 18 sin idempotency en 30 días.

**Riesgo:** algunos modelos especiales pueden dificultar causalidad si no se declara qué campo equivalente usan.

### OBS-F22 — El campo `retry_count` sigue sin representar retries Batch

Hallazgo ya gobernado por PROC-03; no requiere una decisión duplicada en Punto 5.

### OBS-F23 — El coste de observabilidad es material dentro de Neon

Runs + events ~115 MB y `admin_events` ~41 MB.

**Conclusión:** V5 debe priorizar señal útil, agregación y retención antes que añadir nuevas tablas/logs.

---

## 25. Fortalezas que V5 debe preservar

1. `process_runs` como identidad estable de ejecución.
2. Events y errors vinculados por FK.
3. `error_count` consistente con las filas reales.
4. Step/source/code/entity estructurados.
5. Separación Actividad / Operaciones.
6. Detalle técnico paginado.
7. Búsqueda por run, proceso, entidad, Batch y error.
8. Historial de error preservado al resolver.
9. Auto-resolución como concepto, aunque deba hacerse más precisa.
10. Estado vigente de PikoQuality separado del historial de error.
11. Retención de 30 días.
12. No duplicar logs Railway completos en Neon.
13. Estado técnico separado del funcional.
14. Evidencia parent/child/item para Batch.
15. UX que no convierte cada error histórico en una alarma actual.

---

## 26. Riesgos priorizados

### Prioridad alta

- errores técnicos mezclados con validaciones funcionales esperables;
- auto-resolución demasiado amplia;
- semántica ambigua de “resuelto” manual;
- `admin_events` activo sin clasificación/correlación con la observabilidad canónica;
- ruido extremo de Technical cuando está stopped.

### Prioridad media

- parents terminales sin error directo interpretables de forma engañosa;
- `event_type='error'` sin contrato respecto a `process_run_errors`;
- resolución grupal que afecta múltiples entidades;
- diagnóstico repartido entre Neon y logs Railway/Vercel;
- logging por item en Batch grandes;
- procedencia de resolución poco estructurada.

### Prioridad baja / deuda

- 5 terminales sin `run_finished`;
- correlation/idempotency no universal;
- coste de búsquedas técnicas con múltiples EXISTS/ILIKE cuando se usan filtros amplios;
- `retry_count` legacy, ya cubierto por PROC-03.

---

## 27. Líneas de propuesta para Fase 2

La Fase 2 debe producir al menos 10 propuestas, revisadas una a una, centradas en:

- taxonomía canónica de señales;
- separar validación funcional de fallo técnico;
- contrato de incidencia activa;
- evidencia de auto-resolución;
- resolución manual estructurada;
- parents/children y causa agregada;
- gobierno de events;
- clasificación/migración de `admin_events`;
- política de logging y sampling;
- correlación con logs externos;
- KPIs de salud actual frente a histórico;
- observabilidad de terminales conocidos de PROC-04;
- retención/coste sin perder trazabilidad.

No se implementa ninguna de estas líneas por estar identificadas aquí. Se revisarán como propuestas concretas y cada decisión se persistirá antes de continuar.

---

## 28. Conclusión de Fase 1

PikoFilm ya tiene una base de observabilidad técnicamente sólida. El principal problema V5 no es “faltan logs”; es lo contrario: **hay que convertir mucho dato correcto en una señal semánticamente más precisa**.

El objetivo debe ser:

> una incidencia activa representa algo que realmente requiere atención ahora; una validación funcional no se disfraza de fallo de plataforma; un error histórico conserva su evidencia sin contaminar la salud actual; y cada resolución explica qué evidencia permitió dejar de pedir atención.

La arquitectura existente permite conseguirlo sin sustituir `process_runs/events/errors` ni crear un sistema paralelo.
