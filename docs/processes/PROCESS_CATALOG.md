# PikoFilm — Catálogo canónico de procesos

Estado: **documentación canónica viva**. Este documento sustituye progresivamente a la issue #273 como fuente de verdad. El código vivo manda cuando exista discrepancia; la discrepancia debe corregirse y documentarse en el mismo bloque.

## Regla de arquitectura

Todo proceso funcional debe tener una única operación canónica reutilizable.

`individual -> observabilidad -> operación canónica X`

`Batch -> selección/cola -> child process_run -> operación canónica X`

Batch puede añadir selección, concurrencia, leases, pausa/reanudación/cancelación, rate limiting y agregación de métricas, pero **no puede mantener una segunda receta funcional**. Una modificación de X debe cambiar automáticamente individual y Batch.

### Estados de paridad
- **EXACTA**: individual y Batch llaman al mismo core canónico.
- **PARCIAL**: comparten core, pero guards/Lifecycle/read-model/observabilidad difieren de forma funcionalmente relevante.
- **DIVERGENTE**: existe lógica funcional duplicada o distinta.
- **SIN BATCH**: proceso unitario/global sin Batch.
- **NO APLICA**: decisión humana o proceso que no debe masificarse.
- **PENDIENTE AUDITORÍA**: inventariado pero falta cerrar contraste de código vivo.

## Inventario maestro auditado

| PROC | Dominio | Función | Individual/global | Batch | Core canónico / implementación | Executor individual | Executor Batch | Paridad |
|---|---|---|---|---|---|---|---|---|
| PROC-ID-001 | Identidad | Resolver TMDb desde IMDb | individual | sí | `executeId001Canonical` | Vercel | Railway API | EXACTA |
| PROC-ID-002 | Identidad | Corregir IDs manualmente | individual manual | no | `correctIdentityIds` | Vercel | — | NO APLICA |
| PROC-IV-001 | Validación | Obtener/actualizar evidencia | individual | sí | `refreshIdentityEvidenceCanonical` | Vercel | Railway API | PARCIAL |
| PROC-IV-002 | Validación | Validar/revalidar identidad | individual | sí | `validateIdentityCanonical` | Vercel | Railway FAST | PARCIAL |
| PROC-IV-003 | Validación | Corregir IDs e invalidar evidencia | individual manual | no | `correctIdentityIds` + invalidación | Vercel | — | NO APLICA |
| PROC-IV-004 | Validación | Decisión manual/reversión | individual manual | no | acción manual sobre `identity_validation` | Vercel | — | NO APLICA |
| PROC-DATA-001 | Datos | Completar datos estructurales ausentes | individual | sí | `executeData001Canonical` | Vercel | Railway API | EXACTA |
| PROC-DATA-002 | Datos | Refrescar ratings | individual | sí | `refreshRatingsCanonical` | Vercel | Railway API | EXACTA funcional / wrapper distinto |
| PROC-DATA-003 | Datos | Calcular PikoScore 3 | individual | sí | **Batch:** `executeData003Canonical`; individual aún usa wrapper `pikoscore-v3.js` | Vercel | Railway FAST | DIVERGENTE |
| PROC-DATA-005 | Datos | Aceptar datos incompletos | individual manual | no | `acceptIncompleteData` | Vercel | — | NO APLICA |
| PROC-DATA-008 | Datos | Refresh global IMDb dataset | global | no vigente | objetivo inventariado; implementación a rehacer | — | — | PENDIENTE AUDITORÍA |
| PROC-MOV-001 | Películas | Validar archivo físico | individual | sí | `executeMov001Canonical` | Vercel | Railway FAST | EXACTA |
| PROC-MOV-002 | Películas | Aceptar finding como excepción | individual manual | no | `setMovieQualityFindingAction` | Vercel | — | NO APLICA |
| PROC-MOV-003 | Películas | Confirmar corrección y reset completo | individual manual | no | `resetTitleForFullReprocessing` | Vercel | — | NO APLICA |
| PROC-SER-001 | Series/Plex | Sincronización rápida global de series Plex | global | no | `syncPlexSeriesFastCore` | Vercel | — | SIN BATCH |
| PROC-SER-002 | Series/Plex | Actualizar detalle Plex de una serie | individual | sí | `syncPlexSeriesDetailCore` | Vercel | Railway Plex | EXACTA |
| PROC-SER-003 | Series | Actualizar referencia TMDb | individual | sí | `refreshSeriesUnitaryCanonical` | Vercel | Railway API | PARCIAL |
| PROC-SER-004 | Series | Comprobar disponibilidad ES | individual | sí | `confirmSeriesEsAvailabilityCanonical` | Vercel | Railway API | PARCIAL |
| PROC-SER-005 | Series | Decisión manual de anomalía/episodio | individual manual | no | acción observada + override | Vercel | — | NO APLICA |
| PROC-SER-006 | Series | Reset manual de disponibilidad | individual manual | no | acción observada + `refreshSeriesUnitaryCore` | Vercel | — | NO APLICA |
| PROC-NOV-001 | Novedades | Discovery IMDb global | global manual | no | `worker:imdb-discovery` | GitHub Actions | — | SIN BATCH |
| PROC-NOV-002 | Novedades | Alta manual IMDb | individual manual | no | `resolveManualNewsCandidate` + persistencia | Vercel | — | NO APLICA |
| PROC-NOV-003 | Novedades | Reintento de alta manual | individual manual | no | mismo resolver de NOV-002 | Vercel | — | NO APLICA |
| PROC-NOV-004 | Novedades | Restaurar exclusión y alta manual | individual manual | no | restauración + resolver NOV | Vercel | — | NO APLICA |
| PROC-NOV-005 | Novedades | Excluir candidato | individual manual | no | pendiente de cerrar entrypoint vivo | Vercel | — | PENDIENTE AUDITORÍA |
| PROC-NOV-006 | Novedades | Retirar origen manual | individual manual | no | `removeManualCandidateAction` | Vercel | — | NO APLICA |
| PROC-NOV-007 | Novedades | Admitir candidato al catálogo | individual manual | no | `admitNewsCandidateAction` | Vercel | — | NO APLICA |
| PROC-NOV-008 | Novedades/Plex | Sembrar candidatos Plex | global encadenado | no | `seedPlexNewsCandidates` | Vercel | — | SIN BATCH |
| PROC-NOV-009 | Novedades/Plex | Sincronización Plex global | global manual | no | `syncPlexFast` | Vercel | — | SIN BATCH |
| PROC-NOV-010 | Novedades/Plex | Guardar IMDb manual para Plex no identificado | manual | no | pendiente de cerrar entrypoint vivo | Vercel | — | PENDIENTE AUDITORÍA |
| PROC-NOV-011 | Sagas/Novedades | Enviar miembro de Saga a Novedades | individual manual | no | `addSagaMemberToNewsAction` | Vercel | — | NO APLICA |
| PROC-NOV-016 | Novedades | Restaurar exclusión | manual | no | pendiente de cerrar entrypoint vivo | Vercel | — | PENDIENTE AUDITORÍA |
| PROC-PER-001 | Personas | Refrescar perfil y filmografía | individual | sí | **individual:** `refreshPersonFilmography`; Batch llama ese wrapper | Vercel | Railway API | DIVERGENTE observabilidad |
| PROC-PQ-001 | PikoQuality | Calcular C6 sobre snapshots listos | global/chunked | batch frontend | `processC6Batch` + `scorePikoQualityC6` | Vercel | Vercel | MODELO ESPECIAL / deuda |
| PROC-PQ-002 | PikoQuality | Captura técnica Plex | global persistente | sí/controlado | Technical Snapshot worker | control Vercel | Railway Technical | MODELO ESPECIAL |

## Fichas auditadas de procesos con Batch

### PROC-ID-001 — Resolver identidad
- Trigger individual: `/calidad/identidad` -> `obtainIdentityAction`.
- Wrapper individual: `resolveIdentityUnitary()`.
- Core: `executeId001Canonical(sql, imdbId, ...)`.
- Fuente: TMDb `/find/{imdb}?external_source=imdb_id` si falta TMDb.
- Persistencia principal: `movies.tmdb_id`, `tmdb_url`, `source_status`; recalcula Lifecycle.
- Observabilidad: `process_runs` + events/errors.
- Batch: `startId001Batch` selecciona `IDENTITY_PENDING`, crea `batch_run_control`/`batch_run_items`; Railway API llama el mismo `executeId001Canonical`.
- Concurrencia Batch: máximo 3; API gate TMDb.
- Paridad: **EXACTA**. Las diferencias son lane/API governance y orquestación.

### PROC-IV-001 — Evidencia de identidad
- Individual: `refreshIdentityEvidenceAction` -> `refreshIdentityEvidence()` -> `refreshIdentityEvidenceCanonical`.
- Batch: selección de evidencia incompleta -> Railway API -> `refreshIdentityEvidenceCanonical`.
- Fuentes actuales del core: evidencia IMDb/TMDb y fallbacks definidos en `identity-validation-canonical.mjs`.
- Paridad: **PARCIAL**: el individual acepta Lifecycle `IDENTITY_VALIDATION` o `IDENTITY_REVIEW_REQUIRED`; el adapter Batch exige únicamente `IDENTITY_VALIDATION`. Esta diferencia debe ser intencional/documentada o converger.

### PROC-IV-002 — Validar identidad
- Individual: `revalidateIdentityAction` -> `validateOne()` -> `validateIdentityCanonical`.
- Batch: Railway FAST -> `validateIdentityCanonical`.
- Persistencia: `identity_validation`; recalcula Lifecycle.
- Paridad: **PARCIAL** por el mismo guard: individual permite REVIEW_REQUIRED; Batch sólo VALIDATION. El core sí es compartido.

### PROC-DATA-001 — Completar datos
- Individual: `updateDataAction` -> `updateDataQualityTitle` -> `executeData001Canonical(lane=manual)`.
- Batch: selector `DATA_INCOMPLETE` -> Railway API -> `executeData001Canonical(lane=batch)`.
- Fuentes: TMDb, OMDb y MDBList según capacidades/faltantes, bajo API gate.
- Regla: sólo completar faltantes; respeta aceptación manual de incompletos.
- Concurrencia Batch: 2.
- Paridad: **EXACTA**.

### PROC-DATA-002 — Ratings
- Individual: `refreshRatingsAction` -> `refreshRatingsForTitle` -> `refreshRatingsCanonical(lane=manual)`.
- Batch: selector de ratings ausentes/caducados -> Railway API -> `refreshRatingsCanonical(lane=batch)`.
- Concurrencia Batch: 2.
- Paridad funcional: **EXACTA**. El wrapper individual añade auditoría `runlog`; Batch expresa métricas mediante process runtime. Debe mantenerse la equivalencia de resultado/Lifecycle.

### PROC-DATA-003 — PikoScore 3
- Individual actual: `calculatePikoScoreV3Action` evalúa con `evaluatePikoScoreV3ForTitle`, persiste con `calculateAndSavePikoScoreV3ForTitle` y recalcula Lifecycle desde la action.
- Batch: Railway FAST llama `executeData003Canonical`, que contiene evaluación, persistencia, `admin_events` y reconciliación Lifecycle propia.
- Ambos usan `computePikoScoreV3`, pero **no comparten la operación completa**.
- Paridad: **DIVERGENTE**. Prioridad alta: el individual debe delegar en `executeData003Canonical` (o ambos en un core superior común). Hasta entonces un cambio de persistencia/Lifecycle puede divergir.

### PROC-MOV-001 — Validación física película
- Individual: `validateMovieFile` -> `executeMov001Canonical`.
- Batch: selector `MOVIE_FILE_PENDING` -> Railway FAST -> mismo `executeMov001Canonical`.
- Paridad: **EXACTA**.

### PROC-SER-002 — Detalle Plex serie
- Individual: `syncPlexSeriesDetail` -> `syncPlexSeriesDetailCore`.
- Batch: Railway Plex -> `syncPlexSeriesDetailCore`.
- Paridad: **EXACTA**. Batch sólo adapta métricas/resultados.

### PROC-SER-003 — Referencia TMDb serie
- Individual: `refreshSeriesUnitary` -> `refreshSeriesUnitaryCore` -> `refreshSeriesUnitaryCanonical`.
- Batch: Railway API -> `refreshSeriesUnitaryCanonical` y después reconstruye read model.
- Paridad: **PARCIAL**: el wrapper individual y el adapter Batch no son idénticos en auditoría/read-model. Hay que verificar que el individual siempre reconstruya el mismo read model y que `apiGate`/lane no alteren semántica.

### PROC-SER-004 — Disponibilidad España
- Individual: `confirmSeriesEsAvailability` -> `confirmSeriesEsAvailabilityCanonical`.
- Batch: Railway API -> mismo core + reconstrucción explícita de read model.
- Paridad: **PARCIAL** por postprocesado/read-model; lógica principal compartida.

### PROC-PER-001 — Personas
- Individual canónico actual: `refreshPersonFilmography()` crea su propio `process_run` individual y ejecuta toda la lógica TMDb/persistencia.
- Batch: Railway API adapter llama **`refreshPersonFilmography()`**, por lo que cada item Batch crea otro proceso observado anidado además del child run creado por `executeClaimedItem`.
- Paridad funcional: reutiliza la misma receta, pero la frontera canónica está mal colocada.
- Estado: **DIVERGENTE en observabilidad/arquitectura**. Debe extraerse un `refreshPersonFilmographyCanonical(sql,id,{trace,lane,apiGate})`; individual y Batch deben envolver ese core, no invocarse wrapper-observado dentro de wrapper-observado.

## Procesos globales/especiales

### PROC-NOV-001
Manual desde Novedades. Vercel crea `process_runs` y hace dispatch de `.github/workflows/imdb-discovery.yml`; GitHub Actions ejecuta `npm run worker:imdb-discovery` con el `run_id` canónico. Excepción explícita a Railway porque es un job global acotado, no un motor continuo.

### PROC-NOV-009 -> PROC-NOV-008
La acción de Novedades ejecuta primero sincronización Plex global (`PROC-NOV-009`) y, si ésta termina, ejecuta la siembra de candidatos (`PROC-NOV-008`) como proceso observado separado y correlacionado. No es Batch de procesos unitarios; es una composición global explícita.

### PROC-PQ-001
El frontend crea un `process_runs` Batch y ejecuta chunks de `processC6Batch`. Ese módulo además crea `pipeline_runs` internos por chunk. Es **compatibilidad temporal** y explica por qué `pipeline_runs` no puede eliminarse aún. La evolución objetivo debe eliminar la doble trazabilidad y definir una operación canónica de evaluación C6 por item o una justificación formal de vectorización.

### PROC-PQ-002
El control se solicita desde Vercel (`process_runs` + estado técnico) y el worker persistente de Railway realiza scan/capture. Es un Batch técnico especializado; pausa/reanudación/cancelación se gobiernan mediante estado solicitado, no por el Batch Engine común.

## Procesos manuales

ID-002, IV-003/004, DATA-005, MOV-002/003 y SER-005/006 son decisiones/correcciones humanas. **No deben recibir Batch automáticamente.** Si en el futuro se propone masificarlos, requiere decisión de producto explícita.

## Hallazgos P5 abiertos

1. **P5-H01 — DATA-003 divergente (alta):** individual y Batch comparten fórmula, pero no la operación canónica completa.
2. **P5-H02 — PER-001 frontera canónica incorrecta (alta):** Batch llama un wrapper que crea otro `process_run`; extraer core puro compartido.
3. **P5-H03 — IV-001/002 guards distintos (media):** individual admite `IDENTITY_REVIEW_REQUIRED`; Batch no. Confirmar intención y codificarla como política o converger.
4. **P5-H04 — SER-003/004 postprocesado distinto (media):** asegurar paridad del read model y observabilidad tras el core.
5. **P5-H05 — PikoQuality doble modelo (alta):** PROC-PQ-001 usa `process_runs` + `pipeline_runs`; consolidar.
6. **P5-H06 — referencia a tabla Batch V1 eliminada (crítica):** `app/calidad/validacion-identidad/actions.js` conserva `clearBatchManualReview()` contra `batch_process_state`, tabla ya retirada. Una decisión manual de validación puede fallar. Debe eliminarse esa dependencia y conservar la decisión únicamente en el modelo canónico `identity_validation.validation_details`.
7. **P5-H07 — código Novedades duplicado/legacy (alta):** `app/novedades/actions.js` conserva vías antiguas de Discovery/alta manual (incluido dispatch a `imdb-manual-candidate.yml` y lógica `pipeline_runs`/override) coexistiendo con los entrypoints nuevos `discovery-actions.js` y `manual-candidate-actions.js`. Confirmar consumidores del page y retirar la vía muerta para evitar dos generaciones funcionales.
8. **P5-H08 — documentación Lifecycle histórica desactualizada:** `docs/LIFECYCLE_CANONICAL_PROCESSES.md` describe FA obligatorio, PikoScore 2 y Batch antiguo; no debe usarse como fuente canónica hasta consolidarlo/retirarlo en P6.
9. **P5-H09 — NOV-005/010/016 y DATA-008:** inventariados pero requieren cierre de auditoría de entrypoints/implementación viva antes de declararlos canónicos.

## Regla de mantenimiento IA

Toda modificación de un PROC debe actualizar esta ficha en el mismo cambio si altera trigger, core, fuentes, persistencia, Lifecycle, observabilidad, executor, Batch, retry, idempotencia o infraestructura. Si se añade un PROC nuevo, se añade aquí antes de considerar terminado el cambio. Si se elimina, se registra la sustitución y se retira cuando no queden consumidores.
