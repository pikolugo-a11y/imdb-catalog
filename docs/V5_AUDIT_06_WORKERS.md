# PikoFilm V5 — Auditoría 06: Workers y servicios persistentes

Fecha: 2026-09-19  
Estado: **FASE 1 — AUDITORÍA COMPLETADA**  
Rama: `audit/v5-06-workers`

## 1. Alcance y método

Esta auditoría revisa el sistema REAL de workers y servicios persistentes de PikoFilm, contrastando:

- código vivo en Git;
- Dockerfiles y configuración Railway;
- configuración Vercel;
- estado y métricas reales de Railway;
- estado y estadísticas reales de Neon;
- observabilidad operativa vigente;
- comportamiento de leases, heartbeats, polling, shutdown y recovery;
- despliegues recientes.

No se ha mutado Neon ni se ha desplegado Vercel Production.

Punto de partida: `main` tras el cierre del Punto 5, merge `59daecefaac7a802585f606f76a8b09c27f0886d`.

---

## 2. Resumen ejecutivo

La separación arquitectónica básica sigue siendo correcta:

- Vercel = UI/control plane;
- Neon = datos/estado/coordinación;
- Railway = ejecución persistente;
- GitHub Actions = excepción explícita.

Los cuatro servicios Railway están sanos y desplegados, pero el modelo actual tiene un coste estructural importante: **los workers comunes son consumidores por polling permanente de Neon, incluso cuando no existe trabajo**, y Technical Snapshot continúa haciendo heartbeat/escrituras aun estando funcionalmente `stopped`.

La foto real en el momento de auditoría era:

- 4 servicios Railway desplegados;
- 1 réplica por servicio según la configuración viva;
- 0 Batch activos;
- 0 runs queued/running;
- Batch Engine en `running`;
- Technical Snapshot `armed=true`, `requested_state=stopped`, `actual_state=stopped`;
- Vercel sin errores runtime en 24 h.

El consumo CPU es muy bajo, pero los servicios permanecen vivos y generan tráfico recurrente hacia Neon. Las estadísticas acumuladas de PostgreSQL demuestran millones de accesos sobre tablas de coordinación diminutas.

La auditoría también confirma huecos de liveness/capability: PikoFilm puede saber si Technical está online mediante su heartbeat, pero **no existe un registro durable equivalente para los pools API/FAST/Plex cuando están ociosos**. Un worker que no tiene Batch activo puede estar muerto o sano y la BBDD no lo distingue.

Además, la renovación de lease de los child runs no es completamente responsabilidad del runtime común: `executeClaimedItem()` ofrece `trace.heartbeat()`, pero los cores largos deben invocarlo explícitamente. Plex lo hace en varias rutas, incluido NOV-009, pero el contrato es frágil porque la seguridad del lease depende de cada core.

Finalmente, Railway continúa redeployando los cuatro servicios por commits puramente documentales. El merge documental del Punto 5 volvió a desplegar API, FAST, Plex y Technical. Esto confirma que PROC-10 está aprobado como dirección futura, pero **todavía no está implementado**.

---

## 3. Topología Railway real

Proyecto Railway:

- `PikoFilm Batch`
- entorno: `production`

Servicios vivos:

| Servicio | Runtime funcional | Docker | Réplicas configuradas |
|---|---|---|---:|
| `pikofilm-worker-api-v3` | pool `api` | `Dockerfile.batch-api` | 1 |
| `pikofilm-batch-fast-worker-v1` | pool `fast` | `Dockerfile.batch-fast` | 1 |
| `pikofilm-batch-plex-worker-v2` | pool `plex` | `Dockerfile.batch-plex` | 1 |
| `pikofilm-technical-snapshot-worker-v1` | PikoQuality Technical | `Dockerfile.technical` | 1 |

Todos siguen la rama `main`.

Los cuatro últimos deployments observados corresponden al merge documental del Punto 5:

`59daecefaac7a802585f606f76a8b09c27f0886d`

Por tanto, el sistema vivo confirma que hoy un commit documental puede reiniciar todos los workers.

La configuración Railway observada incluye `checkSuites:false` en los servicios: Railway no espera por sí mismo al check suite del commit antes de iniciar su autodeploy.

---

## 4. Consumo real y utilización

### 4.1 Métricas Railway — últimos 7 días

Promedios observados:

| Servicio | CPU media | Memoria media |
|---|---:|---:|
| Plex | ~0,0037 | ~0,066 GB |
| FAST | ~0,0031 | ~0,045 GB |
| Technical | ~0,0015 | ~0,054 GB |
| API | ~0,0032 | ~0,088 GB |

Los workers no muestran presión de CPU/memoria. El problema no es falta de capacidad sino **infrautilización permanente**.

### 4.2 Trabajo Batch real

Child runs Batch durante las últimas 24 h:

| Pool | Child runs | suma de duración |
|---|---:|---:|
| API | 64 | ~94,2 s |
| FAST | 1 | ~0,2 s |
| Plex | 27 | ~184,5 s |

Últimos 7 días:

| Pool | Child runs | suma de duración |
|---|---:|---:|
| API | 4.775 | ~1.574,6 s |
| FAST | 15 | ~4,2 s |
| Plex | 205 | ~2.442,6 s |

La suma de duraciones no es un porcentaje exacto de ocupación porque puede haber concurrencia, parents y espera externa, pero sí demuestra que los cuatro contenedores pasan la gran mayoría del tiempo sin ejecutar cores funcionales.

---

## 5. Polling permanente de los workers comunes

### 5.1 FAST y Plex

Ambos ejecutan el mismo patrón:

`while (!stopping) -> claimBatchItem() -> sleep(IDLE_MS) -> repetir`

`claimBatchItem()` hace al menos:

1. lectura de `batch_engine_control`;
2. consulta/claim sobre `batch_run_control + batch_run_items`.

Aunque no haya ningún Batch, el loop sigue consultando Neon.

El código limita `BATCH_IDLE_MS` entre 250 y 10.000 ms y usa 1.000 ms como default. En Railway la variable existe, pero el conector no expone su valor por seguridad, por lo que no se afirma aquí la cadencia exacta configurada.

### 5.2 API

El API worker usa `BATCH_POLL_MS`, con default 1.000 ms.

Además mantiene un loop de mantenimiento cada 15 s que ejecuta:

- recuperación ad hoc de mismatch Lifecycle;
- reconciliación de leases;
- `heartbeatPool('api')`.

### 5.3 Evidencia PostgreSQL

El compute Neon lleva activo desde 2026-08-31 19:09 UTC, unas 18,7 jornadas en el momento de la auditoría.

Estadísticas acumuladas:

- `batch_engine_control`: ~3.420.972 index scans para una tabla de **1 fila**;
- `batch_run_control`: ~642.112 seq scans + ~17.565.065 index scans para ~280 filas;
- `batch_run_items`: ~14.196.110 index scans para ~32.610 filas;
- `plex_technical_control`: ~317.320 seq scans + ~317.595 index scans para **1 fila**.

No toda lectura de esas tablas procede exclusivamente de workers, pero el orden de magnitud concuerda con el diseño de polling continuo.

**Conclusión:** el sistema paga coordinación continua incluso cuando no tiene trabajo.

---

## 6. Technical Snapshot: “stopped” no significa worker dormido

Technical Snapshot mantiene un proceso infinito:

`for (;;) -> cycle() -> sleep(idleMs)`

El código fija:

- `TECHNICAL_SNAPSHOT_IDLE_MS` default = 10.000 ms;
- esa variable no figura entre las variables configuradas del servicio, por lo que el default es el valor vigente observable;
- `TECHNICAL_SNAPSHOT_SCAN_MS` sí está configurado y el log de arranque mostró `scanEveryMs=3600000`;
- el log de arranque mostró `batch=100` y `concurrency=64`.

Cuando `requested_state='stopped'`, cada ciclo sigue haciendo:

1. `getTechnicalControl()`;
2. `ensureTechnicalControl()`;
3. lectura de control;
4. `heartbeatTechnicalWorker(... stopped)`;
5. otro `ensureTechnicalControl()`;
6. UPDATE del control;
7. log INFO;
8. sleep.

En la BBDD, `plex_technical_control` acumula ~158.497 updates desde el arranque del compute: aproximadamente una escritura cada 10 segundos.

Los logs vivos confirman repetición de:

`{"control":"stopped","claimed":0,...}`

durante todo el tiempo ocioso.

**Conclusión:** el botón/estado `stopped` detiene captura funcional, pero no detiene el proceso Railway, las consultas, las escrituras ni los logs.

---

## 7. Liveness y readiness

### 7.1 Technical

Technical sí tiene liveness durable:

- `plex_technical_control.worker_id`;
- `heartbeat_at`;
- `actual_state`;
- dashboard considera online si heartbeat <90 s.

Esto permite diferenciar servicio online de proceso funcional detenido.

### 7.2 API / FAST / Plex

No existe una tabla equivalente de worker instances o worker heartbeats.

El único mecanismo común `heartbeatPool(pool)`:

- busca Batch abiertos del pool;
- actualiza `process_runs.last_heartbeat_at` de esos parents.

Si no hay Batch activo, no escribe ningún heartbeat.

La auditoría de esquema encontró tablas Batch/API, pero ninguna `worker_runtime`, `worker_heartbeat` o equivalente.

Por tanto:

> **cuando API/FAST/Plex están ociosos, PikoFilm no puede demostrar desde su estado durable si el worker está sano, caído o ejecutando una versión incompatible.**

Esto es especialmente relevante tras el incidente ya auditado en el Punto 4 donde trabajo SAGA se materializó para un runtime sin adapter.

PROC-02 define ya la dirección funcional de capability preflight, pero el runtime actual todavía no dispone de liveness/capabilities persistentes independientes del trabajo.

---

## 8. Leases y heartbeat de child runs

`batch-worker-runtime.mjs` establece:

- máximo 3 intentos;
- lease configurable, default 120 s;
- reconciliación de leases expiradas;
- `trace.heartbeat()` que extiende:
  - `process_runs.last_heartbeat_at`;
  - `batch_run_items.lease_until`.

Pero **no existe un timer de renovación automático alrededor de cada `executeClaimedItem()`**.

El core funcional es quien debe invocar `trace.heartbeat()` cuando su ejecución puede ser larga.

Evidencia:

- `PROC-NOV-009` implementa explícitamente `withLeaseHeartbeat()` cada 30 s;
- `series-plex-sync.js` llama heartbeat durante paginación, librerías, media y diagnósticos;
- varios cores API/FAST no llaman heartbeat porque normalmente son cortos.

En los últimos 7 días se observaron child runs Plex de:

- NOV-009: ~276 s;
- SER-002: ~131 s;
- SER-001: ~122 s.

Los procesos Plex largos sobreviven porque sus cores renuevan el lease.

### Riesgo arquitectónico

Si un core futuro supera el lease y olvida heartbeat:

1. el item puede ser considerado expirado;
2. reconciliación puede marcar el child fallido/requeue;
3. la ejecución original puede seguir viva;
4. puede producirse un segundo intento del mismo trabajo.

Las protecciones de idempotencia reducen el daño, pero **la seguridad del lease no debería depender de recordar llamadas manuales en cada core**.

---

## 9. Recovery y apagado

FAST y Plex:

- interceptan SIGTERM/SIGINT;
- dejan de reclamar trabajo;
- esperan `Promise.allSettled(active)`.

API:

- marca `stopping=true`;
- sus loops dejan de reclamar/mantener cuando salen.

Esto es una base correcta de graceful shutdown.

Si el proceso muere sin completar, las leases permiten recuperar el trabajo.

Sin embargo, los redeploys frecuentes aumentan innecesariamente la probabilidad de interrumpir trabajo activo y confiar en recovery.

---

## 10. Restart policy

Los ficheros del repo declaran:

- FAST: `ON_FAILURE`, máximo 3 retries;
- Plex: `ON_FAILURE`, máximo 10;
- API: `ON_FAILURE`, máximo 10;
- Technical: `NEVER`.

Technical es el caso especial: un crash fatal de proceso/import/configuración no tiene auto-restart por la política versionada.

El loop captura errores de ciclo y normalmente continúa, pero un fallo fatal antes de entrar en el loop requiere intervención/redeploy.

La disparidad puede ser deliberada, pero hoy no existe un contrato documental único que explique por qué Technical debe ser `NEVER` mientras los demás se recuperan.

---

## 11. Deploys y reinicios innecesarios

Los cuatro servicios Railway se redeployaron por:

- cierre documental del Punto 3;
- cierre documental del Punto 4;
- cierre documental del Punto 5.

El último fue el merge `59daece...`, cuyo contenido funcional de runtime era documentación de roadmap.

Esto confirma:

- no hay watch paths efectivos por runtime;
- no existe todavía el selective deploy aprobado en PROC-10;
- documentación puede provocar rebuild + restart de todos los workers.

Riesgos:

- coste de build/deploy;
- ruido operativo;
- reinicio de procesos sanos;
- posible interrupción de trabajo en vuelo;
- nuevos warnings/logs de startup sin necesidad.

---

## 12. CI vs runtimes reales

GitHub CI usa Node 22.

El step “Validar workers canónicos” hace `node --check` para:

- IMDb discovery;
- API;
- FAST;
- Plex.

No incluye `technical-snapshot-worker.mjs` en ese step.

Docker runtimes:

- FAST: Node 20;
- Technical: Node 20;
- Plex: Node 22;
- API: Node 24.

Por tanto, una validación sintáctica en Node 22 no prueba directamente compatibilidad con todos los runtimes finales.

Además, CI no construye explícitamente los cuatro Dockerfiles Railway antes del merge; Railway realiza sus builds posteriormente.

---

## 13. Ruido de runtime por módulos

Los logs actuales de arranque de Plex, API y Technical muestran warnings de Node:

`[MODULE_TYPELESS_PACKAGE_JSON]`

Railway los clasifica con severidad `error`, aunque el contenedor continúa y el worker arranca.

Esto produce falsos “errores” de infraestructura en cada redeploy y contradice el espíritu de OBS-01/OBS-07.

La causa visible es mezcla de `.js` con sintaxis ESM en un package sin `"type":"module"`, mientras algunos workers usan flags/normalización para ejecutarlos.

No es un fallo funcional actual, pero sí deuda real de runtime.

---

## 14. Versiones e imágenes

Los Dockerfiles no comparten una base única:

- `node:20-slim`;
- `node:20-slim`;
- `node:22-alpine`;
- `node:24-alpine`.

La diversidad puede ser válida si existe una razón, pero hoy no hay un contrato de compatibilidad que justifique qué worker necesita qué versión.

Esto aumenta:

- superficie de diferencias ESM/runtime;
- riesgo de “funciona en CI Node 22 pero no en worker X”;
- coste cognitivo de upgrades.

No se recomienda homogeneizar a ciegas; primero debe comprobarse compatibilidad de Plex/Next/server-only y dependencias.

---

## 15. Estado de Neon y efecto de los workers

Endpoint productivo Neon:

- región: `aws-eu-central-1` (Frankfurt);
- min compute: 0,25 CU;
- max compute: 8 CU;
- `suspend_timeout_seconds=0`;
- estado actual: `active`;
- compute iniciado el 31/08 y aún activo durante la auditoría.

Por tanto Neon **no está configurado para autosuspenderse** en este momento.

Aunque elimináramos todo polling, el compute no dormiría con esta configuración actual.

Esto es importante para no vender una falsa optimización: reducir polling sí baja queries/ruido/carga, pero habilitar autosuspend sería una decisión separada que deberá evaluarse especialmente en el Punto 14 — Coste.

---

## 16. Railway sleep / wake-up

La documentación actual de Railway indica que su modo de app sleeping/serverless requiere ausencia de tráfico saliente; polling/heartbeats mantienen el servicio despierto.

Además, estos workers son consumidores de una cola en PostgreSQL, no servidores HTTP orientados a request.

Por tanto:

- activar “sleep” sin cambiar el modelo actual no solucionaría el problema;
- si se elimina polling sin introducir un mecanismo de wake, el trabajo podría quedarse encolado sin consumidor;
- una estrategia real wake/sleep requiere un contrato explícito productor→wake→drain→idle.

No se propone todavía la implementación; queda como materia de Fase 2.

---

## 17. Frontera Vercel

`vercel.json` mantiene:

- `deploymentEnabled:false`;
- cron `activity-planner` cada hora;
- snapshot dashboard diario.

Vercel no contiene loops persistentes y cumple la frontera arquitectónica.

El último deployment Production observado estaba en commit `620b3be...`, anterior a los cierres documentales P4/P5. Esto no es un fallo: el usuario conserva intencionadamente el deploy de Vercel Production.

Vercel reportó 0 runtime errors en las 24 h auditadas.

---

## 18. Región y red

- Vercel: `fra1`;
- Neon: Frankfurt (`aws-eu-central-1`);
- Railway: Europa West / Amsterdam.

Railway no ofrece una región Frankfurt equivalente en la configuración observada; su región europea disponible es Amsterdam.

Esto implica tráfico Railway↔Neon interregional europeo. No es un problema funcional, pero hace todavía menos atractivo realizar polling de alta frecuencia cuando no existe trabajo.

---

## 19. Estado real al cerrar la auditoría

Neon:

- Batch Engine: `running`;
- Batch activos: 0;
- runs queued/running: 0;
- Technical: `armed=true`, `requested=stopped`, `actual=stopped`;
- heartbeat Technical vigente.

Railway:

- API: deployment SUCCESS;
- FAST: deployment SUCCESS;
- Plex: deployment SUCCESS;
- Technical: deployment SUCCESS.

No se detectó una incidencia productiva activa que obligue a interrumpir la definición de V5.

---

## 20. Hallazgos formales

### WKR-F01 — Arquitectura física sana
La separación Vercel/Neon/Railway sigue siendo válida y no necesita una quinta plataforma para V5.

### WKR-F02 — Cuatro servicios siempre vivos y fuertemente infrautilizados
CPU/memoria son bajas, pero la mayor parte del tiempo los workers no ejecutan trabajo funcional.

### WKR-F03 — Polling continuo de Neon
API/FAST/Plex consultan la cola de forma repetida aunque esté vacía.

### WKR-F04 — Millones de scans sobre tablas de coordinación pequeñas
Las estadísticas PostgreSQL verifican una presión de polling muy superior al volumen real de Batch.

### WKR-F05 — Technical “stopped” sigue activo
El estado detenido sólo bloquea captura; no detiene contenedor, DB heartbeats ni logs.

### WKR-F06 — Technical escribe aproximadamente cada 10 s estando parado
La evidencia de tabla + código + logs converge.

### WKR-F07 — No existe liveness durable ociosa para API/FAST/Plex
Cuando no hay Batch abierto, la BBDD no puede demostrar que esos consumidores están online.

### WKR-F08 — Readiness/capability todavía no es contractual en runtime
PROC-02 está aprobado, pero aún no implementado en el sistema vivo.

### WKR-F09 — Lease heartbeat depende parcialmente de cada core
El runtime ofrece heartbeat, pero no renueva automáticamente el lease durante cualquier ejecución.

### WKR-F10 — Plex protege explícitamente los cores largos
NOV-009 y sincronizaciones de Series sí ejecutan heartbeats durante trabajo prolongado.

### WKR-F11 — Existe riesgo futuro de expiración falsa para un core largo sin heartbeat
No se observó corrupción actual, pero el contrato es frágil.

### WKR-F12 — Graceful shutdown básico existe
Los workers dejan de reclamar al recibir señal y esperan las tareas activas cuando el proceso tiene oportunidad de cerrar.

### WKR-F13 — Technical tiene restart policy distinta
`NEVER` frente a `ON_FAILURE` en los otros workers; falta justificar el contrato.

### WKR-F14 — Redeploy global por cambios ajenos
Commits documentales reinician los cuatro servicios. PROC-10 sigue pendiente de implementación.

### WKR-F15 — Railway no espera check suite
`checkSuites:false` está presente en la configuración viva.

### WKR-F16 — CI no reproduce todos los runtimes Railway
CI usa Node 22; producción mezcla Node 20/22/24 y Technical no entra en el `node --check` explícito.

### WKR-F17 — Warnings ESM aparecen como errores de Railway
No son fallos funcionales pero generan señal técnica falsa en cada startup.

### WKR-F18 — Neon no puede autosuspender en la configuración actual
`suspend_timeout_seconds=0`; cualquier futura estrategia de coste debe reconocer este hecho.

### WKR-F19 — Railway sleep no es plug-and-play para consumidores PostgreSQL
El polling mantendría el servicio despierto; quitar polling sin wake dejaría trabajo huérfano.

### WKR-F20 — No hay necesidad actual de escalar horizontalmente
Una réplica por servicio tiene capacidad de sobra para el uso observado; la prioridad es gobernar mejor idle/wake/readiness, no añadir réplicas.

### WKR-F21 — Capacidades internas son heterogéneas
API=3, FAST=8, Plex=1 y Technical llegó a 64 de concurrencia; deben tratarse como contratos de workload, no como “más es mejor”.

### WKR-F22 — Observabilidad de instancia es incompleta
Los child runs guardan `worker_id`, pero no existe inventario actual de instancias desplegadas/capacidades/versión independiente del trabajo.

### WKR-F23 — El control “pause/stop” no equivale a ahorro infra
Batch Engine parado o Technical detenido siguen dejando los procesos consumidores vivos salvo que exista un mecanismo específico de suspensión del servicio.

### WKR-F24 — El sistema está sano hoy
No hay Batch activos ni runs stale en la foto final, los cuatro deployments Railway están SUCCESS y Vercel no muestra errores en 24 h.

---

## 21. Temas que deben convertirse en propuestas de Fase 2

Sin aprobar todavía ninguna solución, la auditoría deja como áreas obligatorias:

- contrato de worker runtime/liveness/capabilities;
- eliminación o reducción drástica de polling ocioso;
- wake/drain/idle seguro;
- Technical realmente dormible cuando está parado;
- renovación de lease propiedad del runtime;
- política homogénea y justificada de restart/shutdown;
- selective deploy real;
- gate CI por imagen/runtime;
- racionalización de versiones Node/ESM;
- estado operativo de workers visible en Operaciones;
- guardrails de coste que no sacrifiquen recovery;
- diseño compatible con una única réplica y un único ordenador de usuario.

La Fase 2 deberá presentar como mínimo 10 decisiones concretas, una a una.
