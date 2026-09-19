# PikoFilm V5 — Auditoría 04: Procesos automáticos y Batch

Estado: **FASE 1 COMPLETADA**  
Fecha: **2026-09-19**  
Rama: `audit/v5-04-processes`

## 1. Objetivo y método

Esta auditoría revisa el sistema REAL de procesos automáticos, planificación y Batch de PikoFilm. No toma la documentación como autoridad por sí sola: contrasta código, esquema/estado vivo de Neon, ejecución real, servicios Railway, Vercel, GitHub Actions y documentación vigente.

Ámbitos revisados:

- inventario de procesos y códigos `PROC-*`;
- separación individual / Batch / automático / global;
- Batch Engine común;
- pools `api`, `fast`, `plex`;
- Technical Snapshot especializado;
- planificación `PROC-PLAN-002`;
- colas, claims, leases, concurrencia y heartbeats;
- reintentos y recuperación de trabajos abandonados;
- pausa/cancelación global y por Batch;
- límites y circuit breaker de APIs;
- procesos Plex globales y continuaciones;
- discovery IMDb en GitHub Actions;
- Lifecycle Continuation;
- PikoQuality;
- estado real de `process_runs`, `batch_run_control`, `batch_run_items`, `process_plans`, errores y leases;
- despliegue de workers Railway;
- deriva entre código y documentación.

La auditoría es de lectura. **No se han modificado datos de producción ni ejecutado limpiezas/reparaciones en Neon.**

---

## 2. Resumen ejecutivo

La conclusión principal es positiva: **el núcleo Batch común está estructuralmente sano y el sistema actual no presenta trabajo huérfano o colas atascadas en el momento de la auditoría**.

La arquitectura V4 ya tiene fundamentos sólidos:

- un `process_run` canónico como raíz de observabilidad;
- Batch padre persistente;
- items persistentes;
- leases con expiración;
- heartbeat;
- límite de concurrencia por Batch;
- una sola ejecución Batch activa por proceso;
- retry de excepciones recuperables;
- recuperación de leases vencidos;
- separación de pools;
- gobernanza de APIs externas;
- compatibilidad manual/Batch mediante cores canónicos en los dominios revisados;
- planner con calendario persistido;
- fronteras explícitas para procesos globales Plex manuales.

No obstante, el sistema ha evolucionado rápido y ya muestra **deuda de gobierno y de coordinación**, más que corrupción. Los principales riesgos detectados son:

1. **No existe un registro canónico único de procesos.** Códigos, nombres, executor, pool, automatización y adapters están repartidos entre documentación, display, starters, workers y planner. La documentación maestra ya omite procesos reales.
2. **El planner conserva dos concepciones de cadence.** El código soporta full + dispatch de 5 minutos, pero Vercel ejecuta sólo una vez por hora; un anexo sigue describiendo `*/5`.
3. **La semántica de resultado parcial no está integrada de forma explícita con planificación.** El reconciliador trata un parent `partial` como plan completado. Aún no hay evidencia de un Batch automático partial ligado a plan, pero la lógica permitiría cerrar el plan aun cuando `functional_result='pending'`.
4. **La política de retries es global y rígida**: máximo 3 intentos, retry después de 6 h y luego 24 h para todos los procesos del Batch común.
5. **La capacidad real del worker no se valida antes de materializar un Batch.** Ya ocurrió una ejecución de Sagas con 1.584 items que fallaron por “Adapter API no registrado”.
6. **Existen recuperaciones ad hoc** —por ejemplo una rutina específica para recuperar `PROC-LC-001` cuando faltó el adapter— en vez de un contrato general de capacidades.
7. **Technical Snapshot puede reintentar indefinidamente items envenenados** entre ejecuciones independientes: cuatro rating keys “sin streams” vuelven a fallar y convierten sucesivas ejecuciones `PROC-PQ-002` en `partial`.
8. **Railway redeploya los cuatro servicios ante merges documentales** y no espera el CI post-merge de GitHub; el último merge documental del Punto 3 reinició API, FAST, Plex y Technical.
9. **La observabilidad contiene errores históricos abiertos que ya no representan el estado operativo actual**, por lo que “errores abiertos” no equivale hoy a “procesos actualmente rotos”.
10. **La selección automática de Personas todavía contiene la regla legacy de director** y deberá alinearse al implementar DB-02.

La prioridad de V5 no debe ser sustituir el Batch Engine. Debe ser **convertir una infraestructura que ya funciona en un sistema gobernado, declarativo, predecible y resistente a deriva**.

---

## 3. Topología real de ejecución

### 3.1 Vercel

Vercel actúa principalmente como:

- frontend y Server Actions;
- control plane;
- acciones manuales;
- creación/encolado de runs;
- planner `PROC-PLAN-002`;
- snapshot diario de Dashboard;
- ciertos procesos especiales como `PROC-PQ-001`.

Cron real en `vercel.json`:

- `/api/cron/activity-planner`: `0 * * * *` — **cada hora**;
- `/api/cron/dashboard-snapshot`: `15 2 * * *` — diario.

Logs de runtime de producción confirmaron invocaciones del planner aproximadamente a `HH:00:41`, HTTP 200, una vez por hora.

### 3.2 Railway

Servicios de producción observados:

- Batch API — `0168a4a6-0f57-49b3-8bdc-50922e0ae9dc`;
- Batch FAST — `f39eaa32-ca66-4c22-abc5-2205b8012cac`;
- Batch Plex — `c7cd6b61-fe7d-4b69-ace0-eabbbd85ac59`;
- Technical Snapshot — `08a5f4a7-327f-4510-9beb-6bc70dd44be3`.

Todos están en producción, una réplica por servicio, región AMS.

Responsabilidades:

- **API**: procesos con APIs externas / lógica más lenta;
- **FAST**: CPU/DB sin APIs externas significativas;
- **Plex**: procesos que hablan con Plex;
- **Technical**: controlador especializado de captura técnica/PikoQuality.

### 3.3 GitHub Actions

`PROC-NOV-001` — discovery IMDb global — es una excepción explícita:

- sólo `workflow_dispatch`;
- run canónico creado antes en Neon;
- cooldown semanal;
- no permite solapamiento;
- checkout de `main`;
- timeout 20 min;
- datasets IMDb + Wikidata/TMDb;
- observabilidad final en el mismo `process_run`.

La excepción está acotada y no se comporta como un scheduler paralelo.

### 3.4 Neon

Neon es el estado durable de la orquestación:

- `process_runs`;
- `process_run_events`;
- `process_run_errors`;
- `batch_run_control`;
- `batch_run_items`;
- `batch_engine_control`;
- `batch_api_source_limits`;
- `batch_api_source_usage`;
- `batch_api_source_leases`;
- `process_plans`;
- configuración en `app_settings`.

---

## 4. Batch Engine común

### 4.1 Modelo padre/item

Un Batch común materializa:

1. parent en `process_runs`;
2. control en `batch_run_control`;
3. N items en `batch_run_items`;
4. child `process_run` por intento ejecutado.

Las relaciones están protegidas por FKs y constraints.

### 4.2 Una sola ejecución activa por proceso

Existe un índice único parcial:

`batch_run_control_one_active_process_uidx(process_code) WHERE closed_at IS NULL`.

Además, los starters:

- buscan primero un Batch activo;
- reutilizan el Batch cuando procede;
- capturan el `23505` de carrera;
- vuelven a localizar/reutilizar el Batch ganador.

El diseño es robusto ante doble clics y carreras simultáneas.

### 4.3 Integridad viva

Comprobación de producción durante la auditoría:

- controls sin parent: **0**;
- control abierto con parent ya terminal: **0**;
- control cerrado con parent activo: **0**;
- mismatch entre `process_runs.items_total` e items físicos: **0**;
- parent terminal con items aún activos: **0**;
- child inexistente referenciado por item: **0**;
- item activo sin child: **0**;
- item terminal con child todavía activo: **0**.

Además, en la foto auditada:

- runs `queued/running`: **0**;
- Batch comunes abiertos: **0**;
- items activos: **0**.

No hay evidencia actual de colas abandonadas.

### 4.4 Leases

Los items usan:

- `lease_owner`;
- `lease_until`;
- heartbeat del child;
- reclaim de leases vencidos;
- índices específicos para claim/lease expiry.

El runtime reconcilia leases expirados en bloques limitados antes de reclamar nuevo trabajo.

---

## 5. Concurrencia

La concurrencia se controla en varios niveles:

1. un Batch activo por `process_code`;
2. `requested_concurrency` por Batch;
3. pool de worker;
4. límite/API lease para fuentes gobernadas;
5. circuit breaker externo.

Ejemplos actuales:

- MOV-001: FAST, default 8, máximo técnico 32;
- Series API: normalmente 2;
- People: API 2;
- DATA-002: API 2;
- Plex global/detalle: Plex 1;
- Sagas: API hasta 8, default 3.

No se observó presión actual de API que justifique incrementar límites.

---

## 6. Reintentos

### 6.1 Política del Batch común

`MAX_ATTEMPTS = 3`.

Elegibilidad temporal del siguiente intento:

- intento inicial: inmediato;
- tras primer fallo reintentable: aproximadamente **6 horas**;
- desde el segundo intento: aproximadamente **24 horas**.

Esta política es global para todos los adapters del Batch Engine común.

### 6.2 Estado real

Los retries reales son poco frecuentes. La inmensa mayoría de items exitosos terminó en `attempt_count=1`.

Se observaron, entre otros:

- un item LC-001 exitoso en segundo intento;
- un item PER-001 exitoso en segundo intento;
- algunos fallos que alcanzaron intento 3 en DATA-001, ID-001 o SER-003.

### 6.3 Campo `process_runs.retry_count`

Aunque `process_runs` contiene `retry_count`, **todos los runs observados tienen valor 0**.

La verdad real del retry vive hoy en:

- `batch_run_items.attempt_count`;
- `process_run_errors.retry_attempt`.

Por tanto, `process_runs.retry_count` no es una métrica útil actualmente y puede inducir a una lectura incorrecta.

---

## 7. Recuperación de workers / adapters

### 7.1 Caso real Sagas

Primer Batch completo de `PROC-SAGA-001`:

- 1.584 items;
- los 1.584 terminaron con `last_error = 'Adapter API no registrado'`;
- parent finalmente cancelado.

Tras corregir/desplegar el adapter, un nuevo Batch:

- 1.584 items;
- 1.584 exitosos;
- finalizó en aproximadamente 9 minutos.

El Batch Engine protegió la persistencia, pero **la cola fue materializada aunque el pool desplegado no fuese capaz de ejecutar ese process_code**.

### 7.2 Recuperación especial de LC-001

`worker/batch-api-worker.mjs` contiene una reparación específica que reencola items fallidos de `PROC-LC-001` cuyo error fue exactamente `Adapter API no registrado`.

Esto prueba que la plataforma ha necesitado resolver una deriva worker↔código, pero la recuperación está codificada por proceso y mensaje, no como contrato genérico de capacidades.

---

## 8. Manual / Batch / automático

En los caminos revisados, la arquitectura de paridad es buena:

- DATA-002 manual y Batch llegan a `refreshRatingsCanonical`;
- MOV-001 comparte el core canónico;
- Series Batch llama a los cores canónicos por serie;
- Personas usa `refreshPersonFilmographyCanonical`;
- Sagas usa refresh canónico por colección.

Batch selecciona, encola y gobierna; no debería inventar una segunda receta funcional.

### Deuda cruzada DB-02

La selección actual de `PROC-PER-001` todavía calcula directores como:

`credit_type='crew' AND lower(job)='director'`.

No contempla aún `credit_type='director'`.

Esto no es una nueva decisión funcional del Punto 4: **es la implementación pendiente de DB-02**, y cuando se ejecute deberá modificar de forma coherente selección manual/Batch/automática.

---

## 9. Registro de procesos fragmentado

No existe una única definición ejecutable de “qué es un proceso”.

Información equivalente o complementaria está distribuida entre:

- `docs/processes/PROCESS_CATALOG.md`;
- `lib/process-display.js`;
- CONFIG de los starters Batch;
- mapas de adapters de workers;
- `SAFE_AUTOMATIC_PROCESS_CODES`;
- `POLICIES` del planner;
- `CONFIGURABLE_AUTOMATIONS`;
- casos especiales;
- documentación de arquitectura.

La deriva ya es observable.

### Procesos reales ausentes del catálogo maestro

`docs/processes/PROCESS_CATALOG.md` no contiene:

- **PROC-SER-007** — Batch real de perfil de Series;
- **PROC-LC-001** — Lifecycle Continuation real;
- **PROC-NOV-013** — existe al menos una ejecución histórica y sigue visible en `process-display.js`.

En cambio, `process-display.js` sí conoce esos códigos.

### SER-007 demuestra que no es una omisión menor

Ejecución real:

- parent manual `c6e4dc93-...`;
- 4.534 series;
- 4.533 exitosas;
- 1 fallida;
- duración ~3 h 14 min;
- 4.535 `process_runs` si se cuenta parent + children.

Un proceso capaz de generar miles de runs y consumir miles de llamadas TMDb no debería existir fuera del catálogo operativo canónico.

---

## 10. Planner / Actividad

### 10.1 Procesos automáticos seguros actuales

`SAFE_AUTOMATIC_PROCESS_CODES`:

- PROC-MOV-001;
- PROC-SER-002;
- PROC-SER-003;
- PROC-SER-004;
- PROC-DATA-002;
- PROC-PER-001;
- PROC-PQ-001.

No incluye globales Plex manuales.

### 10.2 Frontera manual preservada

Se conserva el contrato acordado:

- `PROC-NOV-009` — sincronización global Plex desde Novedades — manual;
- `PROC-SER-001` — global rápido de Series — manual;
- `PROC-NOV-008` — continuación durable de NOV-009 manual.

El planner no los inicia automáticamente.

### 10.3 Cadencia real

El endpoint soporta conceptualmente:

- minuto 00: ciclo completo;
- minutos 05..55: dispatch.

Sin embargo `vercel.json` configura sólo:

`0 * * * *`.

Por tanto la producción actual ejecuta **sólo ciclos completos horarios**.

Neon lo confirma:

- 160 runs `mode=full` en la ventana auditada;
- 38 runs `mode=dispatch` concentrados en una etapa histórica previa del 12 de septiembre;
- posteriormente sólo full horario.

`docs/operations/ACTIVITY_AUTOMATION.md` todavía describe `*/5 * * * *`, mientras el RUNBOOK, la UI y la configuración viva hablan de una vez por hora.

Conclusión: no hay fallo visible de salud actual —la UI usa umbrales de ~75 min—, pero sí **código/documentación de una cadencia antigua coexistiendo con la arquitectura actual**.

### 10.4 Planes vivos

Foto actual:

- 305 planes;
- 278 `planned`;
- 27 `completed`;
- 0 pending;
- 0 delayed;
- 0 dispatched;
- 0 expired;
- 0 cancelled.

La mayor parte de la cardinalidad futura la aporta Personas:

- PER-001: 208 planes futuros, volumen 5.095.

Esto no es corrupción. Es consecuencia de bloques pequeños (25) y horizonte largo.

### 10.5 Resultado parcial

`reconcileDispatched()` traduce:

- child parent failed → plan delayed;
- parent cancelled → plan cancelled;
- parent succeeded → plan completed;
- parent **partial → plan completed**.

Los parents Batch partial de la historia actual no están ligados a planes automáticos —la comprobación devuelve 0 casos—, por lo que **no se ha observado una pérdida real causada por esta regla**.

Pero el contrato de datos permite `technical_status='partial'` + `functional_result='pending'`, y el planner actualmente no distingue esa semántica. Es un riesgo de diseño si un Batch automático futuro termina partial.

---

## 11. Runs recientes: separar pasado de presente

No es correcto evaluar la salud actual usando todos los fallos de agosto/septiembre sin contexto.

Desde 2026-09-16:

- SER-003: 155 runs, 155 succeeded;
- LC-001: 108 runs, 108 technical succeeded;
- PLAN-002: 81/81 succeeded;
- NOV-007: 64/64 succeeded;
- SER-002: 34/34 succeeded;
- MOV-001: 10/10 succeeded;
- NOV-008: 4/4 succeeded;
- NOV-009: **4/4 succeeded**;
- SER-005: 4/4 succeeded;
- SER-004: 3/3 succeeded;
- NOV-001: 1 succeeded;
- SER-006: 1 succeeded;
- PQ-002: 1 partial.

Esto confirma que los timeouts históricos de NOV-009 en Vercel no deben tratarse como un defecto vigente después de PR #565.

### NOV-009 actual

Los dos parents Batch Railway observados:

- ambos succeeded;
- duración media ~182 s.

La migración a Railway durable está funcionando.

---

## 12. Semántica de “éxito con errores”

`PROC-LC-001` presenta un caso importante:

Desde el 16 de septiembre:

- 108 runs;
- 108 con estado técnico succeeded;
- suma de `error_count`: 54.

Los errores recientes más frecuentes son recuperables, por ejemplo referencias a una columna antigua `tmdb_rating` durante una ruta secundaria; el Lifecycle puede terminar correctamente o llegar a revisión pese a registrar error.

Esto significa que:

> `technical_status='succeeded'` no implica necesariamente `error_count=0`.

El diseño permite fallback/degradación, lo cual puede ser correcto, pero la semántica necesita estar explícitamente gobernada para que Actividad/Operaciones no interpreten un “succeeded con 54 errores” como algo contradictorio.

Este asunto se profundizará también en el Punto 5 — Observabilidad y errores.

---

## 13. Errores históricos todavía abiertos

En `process_run_errors` se mantienen incidencias abiertas que ya no representan necesariamente un defecto activo.

Ejemplos:

- SAGA-001: 100 errores abiertos, muchos de una arquitectura antigua;
- LC-001: 54 abiertos;
- NOV-009: errores históricos de timeout Vercel todavía presentes;
- OPS-001: errores antiguos de resets ya modificados.

Además SER-005 generó muchos errores por acciones manuales inválidas/repetidas, por ejemplo:

`No existe una decisión de capítulo combinado que deshacer`.

Muchos son validaciones de operación, no fallos técnicos de infraestructura.

Conclusión para este punto: **la automatización funciona mejor de lo que su contador bruto de errores abiertos sugiere**. La clasificación/resolución se tratará con profundidad en Punto 5.

---

## 14. Technical Snapshot — modelo especializado

`PROC-PQ-002` no usa el Batch Engine común.

Tiene:

- `plex_technical_control`;
- worker persistente dedicado;
- scans periódicos;
- cola técnica;
- captura por chunks;
- scoring PikoQuality posterior.

### Estado vivo

En el momento auditado:

- armed: true;
- requested_state: stopped;
- actual_state: stopped;
- heartbeat sigue renovándose.

### Patrón repetitivo de cuatro items

Las últimas ejecuciones partial repiten cuatro fallos del tipo:

- Snapshot técnico 79831 sin streams;
- 127819 sin streams;
- 73805 sin streams;
- 128792 sin streams.

En varias ejecuciones independientes vuelven a intentarse y cada run termina con 4 fallos.

Última ejecución:

- scan_total: 64.538;
- created: 1.040;
- changed: 76;
- capturados OK: 1.116;
- fallidos: 4;
- PikoQuality recalculado: 1.116;
- estado final: partial.

Existe un patrón de **poison item inter-run**: un caso persistente puede repetirse indefinidamente si nunca se clasifica como terminal/no aplicable.

### Polling parado

Aunque requested/actual state sea `stopped`, el worker permanece vivo y actualiza heartbeat, generando logs periódicos. Esto se analizará más a fondo en Punto 6 — Workers persistentes, pero es relevante porque el proceso especializado tiene una semántica de ejecución distinta del Batch común.

---

## 15. Gobernanza de APIs externas

Fuentes gobernadas:

- TMDb;
- OMDb;
- MDBList.

Mecanismos:

- hard caps;
- max concurrency;
- cupo batch/manual;
- lease por fuente;
- circuit breaker;
- blocked_until;
- contadores diarios;
- pausa del Batch ante quota/breaker;
- manejo especial de HTTP 429.

### Uso vivo

Ventana ~30 días:

**TMDb**
- ~13.948 calls Batch;
- ~660 manuales;
- 13 errores;
- **0 rate limits**;
- máximo diario observado ~6.615.

**OMDb**
- 61 Batch;
- 16 manuales;
- 0 rate limits.

**MDBList**
- 144 Batch;
- 50 manuales;
- 0 rate limits.

En la foto actual:

- breakers cerrados;
- sin leases vivos;
- sin evidencia de saturación de cuota.

Conclusión: **la gobernanza está funcionando y actualmente hay margen**, por lo que no existe justificación empírica para aumentar agresivamente concurrencia.

---

## 16. Despliegue Railway y relación con CI

Tras mergear el Punto 3 —un cambio documental— a `main`, los cuatro servicios Railway se redeployaron.

Esto implica:

- cambios de docs reinician workers persistentes;
- no hay watch paths suficientemente restrictivos;
- configuración Railway observada con `checkSuites=false`;
- el despliegue de main puede comenzar sin esperar al CI post-merge.

En este caso el PR ya tenía CI verde, por lo que no hubo incidente. Pero operativamente:

> el contenido del commit y el código del worker no determinan hoy si un servicio necesita realmente redeploy.

Es deuda de CD/Workers y se revisará otra vez en puntos 6 y 12.

---

## 17. Coste operativo de workers

Promedios aproximados de 24 h observados:

- API: CPU ~0,0036; memoria ~0,097 GB;
- FAST: CPU ~0,0029; memoria ~0,041 GB;
- Plex: CPU ~0,0030; memoria ~0,106 GB;
- Technical: CPU ~0,0015; memoria ~0,072 GB.

La huella está muy lejos de indicar saturación.

La cuestión no es capacidad, sino eficiencia de mantener servicios persistentes o redeployarlos sin necesidad. Eso se evaluará con mayor profundidad en Puntos 6 y 14.

---

## 18. Observabilidad y retención de procesos

Volumen aproximado auditado:

- `process_runs`: ~39k filas;
- `process_run_events`: ~166k;
- `batch_run_items`: ~32,6k.

Hay retention helpers para:

- planes terminales;
- observabilidad de procesos;
- protección de runs todavía referenciados por Batch activo.

La política aprobada DB-01 formalizará el límite de histórico de 30 días.

El planner full también ejecuta housekeeping periódico, incluso cuando no existe apenas material que purgar. No es un problema de capacidad observado, pero mezcla planificación y housekeeping en el mismo ciclo.

---

## 19. Hallazgos formales

### PROC-F01 — El catálogo de procesos no es canónico

Se observan varias fuentes de metadata de procesos y ya existe deriva real. SER-007 y LC-001 ejecutan producción pero no están en el catálogo maestro.

**Riesgo:** documentación incompleta, adapters/UX/planner divergentes y nuevas funciones que no actualicen todos los registros paralelos.

### PROC-F02 — Capacidad del worker no validada antes del enqueue

El caso SAGA-001 materializó 1.584 trabajos para un adapter inexistente en el worker desplegado.

**Riesgo:** fallos masivos evitables tras despliegues parciales o drift de imágenes.

### PROC-F03 — Recuperación específica por mensaje de error

Existe una reparación dedicada a `PROC-LC-001` para `Adapter API no registrado`.

**Riesgo:** cada nuevo adapter mismatch puede requerir otra excepción local.

### PROC-F04 — Política de retry única para procesos heterogéneos

6 h / 24 h / máximo 3 intentos para todo el Batch común.

**Riesgo:** una política adecuada para mantenimiento lento puede ser demasiado tardía o demasiado agresiva para otro dominio.

### PROC-F05 — `process_runs.retry_count` no representa retries reales

Todos los runs observados tienen 0 mientras los items sí contienen segundo/tercer intento.

**Riesgo:** métricas y UI futuras pueden interpretar mal el estado.

### PROC-F06 — `partial` se considera `completed` en el planner

No se observó aún un caso automático real afectado, pero el código lo permite.

**Riesgo:** cerrar un bloque de planificación cuyo parent expresa `functional_result='pending'`.

### PROC-F07 — Cadencia 5-min residual frente a planner horario real

Código y un documento describen dispatch intermedio; producción ejecuta sólo hourly full.

**Riesgo:** complejidad muerta/ambigüedad sobre el SLA real de lanzamiento.

### PROC-F08 — Cardinalidad alta de planes futuros

Personas genera 208 filas de plan para 5.095 items con bloques de 25.

**Riesgo:** al crecer automatizaciones, el calendario puede convertirse en miles de microplanes aunque el trabajo agregado sea sencillo.

### PROC-F09 — Technical Snapshot repite poison items entre runs

Cuatro items “sin streams” han reaparecido en varias ejecuciones.

**Riesgo:** run siempre partial, ruido y trabajo repetido sin posibilidad de convergencia.

### PROC-F10 — Error abierto no equivale a proceso roto

La base mantiene errores históricos/casos de validación manual abiertos aunque el proceso actual funcione.

**Riesgo:** decisiones operativas basadas en un indicador engañoso.

### PROC-F11 — Estados succeeded pueden contener errores recuperados

LC-001 demuestra que succeeded + error_count>0 es posible.

**Riesgo:** semántica técnica/funcional no uniforme entre superficies.

### PROC-F12 — Lifecycle de admisión está serializado globalmente

La admisión de Novedades comprueba un Lifecycle activo y bloquea el siguiente título si pertenece a otra entidad.

**Riesgo:** un proceso lento puede limitar altas consecutivas pese a existir capacidad API; puede ser una salvaguarda deliberada y no debe eliminarse sin pruebas de consistencia.

### PROC-F13 — Railway redeploya más de lo necesario

Cambios exclusivamente documentales reiniciaron todos los workers.

**Riesgo:** churn operativo, ventanas de reinicio y coste innecesarios.

### PROC-F14 — Railway no está ligado explícitamente al CI post-merge

`checkSuites=false` en la configuración observada.

**Riesgo:** un main nuevo puede empezar a desplegar antes de terminar la comprobación post-merge, aunque el PR ya hubiese tenido CI verde.

### PROC-F15 — Selección de Personas sigue pendiente de DB-02

El selector automático aún usa sólo `crew + Director`.

**Riesgo:** si V5 implementase sólo el nuevo modelo pero no este selector, manual/Batch/automático volverían a divergir.

### PROC-F16 — Metadata de procesos está duplicada también en UI y automatización

Nombre, trigger, executor, pool, automatizable y descripción no salen de una fuente común.

**Riesgo:** cambios aparentemente menores requieren editar varios archivos y son fáciles de olvidar.

### PROC-F17 — Gobernanza de APIs es sólida

No hubo 429 en la ventana auditada y los límites vivos están muy por debajo de sus hard caps.

**Conclusión:** no hace falta rediseñarla por capacidad; sí preservarla como contrato transversal.

### PROC-F18 — El Batch Engine común está estructuralmente sano

No hay huérfanos ni desalineación padre/items en la foto viva.

**Conclusión:** V5 debe evolucionarlo, no sustituirlo sin una razón fuerte.

### PROC-F19 — Paridad manual/Batch es un punto fuerte

Los dominios revisados comparten cores canónicos.

**Conclusión:** cualquier nueva automatización debe conservar esta regla.

### PROC-F20 — NOV-009 está cerrado como problema de timeout de Vercel

Tras #565, los runs reales recientes en Railway Plex han terminado correctamente.

**Conclusión:** no reabrir la solución salvo nueva evidencia.

### PROC-F21 — NOV-001 es una excepción GitHub Actions bien acotada

Manual, semanal, sin concurrencia y con run canónico.

**Riesgo residual:** ejecuta el `main` vigente en el momento del workflow, que podría no ser exactamente el commit que creó la solicitud si hubiese un merge entre ambos momentos.

### PROC-F22 — El sistema mezcla tres modelos de ejecución Batch

1. Batch Engine común;
2. PikoQuality C6 por chunks desde Vercel;
3. Technical Snapshot con controlador persistente.

**Riesgo:** controles, estados y recovery no son uniformes. No significa que deban unificarse a la fuerza; los modelos especiales necesitan contrato explícito.

### PROC-F23 — Housekeeping forma parte del ciclo full del planner

La planificación horaria ejecuta también retenciones.

**Riesgo:** acoplamiento entre “decidir trabajo” y “limpiar histórico”, aunque el coste actual no es material.

---

## 20. Fortalezas que V5 debe preservar

1. **Core canónico único por función.**
2. **Vercel como control plane y Railway para trabajo durable.**
3. **Neon como estado durable de coordinación.**
4. **Batch persistente y recuperable.**
5. **Una ejecución activa por proceso.**
6. **Leases y recovery de abandonados.**
7. **API gate fail-closed.**
8. **Global Plex manual.**
9. **Proceso individual visible por item.**
10. **Separación de estado técnico y resultado funcional.**
11. **Pausa/cancelación explícita.**
12. **No pérdida de decisiones manuales.**

---

## 21. Riesgos priorizados

### Prioridad alta

- catálogo/contrato de procesos fragmentado;
- falta de preflight/capability contract de workers;
- poison items sin terminalización;
- semántica planner para `partial`;
- deriva de despliegue Railway frente a cambios irrelevantes.

### Prioridad media

- retry global rígido;
- `retry_count` engañoso;
- serialización global de Lifecycle;
- exceso potencial de microplanes futuros;
- errores históricos sin resolución;
- tres modelos de Batch sin contrato transversal explícito.

### Prioridad baja / deuda

- documentación de planner cada 5 minutos;
- warnings Node en Railway;
- housekeeping acoplado al ciclo full;
- discovery GitHub usa `main` móvil.

---

## 22. Conclusión de Fase 1

El sistema de procesos de PikoFilm no necesita una reescritura. El Batch Engine común **funciona, está bien normalizado y actualmente converge sin huérfanos**. La principal oportunidad V5 es pasar de una colección de mecanismos correctos pero distribuidos a un **contrato único y verificable de proceso**.

La Fase 2 deberá centrarse en propuestas concretas para:

- gobierno/registro canónico;
- capacidades de workers;
- retries;
- semántica de estados;
- planner;
- poison items;
- Lifecycle/concurrencia;
- despliegues y coordinación;
- modelos especializados;
- consistencia manual/Batch/automática.

No se implementa ninguna de esas propuestas por el hecho de estar identificadas aquí. Se revisarán una a una con el usuario y cada decisión se persistirá antes de continuar.
