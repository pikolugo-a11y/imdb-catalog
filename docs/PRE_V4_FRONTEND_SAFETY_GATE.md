# PikoFilm — Gate obligatorio de seguridad del frontend antes de borrar

> Regla PRE-V4 vinculante. Añadida por decisión explícita del propietario del producto el 2026-09-01.

## Regla principal

**Antes de borrar, retirar, renombrar o sustituir cualquier pieza de código, configuración, ruta, Server Action, API, worker, script o infraestructura, hay que comprobar si existe algún consumidor desde el frontend validado de PikoFilm.**

Si existe un botón, formulario, enlace, menú, acción visible, acción de página, panel, auto-refresh, llamada de cliente, Server Action, endpoint invocado desde UI o cualquier otro flujo iniciado desde el frontal que dependa directa o indirectamente de la pieza candidata:

1. **NO se borra automáticamente.**
2. Se marca como `FRONTEND-CONSUMED`.
3. Se documenta exactamente qué pantalla/control lo utiliza y la cadena de llamada relevante.
4. Se advierte explícitamente al usuario antes del borrado.
5. **La decisión final de conservar, sustituir o retirar corresponde al usuario.**

El hecho de que una implementación parezca legacy, duplicada, antigua o tenga una alternativa más moderna **no es suficiente para borrarla si el frontend probado la consume**.

## Por qué existe este gate

El frontend actual es la superficie que más validación funcional y visual tiene. PRE-V4 debe preservar el comportamiento ya probado y evitar que una limpieza técnica retire accidentalmente una acción que funciona y que forma parte del producto validado.

## Comprobación mínima obligatoria para cada candidato a borrado

La matriz PRE-V4 deberá añadir estos campos antes de autorizar una eliminación:

`Elemento → imports/consumidores → consumidor frontend → pantalla/control → Server Action/API → operación canónica → executor/infraestructura → tests → clasificación → riesgo → decisión del usuario → acción`

El campo **consumidor frontend** sólo puede quedar en uno de estos estados:

- `NO`: búsqueda y trazado realizados sin consumidor frontend encontrado.
- `SÍ`: existe consumidor; requiere decisión explícita del usuario antes de retirar.
- `INDIRECTO`: el frontend llama una capa que termina dependiendo del candidato; requiere la misma decisión explícita.
- `UNKNOWN`: no se ha demostrado aún; **bloquea el borrado**.

## Qué cuenta como consumidor frontend

Como mínimo revisar:

- `app/**/page.*`
- `app/**/layout.*`
- componentes React montados;
- botones y formularios con `action={...}`;
- Server Actions (`'use server'`);
- event handlers/client components;
- enlaces que llegan a rutas operativas;
- fetches desde cliente;
- componentes de Batch/control;
- acciones de Admin/Calidad/Novedades/Plex/Series/Personas/Sagas/PikoQuality;
- auto-refresh/polling iniciado por UI;
- rutas API/cron si una pantalla depende de sus resultados;
- redirects/aliases de rutas utilizados por navegación visible.

## Regla para infraestructura

También se aplica a Railway/GitHub Actions/Neon:

- si un botón del frontend encola trabajo para un pool Railway, ese worker/configuración no se retira sin informar al usuario;
- si una acción visible dispara un workflow de GitHub, no se retira sin informar al usuario;
- si una pantalla depende de una tabla/view/read model Neon, no se elimina ni sustituye sin informar al usuario;
- si una UI muestra un proceso aparentemente legacy, se debe decidir primero si se migra el botón al proceso canónico o si se conserva el backend actual.

## Regla específica para PRE-V4 P2

**Ningún lote P2 pasa de CANDIDATO a APROBADO PARA BORRAR hasta completar este gate frontend para cada elemento.**

Incluso para candidatos de “alta confianza” TEMP/DEAD, la comprobación frontend sigue siendo obligatoria.

## Aplicación a candidatos ya detectados

Los lotes previamente descritos en auditorías como candidatos de alta confianza quedan desde ahora sujetos a esta regla. Su clasificación técnica no equivale a autorización de borrado.

En particular, antes de tocar workers Batch, Lifecycle, Plex, Technical, acciones de Calidad, Sagas, PikoScore, workflows, aliases o configuraciones Railway, se trazará primero su posible camino desde los controles visibles del frontend.

## Trazados confirmados — bloque 1

### FE-001 — Series Batch / SER-002

**Estado frontend:** `SÍ — FRONTEND-CONSUMED`  
**Borrado bloqueado:** sí.

Cadena confirmada:

`/calidad/series` → `SeriesLayout` → `SeriesBatchPanel` → botón **Iniciar Batch** de **SER-002 Refrescar detalle Plex** → `startSer002BatchAction` → `startSeriesBatch('PROC-SER-002')` → `worker_pool='plex'` / executor `railway_batch_plex` → Batch Plex worker.

Implicación: `railway.batch-plex.toml`, `Dockerfile.batch-plex`, `worker/batch-plex-worker.mjs` y el plano de ejecución Plex **no pueden clasificarse como eliminables sólo porque actualmente no exista un servicio Railway Plex visible**. El frontend probado expone este proceso y prepara trabajos para ese pool. Antes de retirar o sustituir cualquier pieza de esta cadena hay que informar al usuario y decidir si se conserva/restaura el worker o se migra el control a otra ejecución equivalente.

**Riesgo adicional:** existe una posible incidencia operacional: el frontal permite encolar SER-002 pero no se ha observado servicio Railway Plex activo. Investigar antes de V4.

### FE-002 — Series Batch / SER-003 y SER-004

**Estado frontend:** `SÍ — FRONTEND-CONSUMED`  
**Borrado bloqueado:** sí.

La misma pantalla `/calidad/series` expone botones para:

- SER-003 **Actualizar referencia TMDb** → pool `api` → `railway_batch_api`.
- SER-004 **Comprobar disponibilidad España** → pool `api` → `railway_batch_api`.

Conclusión: Batch API es consumidor indirecto de controles frontend validados y no puede retirarse sin decisión explícita.

### FE-003 — Datos / DATA-001, DATA-002 y DATA-003

**Estado frontend:** `SÍ — FRONTEND-CONSUMED`  
**Borrado bloqueado:** sí.

El panel visible de Procesos Batch en Calidad/Datos monta los tres procesos. DATA-003 muestra explícitamente **Iniciar Batch**, **Pausar**, **Continuar**, **Cancelar** y **Ver en Centro de Operaciones**, y declara que ejecuta el mismo proceso individual para todos los títulos preparados. DATA-001 y DATA-002 están montados dentro del mismo hub.

Implicación: las capas Batch API/FAST y Batch Engine/control relacionadas con estos botones deben preservarse o migrarse manteniendo comportamiento antes de cualquier retirada.

### FE-004 — Películas / MOV-001

**Estado frontend:** `SÍ — FRONTEND-CONSUMED`  
**Borrado bloqueado:** sí.

El frontal de Calidad/Películas expone el Batch **MOV-001 Validar archivos pendientes**, con controles **Iniciar Batch / Pausar / Continuar / Cancelar / Ver en Centro de Operaciones**. Por tanto el executor/worker que procesa MOV-001 y su Batch Engine/control forman parte de la superficie validada.

Importante: esto **no protege automáticamente** el antiguo script one-shot específico `tt8442644`; ese artefacto se evaluará por separado. La operación MOV-001 canónica sí está protegida.

### FE-005 — PikoQuality Technical Snapshot / PROC-PQ-002

**Estado frontend:** `SÍ — FRONTEND-CONSUMED`  
**Borrado bloqueado:** sí.

Cadena confirmada:

`/calidad/pikoquality` → `TechnicalRunFlow` → botones **Iniciar nueva comprobación/Reanudar**, **Pausar**, **Detener** → Server Actions de `app/calidad/pikoquality/actions.js` → control técnico persistente → executor declarado `railway` → Technical Snapshot Worker.

La propia Server Action documenta que los controles Technical Snapshot están intencionadamente dirigidos desde el frontend. Por ello el servicio Railway Technical, su worker, tablas/control y configuración son parte del producto visible y no se retirarán sin decisión explícita del usuario.

La corrección de la rama de despliegue `feat/pikoquality-technical-snapshot` a `main` debe tratarse como canonización de infraestructura, no como retirada funcional.

### FE-006 — Novedades / Actualizar Plex

**Estado frontend:** `SÍ — FRONTEND-CONSUMED`  
**Borrado bloqueado:** sí para la operación; arquitectura a clasificar.

Cadena confirmada:

`Novedades` → `PlexSyncButtonClient` → botón **Actualizar Plex** → `syncPlexFromNews` → `PROC-NOV-009` sincronización global Plex → `syncPlexFast` → snapshot dashboard → `PROC-NOV-008` siembra de candidatos Plex.

La ejecución actual se declara `executor:'vercel'`, no Batch Plex. Por tanto no debe confundirse este botón con SER-002: son dos caminos Plex distintos y ambos requieren clasificación explícita antes de consolidarlos.

### FE-007 — Batch Engine / Centro de Operaciones

**Estado frontend:** `INDIRECTO — FRONTEND-CONSUMED`  
**Borrado bloqueado:** sí.

Los paneles Batch visibles utilizan `batch-engine` para pausa/reanudación/cancelación y enlazan sus ejecuciones al Centro de Operaciones. Las tablas/capas `batch_run_control`, `batch_run_items` y `batch_engine_control` pertenecen al Batch Engine actual y no deben confundirse con tablas legacy de generaciones anteriores sólo por compartir prefijo `batch_`.

## Regla derivada del bloque 1

A partir de estos trazados, la clasificación de infraestructura debe distinguir como mínimo:

- **Batch Engine actual:** protegido por frontend.
- **Batch API actual:** protegido por frontend.
- **Batch FAST actual:** protegido por frontend.
- **Batch Plex:** protegido por frontend porque SER-002 encola explícitamente a ese pool, aunque falta confirmar/restaurar su servicio vivo.
- **Technical Snapshot:** protegido por frontend.
- **Plex global de Novedades:** protegido por frontend y actualmente ejecutado en Vercel.
- **Lifecycle antiguo:** no queda protegido por asociación nominal; sólo se conservará si aparece un consumidor frontend real o una dependencia necesaria del camino canónico.

---

**Estado:** GATE ACTIVO — primer bloque de trazado frontend completado.  
**Autoridad de decisión ante consumidor frontend:** usuario.  
**Default ante duda:** CONSERVAR / INVESTIGAR, nunca borrar.
