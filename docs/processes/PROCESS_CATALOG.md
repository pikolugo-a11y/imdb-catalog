# PikoFilm — Catálogo canónico de procesos

Estado: **anexo canónico vivo de procesos V4**. Complementa `docs/V4_FUNCTIONAL_SPEC.md` y `docs/V4_ARCHITECTURE.md`. El código vivo manda ante discrepancias.

## Regla de arquitectura

Todo proceso funcional debe tener una única operación canónica reutilizable.

```text
individual -> observabilidad -> operación canónica X
Batch -> selección/cola -> child process_run -> operación canónica X
```

Batch puede añadir selección, concurrencia, leases, pausa/reanudación/cancelación, rate limiting y agregación de métricas, pero **no puede mantener una segunda receta funcional**.

Una intención manual individual puede encolarse como Batch durable de una sola entidad cuando el core pueda superar la ventana HTTP; en ese caso la semántica sigue siendo individual desde UX, pero el executor persistente ejecuta el mismo core.

Estados de paridad:

- **EXACTA**: individual y Batch ejecutan el mismo core y la misma semántica funcional;
- **PARCIAL**: mismo core con guards/postprocesado deliberadamente distintos;
- **SIN BATCH**: proceso unitario/global sin Batch común;
- **NO APLICA**: decisión humana que no debe masificarse;
- **MODELO ESPECIAL**: ejecución persistente especializada fuera del Batch Engine común;
- **RETIRADO**: proceso fuera del sistema vivo.

## Inventario maestro

| PROC | Dominio | Función viva | Tipo | Batch | Core / implementación viva | Executor | Paridad / estado |
|---|---|---|---|---|---|---|---|
| PROC-ID-001 | Identidad | Resolver TMDb desde IMDb | individual | sí | `executeId001Canonical` | Vercel / Railway API | EXACTA |
| PROC-ID-002 | Identidad | Corregir identidad | manual | no | `correctIdentityIds` | Vercel | NO APLICA |
| PROC-IV-001 | Validación | Obtener evidencia | individual | sí | `refreshIdentityEvidenceCanonical` | Vercel / Railway API | PARCIAL |
| PROC-IV-002 | Validación | Validar identidad | individual | sí | `validateIdentityCanonical` | Vercel / Railway FAST | PARCIAL |
| PROC-IV-003 | Validación | Corregir IDs e invalidar evidencia | manual | no | `correctIdentityIds` + invalidación | Vercel | NO APLICA |
| PROC-IV-004 | Validación | Decisión manual / reversión | manual | no | `manual-actions.js` + `identity_validation.validation_details` | Vercel | NO APLICA |
| PROC-IV-005 | Validación | Forzar asociación IMDb↔TMDb | manual excepcional | no | `forceIdentityIdsAction` | Vercel | NO APLICA |
| PROC-DATA-001 | Datos | Completar datos estructurales | individual | sí | `executeData001Canonical` | Vercel / Railway API | EXACTA |
| PROC-DATA-002 | Datos | Refrescar ratings | individual | sí | `refreshRatingsCanonical` | Vercel / Railway API | EXACTA funcional |
| PROC-DATA-003 | Datos | Calcular PikoScore 3 | individual | sí | `executeData003Canonical` | Vercel / Railway FAST | EXACTA |
| PROC-DATA-005 | Datos | Aceptar datos incompletos | manual | no | `acceptIncompleteData` | Vercel | NO APLICA |
| PROC-DATA-008 | Datos | Refresh global IMDb dataset | — | — | retirado; DATA-002 es la vía canónica por título | — | RETIRADO |
| PROC-MOV-001 | Películas | Validar archivo físico | individual | sí | `executeMov001Canonical` | Vercel / Railway FAST | EXACTA |
| PROC-MOV-002 | Películas | Aceptar finding como excepción | manual | no | `setMovieQualityFindingAction` | Vercel | NO APLICA |
| PROC-MOV-003 | Películas | Reset tras corrección física | manual | no | `resetTitleForFullReprocessing` | Vercel | NO APLICA |
| PROC-SER-001 | Series | Sync Plex rápido global | global manual durable | sí (1 unidad global) | `syncPlexSeriesFastCore` | Railway Plex; Vercel sólo encola | EXACTA |
| PROC-SER-002 | Series | Detalle Plex de serie | individual durable + batch | sí | `syncPlexSeriesDetailCore` | Railway Plex; Vercel sólo encola | EXACTA |
| PROC-SER-003 | Series | Referencia TMDb | individual | sí | `refreshSeriesUnitaryCanonical` | Vercel / Railway API | PARCIAL controlada |
| PROC-SER-004 | Series | Disponibilidad España | individual | sí | `confirmSeriesEsAvailabilityCanonical` | Vercel / Railway API | PARCIAL controlada |
| PROC-SER-005 | Series | Resolver anomalía de episodio | manual | no | acción observada + override | Vercel | NO APLICA |
| PROC-SER-006 | Series | Retirar override de disponibilidad | manual | no | acción observada + refresh | Vercel | NO APLICA |
| PROC-NOV-001 | Novedades | Discovery IMDb global | global manual | no | GitHub Actions `imdb-discovery.yml` | GitHub Actions | SIN BATCH |
| PROC-NOV-002 | Novedades | Alta manual IMDb | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-003 | Novedades | Reintento candidato manual | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-004 | Novedades | Restaurar exclusión + alta manual | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-005 | Novedades | Excluir candidato | manual | no | `app/novedades/exclude-actions.js` | Vercel | NO APLICA |
| PROC-NOV-006 | Novedades | Retirar origen manual | manual | no | `manual-remove-actions.js` | Vercel | NO APLICA |
| PROC-NOV-007 | Novedades | Admitir candidato al catálogo | manual | no | `catalog-admission-actions.js` | Vercel | NO APLICA |
| PROC-NOV-008 | Novedades/Plex | Sembrar candidatos Plex | global encadenado durable | sí (1 unidad global) | `seedPlexNewsCandidates` | Railway API | EXACTA |
| PROC-NOV-009 | Novedades/Plex | Sync Plex global | global manual durable | sí (1 unidad global) | `syncPlexFast` | Railway Plex; Vercel sólo encola | EXACTA |
| PROC-NOV-010 | Novedades/Plex | Guardar IMDb manual de Plex | manual | no | `plex-identity-actions.js` | Vercel | NO APLICA |
| PROC-NOV-011 | Sagas/Novedades | Enviar miembro de Saga a Novedades | manual | no | `saga-news-actions.js` | Vercel | NO APLICA |
| PROC-NOV-016 | Excluidas | Restaurar exclusión | manual | no | `app/catalogo/excluidas/actions.js` | Vercel | NO APLICA |
| PROC-SAGA-001 | Sagas | Refrescar colección TMDb / refresco global completo | individual + global | sí | `refreshSagaCollectionCanonical` + `lib/saga-batch.js` | Vercel / Railway API | EXACTA por colección |
| PROC-PER-001 | Personas | Refrescar perfil y filmografía | individual | sí | `refreshPersonFilmographyCanonical` | Vercel / Railway API | EXACTA |
| PROC-PQ-001 | PikoQuality | Calcular C6 | global por chunks | frontend batch | `processC6Batch` + `scorePikoQualityC6` | Vercel | MODELO ESPECIAL canónico |
| PROC-PQ-002 | PikoQuality | Captura técnica Plex | global persistente | control especializado | Technical Snapshot worker | Vercel / Railway Technical | MODELO ESPECIAL |
| PROC-HOME-001 | Home | Snapshot histórico diario del Dashboard | global automático pasivo | no | `/api/cron/dashboard-snapshot` → `captureDashboardSnapshot` | Vercel Cron | SIN BATCH |
| PROC-PLAN-001 | Actividad | Cambiar planificación futura | manual | no | `app/actividad/actions.js` → `process_plans` | Vercel | NO APLICA |
| PROC-PLAN-002 | Actividad | Reconciliar, equilibrar y despachar planificación segura | global automático | orquesta Batch existentes | `runActivityPlanner` | Vercel Cron | MODELO ESPECIAL |
| PROC-OPS-001 | Operaciones | Reiniciar título desde Novedades | manual destructivo funcional | no | `resetTitleToNews` | Vercel | NO APLICA |
| PROC-OPS-002 | Operaciones | Resolver o descartar incidencia operativa | manual | no | `resolveIncidentAction` | Vercel | NO APLICA |

`restartMissingLifecycleAction` (`/calidad/sin-estado`) es una reparación administrativa excepcional sin PROC propio: recrea Lifecycle cuando falta. No es una cola de mantenimiento ordinaria ni debe masificarse.

## Qué significa Batch en PikoFilm

Un proceso usa Batch común cuando una operación individual canónica puede repetirse sobre una selección de entidades sin cambiar su semántica. El Batch Engine persiste el padre en `process_runs`, gobierna la ejecución en `batch_run_control`, materializa unidades en `batch_run_items` y crea un child `process_run` por intento.

Pools vigentes: `api`, `fast`, `plex`. Technical Snapshot y PQ-001 mantienen modelos especializados.

`PROC-PLAN-002` puede iniciar únicamente Batch rutinarios declarados seguros en la especificación funcional/arquitectónica. **PROC-NOV-009 y PROC-SER-001 permanecen globales manuales y nunca forman parte del planificador automático.** En ambos casos el Batch es sólo la frontera durable de una única unidad global; no autoriza polling ni ejecución automática. `PROC-NOV-008` sólo nace como continuación durable de un NOV-009 iniciado manualmente.

En `PROC-NOV-009`, la reconstrucción de `plex_catalog_status` resuelve modo normal por IMDb. Para Series/Miniseries `tmdb_only`, TMDb es la coincidencia prioritaria; si el ítem Plex carece de GUID TMDb pero expone un IMDb exacto igual al de la ficha, ese IMDb se admite como fallback de presencia física. Este fallback no cambia `identity_mode`, no convierte IMDb en autoridad canónica y no altera la deduplicación TMDb-only.

## Procesos con Batch común

### ID-001

Individual `/calidad/identidad` -> `obtainIdentityAction` -> `resolveIdentityUnitary` -> `executeId001Canonical`. Batch selecciona `IDENTITY_PENDING`, crea control/items y Railway API llama al mismo core. Fuente TMDb gobernada. **EXACTA**.

### IV-001 / IV-002

Individual y Batch comparten `refreshIdentityEvidenceCanonical` y `validateIdentityCanonical`. El Batch excluye revisión humana y aplica guards más conservadores. **PARCIAL intencionalmente conservadora**.

### DATA-001

Individual `updateDataAction` -> `updateDataQualityTitle` -> `executeData001Canonical(lane='manual')`. Batch -> Railway API -> mismo core con lane Batch. Fuentes gobernadas. **EXACTA**.

### DATA-002

Individual `refreshRatingsAction` -> `refreshRatingsForTitle` -> `refreshRatingsCanonical`; Batch -> mismo core. El wrapper individual puede añadir auditoría auxiliar, no receta distinta. **EXACTA funcional**.

### DATA-003

`/calidad/datos` y Railway FAST ejecutan `executeData003Canonical`. **EXACTA**.

### MOV-001

Individual y Railway FAST usan `executeMov001Canonical`. **EXACTA**.

### NOV-009 / NOV-008

El botón `Actualizar Plex` de Novedades conserva inicio estrictamente manual, pero ya no aloja el barrido dentro de la Server Action:

- Vercel llama a `startPlexGlobalBatch('PROC-NOV-009')`, materializa una única unidad lógica `global` en el pool `plex` y responde tras encolar;
- Railway Plex reclama la unidad, mantiene lease/heartbeat y ejecuta el core canónico `syncPlexFast`; no existe un timeout global de 280 segundos ligado a Vercel;
- los timeouts propios de cada request Plex siguen siendo protecciones del core, no un límite de duración de la operación completa;
- al terminar NOV-009, Railway crea `PROC-NOV-008` como una única unidad global en el pool `api`;
- Railway API ejecuta `seedPlexNewsCandidates`, conservando la responsabilidad/credenciales del plano API y sin exigir un segundo clic;
- `PROC-NOV-008` puede ser automático únicamente como continuación del NOV-009 manual; ni NOV-009 ni su continuación se convierten en un sync Plex programado;
- la UI observa `process_runs`/Batch reales; una operación larga no deja de considerarse activa por superar cinco minutos.

La receta funcional de ambos procesos sigue siendo la misma; cambia el alojamiento para hacer durable la cadena. **EXACTA**.

### SER-001

`PROC-SER-001` conserva una sola receta funcional: `syncPlexSeriesFastCore`.

- El botón manual `Actualizar Plex` en `/calidad/series` ya no ejecuta el barrido dentro del request de Vercel: crea o reutiliza un Batch durable con una única entidad lógica `global` en el pool `plex` y responde tras encolar.
- Railway Plex crea el child `process_run`, renueva lease/heartbeat durante las fases largas y ejecuta directamente el core canónico; el worker no contiene una segunda receta de sincronización.
- El inicio sigue siendo estrictamente manual. Ni `PROC-PLAN-002` ni otro planificador pueden lanzar este barrido global.
- El core sigue leyendo el inventario completo de series y episodios para detectar altas, cambios y bajas. Las páginas ligeras de episodios se leen con concurrencia interna acotada —3 por defecto, configurable entre 1 y 6— sin convertir cada página en un item Batch.
- La protección fail-closed se mantiene: un inventario incompleto no provoca bajas de la biblioteca afectada.
- El detalle físico se solicita sólo para episodios nuevos o modificados; las bajas se limpian por diferencia.
- Tras finalizar el barrido, Railway reconstruye el read model de Series y sólo entonces crea/reutiliza la continuación `PROC-SER-002` para cualquier detalle que siga siendo elegible.

La semántica funcional del sync no cambia; cambia el alojamiento y se reduce el tiempo de lectura Plex. **EXACTA**.

### SER-002

La acción manual y el mantenimiento automático comparten `syncPlexSeriesDetailCore`. **EXACTA**.

La acción manual de `/calidad/series` no ejecuta ya el core pesado dentro del request de Vercel: valida la serie y crea/reutiliza un Batch SER-002 dirigido a ese `ratingKey`. Railway Plex ejecuta la unidad y crea el child `process_run` real. Esto mantiene el control individual bajo demanda sin exponerlo al límite HTTP de Vercel. El selector automático sigue limitado a detalle nunca refrescado o invalidado; el selector explícito manual puede forzar una serie concreta aunque esté fresca. El planner sólo continúa invalidaciones existentes; no inicia un sync Plex global.

### SER-003 / SER-004

Comparten core con Batch. Railway y wrapper individual reconstruyen el read model al terminar. La diferencia es de guard/postprocesado controlado, no de receta. **PARCIAL controlada**.

### SER-005

Es una decisión humana observada y sin Batch. Las decisiones `special` / `not_needed` se persisten en `series_episode_overrides` con la `rating_key` Plex y un fingerprint de evidencia. La **vigencia funcional** se decide por identidad estable: misma serie/posición y misma `rating_key` Plex. El fingerprint sirve para auditoría y para detectar que cambió metadata, pero un cambio de `updatedAt`/fingerprint no puede reabrir por sí solo una decisión manual. Si la identidad Plex cambia, el elemento desaparece o deja de ocupar la misma posición, la decisión sí vuelve a revisión. `reopen` sigue siendo la vía explícita para retirar la decisión.

### SAGA-001

La unidad canónica es **una colección**:

- refresco exacto desde ficha -> `lib/saga-unitary.js` -> `refreshSagaCollectionCanonical(sql,id,{lane:'manual',apiGate:createApiGate(sql)})`;
- refresco global -> `lib/saga-batch.js` selecciona el universo completo de colecciones, crea un Batch en pool `api` y Railway ejecuta `refreshSagaCollectionCanonical` por item;
- cada item tiene child `process_run`, API governance y transacción atómica por colección;
- el Batch global no tiene el antiguo límite funcional de 120 colecciones;
- pausa, reanudación y cancelación usan los controles comunes de Batch;
- `lib/sagas-v2.js::refreshSagas()` queda como camino interno/acotado o de compatibilidad; **no es el entrypoint global de la UI**.

La receta por colección es la misma en individual y Batch. **EXACTA por colección**.

### PER-001

`refreshPersonFilmographyCanonical(sql,id,{trace,apiGate,lane})` es la única receta funcional. Individual crea su run y llama al core; Railway API ejecuta el mismo core dentro del child Batch. **EXACTA**.

## Procesos globales y especializados

### NOV-001

Vercel crea la solicitud observada y despacha `.github/workflows/imdb-discovery.yml`; GitHub Actions ejecuta Discovery con el `run_id` canónico. Es una excepción explícita, manual y no persistente al modelo Railway.

### NOV-009 -> NOV-008

La actualización Plex global sigue comenzando sólo por acción humana. Su ejecución pesada es durable en Railway Plex y, al completarse, crea la continuación durable NOV-008 en Railway API. La cadena es observada/correlacionada y no pertenece a `PROC-PLAN-002`.

### PQ-001

La UI crea un único `process_runs` canónico y procesa chunks con `processC6Batch`. Los chunks actualizan progreso/heartbeat del mismo run. No se fuerza artificialmente al Batch Engine común.

### PQ-002

Vercel solicita/controla captura técnica y Railway Technical mantiene el worker persistente. Pausa/reanudación/cancelación usan su control especializado.

### HOME-001

`/api/cron/dashboard-snapshot` captura agregados históricos del Dashboard/almacenamiento con cron diario. Es una excepción automática pasiva; no concentra mantenimiento funcional. Los endpoints cron canónicos autentican con `CRON_SECRET` de forma fail-closed.

### PLAN-001 / PLAN-002

`process_plans` persiste intención futura, prioridad, excepciones, ventana segura y vínculo a ejecución real. PLAN-001 observa cambios manuales. PLAN-002 corre con el cron de Actividad, reconcilia demanda, estima carga, distribuye trabajo flexible, replanifica retrasos seguros y despacha starters autorizados. Las ejecuciones resultantes conservan su PROC funcional original.

El middleware privado deja pasar explícitamente la ruta cron de PLAN-002 para que alcance su autenticación propia; si no existe una ejecución `succeeded|running` reciente, Actividad no declara el planificador saludable. El mismo ciclo ejecuta la retención terminal segura de 30 días.

### OPS-001 / OPS-002

- `PROC-OPS-001`: reset contextual de un título a Novedades; destructivo a nivel funcional, confirmado y observado.
- `PROC-OPS-002`: resolución/descarte de incidencia operativa; cambia su estado de atención sin borrar el error histórico.

## Decisiones manuales que Batch no debe absorber

ID-002, IV-003/004/005, DATA-005, MOV-002/003, SER-005/006, NOV-002/003/004/005/006/007/010/011/016, PLAN-001 y OPS-001/002 son decisiones/correcciones humanas. No deben recibir Batch automáticamente.

## Modelos de estado y observabilidad

- `process_runs` + `process_run_events` + `process_run_errors`: observabilidad canónica de ejecución e histórico/presente para Actividad/Operaciones.
- `process_plans`: intención funcional futura; no es log.
- `batch_run_control` + `batch_run_items` + `batch_engine_control`: estado operativo del Batch Engine; no sustituyen `process_runs`.
- `batch_api_source_limits` y uso asociado: gobernanza de fuentes; no son estado funcional de dominio.
- `pipeline_runs`: compatibilidad histórica; PQ-001 ya no lo escribe. No eliminar sin consumer sweep.
- `series_quality_runs`: compatibilidad temporal con consumidores vivos. No eliminar sin consumer sweep.
- `piko_quality` y `piko_quality_aggregates`: estado/read model funcional de PikoQuality.
- `person_refresh_state` y `person_filmography`: estado/read model funcional de Personas.

Las lambdas Python históricas de FilmAffinity (`api/fa-search.py`, `api/fa-evidence.py`) están retiradas: dependían de `batch_jobs`, relación V1 eliminada, y el consumer sweep no encontró callers V4. Sus dependencias Python dejaron igualmente de formar parte del runtime Vercel.

## Gobierno de fuentes

TMDb, OMDb y MDBList son fuentes gobernadas. Los procesos canónicos que las consumen deben recibir el gate común y fallar cerrado antes del fetch si falta. Manual y Batch comparten configuración persistida; cada llamada obtiene su permiso real.

## Reglas para una nueva implementación

Antes de añadir o modificar un proceso:

1. definir o identificar PROC;
2. identificar operación canónica;
3. trigger y executor;
4. fuentes y gobernanza;
5. lecturas/escrituras;
6. transición o efecto Lifecycle;
7. observabilidad y resultado funcional;
8. error/retry/idempotencia;
9. si existe Batch, demostrar mismo core;
10. actualizar contratos de CI;
11. actualizar este catálogo y la tríada V4 afectada en el mismo cambio.

La historia de auditorías PRE-V4/P5/P7 permanece en Git. Este documento describe únicamente el sistema vigente.