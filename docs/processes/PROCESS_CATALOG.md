# PikoFilm — Catálogo canónico de procesos

Estado: **documentación canónica viva**. El código vivo manda cuando exista discrepancia. Este catálogo describe los entrypoints que realmente consume la UI, los executors y la frontera canónica; los módulos históricos no se consideran vigentes sólo por seguir presentes en el repositorio.

## Regla de arquitectura

Todo proceso funcional debe tener una única operación canónica reutilizable.

`individual -> observabilidad -> operación canónica X`

`Batch -> selección/cola -> child process_run -> operación canónica X`

Batch puede añadir selección, concurrencia, leases, pausa/reanudación/cancelación, rate limiting y agregación de métricas, pero **no puede mantener una segunda receta funcional**.

Estados de paridad: **EXACTA** = mismo core; **PARCIAL** = mismo core con guards/postprocesado distintos; **DIVERGENTE** = frontera funcional u observabilidad duplicada; **SIN BATCH** = proceso unitario/global sin Batch; **NO APLICA** = decisión humana que no debe masificarse; **RETIRADO** = proceso ya eliminado del sistema vivo.

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
| PROC-DATA-003 | Datos | Calcular PikoScore 3 | individual | sí | `executeData003Canonical` | Vercel / Railway FAST | EXACTA en entrypoint vivo |
| PROC-DATA-005 | Datos | Aceptar datos incompletos | manual | no | `acceptIncompleteData` | Vercel | NO APLICA |
| PROC-DATA-008 | Datos | Refresh global IMDb dataset | — | — | retirado; DATA-002 es la vía canónica por título | — | RETIRADO |
| PROC-MOV-001 | Películas | Validar archivo físico | individual | sí | `executeMov001Canonical` | Vercel / Railway FAST | EXACTA |
| PROC-MOV-002 | Películas | Aceptar finding como excepción | manual | no | `setMovieQualityFindingAction` | Vercel | NO APLICA |
| PROC-MOV-003 | Películas | Reset tras corrección física | manual | no | `resetTitleForFullReprocessing` | Vercel | NO APLICA |
| PROC-SER-001 | Series | Sync Plex rápido global | global | no | `syncPlexSeriesFastCore` | Vercel | SIN BATCH |
| PROC-SER-002 | Series | Detalle Plex de serie | individual | sí | `syncPlexSeriesDetailCore` | Vercel / Railway Plex | EXACTA |
| PROC-SER-003 | Series | Referencia TMDb | individual | sí | `refreshSeriesUnitaryCanonical` | Vercel / Railway API | PARCIAL |
| PROC-SER-004 | Series | Disponibilidad España | individual | sí | `confirmSeriesEsAvailabilityCanonical` | Vercel / Railway API | PARCIAL |
| PROC-SER-005 | Series | Resolver anomalía de episodio | manual | no | acción observada + override | Vercel | NO APLICA |
| PROC-SER-006 | Series | Retirar override de disponibilidad | manual | no | acción observada + refresh | Vercel | NO APLICA |
| PROC-NOV-001 | Novedades | Discovery IMDb global | global manual | no | GitHub Actions `imdb-discovery.yml` | GitHub Actions | SIN BATCH |
| PROC-NOV-002 | Novedades | Alta manual IMDb | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-003 | Novedades | Reintento candidato manual | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-004 | Novedades | Restaurar exclusión + alta manual | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-005 | Novedades | Excluir candidato | manual | no | entrypoint vivo en `app/novedades/actions.js` sin `process_runs` | Vercel | DEUDA OBSERVABILIDAD |
| PROC-NOV-006 | Novedades | Retirar origen manual | manual | no | `manual-remove-actions.js` | Vercel | NO APLICA |
| PROC-NOV-007 | Novedades | Admitir candidato al catálogo | manual | no | `catalog-admission-actions.js` | Vercel | NO APLICA |
| PROC-NOV-008 | Novedades/Plex | Sembrar candidatos Plex | global encadenado | no | `seedPlexNewsCandidates` | Vercel | SIN BATCH |
| PROC-NOV-009 | Novedades/Plex | Sync Plex global | global manual | no | `syncPlexFast` | Vercel | SIN BATCH |
| PROC-NOV-010 | Novedades/Plex | Guardar IMDb manual de Plex | manual | no | `plex-identity-actions.js` | Vercel | NO APLICA |
| PROC-NOV-011 | Sagas/Novedades | Enviar miembro de Saga a Novedades | manual | no | `saga-news-actions.js` | Vercel | NO APLICA |
| PROC-NOV-016 | Excluidas | Restaurar exclusión | manual | no | `app/catalogo/excluidas/actions.js` | Vercel | NO APLICA |
| PROC-SAGA-001 | Sagas | Refrescar colecciones/miembros TMDb | global manual | no | `refreshSagas` (`lib/sagas-v2.js`) | Vercel | SIN BATCH |
| PROC-PER-001 | Personas | Refrescar perfil y filmografía | individual | sí | `refreshPersonFilmography` | Vercel / Railway API | DIVERGENTE observabilidad |
| PROC-PQ-001 | PikoQuality | Calcular C6 | global por chunks | frontend batch | `processC6Batch` + `scorePikoQualityC6` | Vercel | MODELO ESPECIAL / deuda |
| PROC-PQ-002 | PikoQuality | Captura técnica Plex | global persistente | control especializado | Technical Snapshot worker | Vercel / Railway Technical | MODELO ESPECIAL |
| PROC-OPS-001 | Operaciones | Reiniciar título desde Novedades | manual destructivo funcional | no | `resetTitleToNews` | Vercel | NO APLICA |

`restartMissingLifecycleAction` (`/calidad/sin-estado`) es una operación de reparación administrativa sin código PROC propio: únicamente recrea Lifecycle cuando falta. Debe permanecer excepcional y no masificarse por defecto.

## Procesos con Batch

### ID-001
Trigger individual `/calidad/identidad` -> `obtainIdentityAction` -> `resolveIdentityUnitary` -> `executeId001Canonical`. Batch selecciona `IDENTITY_PENDING`, crea `batch_run_control`/`batch_run_items` y Railway API llama al mismo core. Fuente externa: TMDb. Escritura principal: identidad en `movies`; después Lifecycle. Concurrencia máxima 3 y API gate TMDb. **Paridad EXACTA**.

### IV-001 / IV-002
Individual y Batch comparten respectivamente `refreshIdentityEvidenceCanonical` y `validateIdentityCanonical`. La diferencia actual es de selección/guard: el individual puede trabajar también sobre `IDENTITY_REVIEW_REQUIRED`, mientras Batch excluye revisión humana y sólo toma `IDENTITY_VALIDATION`. Se considera **PARCIAL pero intencionalmente conservadora** mientras la política sea “no automatizar revisión manual”.

### DATA-001
Individual `updateDataAction` -> `updateDataQualityTitle` -> `executeData001Canonical(lane=manual)`. Batch -> Railway API -> `executeData001Canonical(lane=batch)`. Fuentes gobernadas por API gate. Concurrencia 2. **EXACTA**.

### DATA-002
Individual `refreshRatingsAction` -> `refreshRatingsForTitle` -> `refreshRatingsCanonical`; Batch -> mismo core. El wrapper individual añade auditoría histórica, pero la operación funcional es la misma. Concurrencia 2. **EXACTA funcional**.

### DATA-003
El entrypoint que usa realmente `/calidad/datos` importa `calculatePikoScoreV3Action` desde `app/calidad/datos/pikoscore-actions.js`; esa acción ejecuta `executeData003Canonical`. Railway FAST usa exactamente el mismo core. Por tanto la divergencia detectada inicialmente correspondía a una exportación antigua todavía presente en `app/calidad/datos/actions.js`, no al entrypoint vivo. Paridad viva: **EXACTA**. Pendiente de limpieza física: retirar esa implementación duplicada muerta cuando se cierre el barrido de consumidores.

### MOV-001
Individual y Railway FAST usan `executeMov001Canonical`. **EXACTA**.

### SER-002
Individual y Railway Plex usan `syncPlexSeriesDetailCore`. **EXACTA**.

### SER-003 / SER-004
Comparten core funcional con Batch, pero el adapter Railway reconstruye explícitamente el read model de Series después de cada item. El individual llega a esa reconstrucción a través de sus wrappers/acciones. Debe mantenerse un contrato de prueba que garantice equivalencia. **PARCIAL** por postprocesado, no por receta principal.

### PER-001
La lógica funcional sí se reutiliza, pero `refreshPersonFilmography()` crea su propio `process_run`. El adapter Batch lo llama dentro del child run que ya crea `executeClaimedItem`, produciendo una frontera observacional anidada. Objetivo: extraer `refreshPersonFilmographyCanonical(sql,id,{trace,...})`; individual y Batch deben envolver ese core. **DIVERGENTE en arquitectura/observabilidad**.

## Procesos globales y especializados

### NOV-001
Vercel crea la solicitud observada y hace dispatch de `.github/workflows/imdb-discovery.yml`; GitHub Actions ejecuta el discovery con el `run_id` canónico. Es una excepción explícita y acotada al modelo Railway persistente.

### NOV-009 -> NOV-008
La actualización Plex global y la siembra posterior de candidatos son dos procesos observados separados y correlacionados. Es composición global, no Batch de operaciones unitarias.

### SAGA-001
`refreshSagas()` es el refresco canónico observado de colecciones TMDb. Tiene límite 120, concurrencia 6, escribe `saga_collections` y `saga_collection_members`, resuelve IMDb por TMDb y registra errores por colección/fuente. No tiene Batch común porque su unidad de trabajo es un refresco global acotado.

### PQ-001
La UI crea un `process_runs` global y ejecuta chunks de `processC6Batch`; cada chunk aún genera además un `pipeline_runs`. Esa doble trazabilidad es **compatibilidad temporal** y mantiene `pipeline_runs` vivo. Debe converger antes de eliminar ese modelo histórico.

### PQ-002
Vercel solicita/controla captura técnica y Railway mantiene el worker persistente. Pausa/reanudación/cancelación usan su control especializado, no `batch_engine_control`.

## Decisiones manuales

ID-002, IV-003/004/005, DATA-005, MOV-002/003, SER-005/006, NOV-002/003/004/005/006/007/010/011/016 y OPS-001 son decisiones/correcciones humanas. No deben recibir Batch automáticamente.

## Hallazgos P5 abiertos

1. **P5-H01 — PER-001 (alta):** extraer core puro para eliminar observabilidad anidada en Batch.
2. **P5-H02 — NOV-005 (media):** el botón vivo de exclusión todavía entra por `app/novedades/actions.js` y no crea `process_runs`; migrarlo a acción observada propia.
3. **P5-H03 — Series (media):** mantener contrato explícito de paridad de read model para SER-003/004.
4. **P5-H04 — PikoQuality (alta antes de retirar `pipeline_runs`):** eliminar doble modelo de trazabilidad de PQ-001 o justificar formalmente la vectorización.
5. **P5-H05 — código histórico (media):** `app/actions.js`, `app/novedades/actions.js` y la exportación DATA-003 antigua contienen rutas/generaciones previas. Auditar consumidores y retirar sólo lo realmente no usado.
6. **P5-H06 — documentación histórica (alta para P6):** `docs/LIFECYCLE_CANONICAL_PROCESSES.md` describe reglas antiguas y no debe tratarse como fuente canónica.

## Hallazgos cerrados en este bloque

- **DATA-003:** el entrypoint vivo ya comparte `executeData003Canonical` con Batch; reclasificado a EXACTA.
- **DATA-008:** formalmente RETIRADO; cualquier optimización global futura debe seguir siendo infraestructura interna de DATA-002, no una segunda vía funcional.
- **IV-005, NOV-010, NOV-016, SAGA-001 y OPS-001:** incorporados al inventario maestro.
- **Batch V1:** eliminadas las referencias residuales encontradas en las acciones vivas de decisión manual de Validación de identidad; un contrato de regresión impide reintroducir `batch_process_state`, `batch_jobs`, `batch_runtime_control` o `batch_source_limits` en código vivo.

## Regla para nuevas implementaciones

Antes de añadir o modificar un proceso: definir PROC, operación canónica, trigger, executor, fuentes, lecturas/escrituras, transición Lifecycle, observabilidad, error/retry/idempotencia y, si existe Batch, demostrar que llama al mismo core. Cualquier excepción debe quedar registrada aquí antes de considerarse PRE-V4 ready.
