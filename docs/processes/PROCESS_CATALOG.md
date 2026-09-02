# PikoFilm — Catálogo canónico de procesos

Estado: **documentación canónica viva**. El código vivo manda cuando exista discrepancia. Este catálogo describe los entrypoints que realmente consume la UI, los executors y la frontera canónica; los módulos históricos no se consideran vigentes sólo por seguir presentes en el repositorio.

## Regla de arquitectura

Todo proceso funcional debe tener una única operación canónica reutilizable.

`individual -> observabilidad -> operación canónica X`

`Batch -> selección/cola -> child process_run -> operación canónica X`

Batch puede añadir selección, concurrencia, leases, pausa/reanudación/cancelación, rate limiting y agregación de métricas, pero **no puede mantener una segunda receta funcional**.

Estados de paridad: **EXACTA** = mismo core; **PARCIAL** = mismo core con guards/postprocesado distintos; **SIN BATCH** = proceso unitario/global sin Batch; **NO APLICA** = decisión humana que no debe masificarse; **MODELO ESPECIAL** = proceso global/persistente gobernado fuera del Batch Engine común; **RETIRADO** = proceso eliminado del sistema vivo.

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
| PROC-SER-001 | Series | Sync Plex rápido global | global | no | `syncPlexSeriesFastCore` | Vercel | SIN BATCH |
| PROC-SER-002 | Series | Detalle Plex de serie | individual | sí | `syncPlexSeriesDetailCore` | Vercel / Railway Plex | EXACTA |
| PROC-SER-003 | Series | Referencia TMDb | individual | sí | `refreshSeriesUnitaryCanonical` | Vercel / Railway API | PARCIAL controlada |
| PROC-SER-004 | Series | Disponibilidad España | individual | sí | `confirmSeriesEsAvailabilityCanonical` | Vercel / Railway API | PARCIAL controlada |
| PROC-SER-005 | Series | Resolver anomalía de episodio | manual | no | acción observada + override | Vercel | NO APLICA |
| PROC-SER-006 | Series | Retirar override de disponibilidad | manual | no | acción observada + refresh | Vercel | NO APLICA |
| PROC-NOV-001 | Novedades | Discovery IMDb global | global manual | no | GitHub Actions `imdb-discovery.yml` | GitHub Actions | SIN BATCH |
| PROC-NOV-002 | Novedades | Alta manual IMDb | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-003 | Novedades | Reintento candidato manual | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-004 | Novedades | Restaurar exclusión + alta manual | manual | no | `manual-candidate-actions.js` | Vercel | NO APLICA |
| PROC-NOV-005 | Novedades | Excluir candidato | manual | no | `app/novedades/exclude-actions.js` + `process_runs` | Vercel | NO APLICA |
| PROC-NOV-006 | Novedades | Retirar origen manual | manual | no | `manual-remove-actions.js` | Vercel | NO APLICA |
| PROC-NOV-007 | Novedades | Admitir candidato al catálogo | manual | no | `catalog-admission-actions.js` | Vercel | NO APLICA |
| PROC-NOV-008 | Novedades/Plex | Sembrar candidatos Plex | global encadenado | no | `seedPlexNewsCandidates` | Vercel | SIN BATCH |
| PROC-NOV-009 | Novedades/Plex | Sync Plex global | global manual | no | `syncPlexFast` | Vercel | SIN BATCH |
| PROC-NOV-010 | Novedades/Plex | Guardar IMDb manual de Plex | manual | no | `plex-identity-actions.js` | Vercel | NO APLICA |
| PROC-NOV-011 | Sagas/Novedades | Enviar miembro de Saga a Novedades | manual | no | `saga-news-actions.js` | Vercel | NO APLICA |
| PROC-NOV-016 | Excluidas | Restaurar exclusión | manual | no | `app/catalogo/excluidas/actions.js` | Vercel | NO APLICA |
| PROC-SAGA-001 | Sagas | Refrescar colecciones/miembros TMDb | global manual | no | `refreshSagas` (`lib/sagas-v2.js`) | Vercel | SIN BATCH |
| PROC-PER-001 | Personas | Refrescar perfil y filmografía | individual | sí | `refreshPersonFilmographyCanonical` | Vercel / Railway API | EXACTA |
| PROC-PQ-001 | PikoQuality | Calcular C6 | global por chunks | frontend batch | `processC6Batch` + `scorePikoQualityC6` | Vercel | MODELO ESPECIAL canónico |
| PROC-PQ-002 | PikoQuality | Captura técnica Plex | global persistente | control especializado | Technical Snapshot worker | Vercel / Railway Technical | MODELO ESPECIAL |
| PROC-OPS-001 | Operaciones | Reiniciar título desde Novedades | manual destructivo funcional | no | `resetTitleToNews` | Vercel | NO APLICA |

`restartMissingLifecycleAction` (`/calidad/sin-estado`) es una operación de reparación administrativa sin código PROC propio: únicamente recrea Lifecycle cuando falta. Debe permanecer excepcional y no masificarse por defecto.

## Qué significa Batch en PikoFilm

Un proceso es Batch común sólo cuando existe una operación individual canónica que puede repetirse sobre una selección de entidades sin cambiar su semántica. El Batch Engine común persiste el padre en `process_runs`, gobierna la ejecución en `batch_run_control`, materializa unidades en `batch_run_items` y crea un child `process_run` por intento. Los pools vigentes son `api`, `fast` y `plex`; el worker Technical y PQ-001 son modelos especializados y no deben forzarse artificialmente dentro del Batch Engine.

La UI inicia los Batch de forma explícita. No existe inicio automático por cron o por worker. La selección, concurrencia, leases, reintentos y API governance son infraestructura de ejecución, no procesos funcionales nuevos.

## Procesos con Batch común

### ID-001
Trigger individual `/calidad/identidad` -> `obtainIdentityAction` -> `resolveIdentityUnitary` -> `executeId001Canonical`. Batch selecciona `IDENTITY_PENDING`, crea `batch_run_control`/`batch_run_items` y Railway API llama al mismo core. Fuente externa: TMDb. Escritura principal: identidad en `movies`; después Lifecycle. Concurrencia máxima 3 y API gate TMDb. **Paridad EXACTA**.

### IV-001 / IV-002
Individual y Batch comparten respectivamente `refreshIdentityEvidenceCanonical` y `validateIdentityCanonical`. La diferencia es de selección/guard: el individual puede trabajar también sobre `IDENTITY_REVIEW_REQUIRED`, mientras Batch excluye revisión humana y sólo toma `IDENTITY_VALIDATION`. **PARCIAL intencionalmente conservadora**: Batch no automatiza decisiones humanas.

### DATA-001
Individual `updateDataAction` -> `updateDataQualityTitle` -> `executeData001Canonical(lane=manual)`. Batch -> Railway API -> `executeData001Canonical(lane=batch)`. Fuentes gobernadas por API gate. Concurrencia 2. **EXACTA**.

### DATA-002
Individual `refreshRatingsAction` -> `refreshRatingsForTitle` -> `refreshRatingsCanonical`; Batch -> mismo core. El wrapper individual añade auditoría histórica, pero la operación funcional es la misma. Concurrencia 2. **EXACTA funcional**.

### DATA-003
El entrypoint vivo de `/calidad/datos` usa `calculatePikoScoreV3Action` y ejecuta `executeData003Canonical`; Railway FAST usa el mismo core. **EXACTA**. Una exportación histórica todavía presente no se considera una segunda vía viva y queda para limpieza documental/código tras barrido de consumidores.

### MOV-001
Individual y Railway FAST usan `executeMov001Canonical`. **EXACTA**.

### SER-002
Individual y Railway Plex usan `syncPlexSeriesDetailCore`. **EXACTA**.

### SER-003 / SER-004
Comparten core funcional con Batch. El adapter Railway reconstruye explícitamente el read model de Series después de cada item y el individual lo reconstruye a través de su wrapper. `test/series-read-model-parity-contract.test.mjs` fija esa equivalencia. **PARCIAL controlada** por postprocesado, no por receta principal.

### PER-001
`refreshPersonFilmographyCanonical(sql,id,{trace,apiGate,lane})` es la única receta funcional. El individual crea su `process_run` y llama al core; Railway API ejecuta el mismo core dentro del child `process_run` ya creado por Batch. No existe una segunda frontera observacional anidada. **EXACTA**.

## Procesos globales y especializados

### NOV-001
Vercel crea la solicitud observada y hace dispatch de `.github/workflows/imdb-discovery.yml`; GitHub Actions ejecuta Discovery con el `run_id` canónico. Es una excepción explícita, manual y no persistente al modelo Railway.

### NOV-009 -> NOV-008
La actualización Plex global y la siembra posterior de candidatos son dos procesos observados separados y correlacionados. Es composición global, no Batch de operaciones unitarias.

### SAGA-001
`refreshSagas()` es el refresco canónico observado de colecciones TMDb. Tiene límite 120, concurrencia 6, escribe `saga_collections` y `saga_collection_members`, resuelve IMDb por TMDb y registra errores por colección/fuente. No usa Batch común porque su unidad de trabajo es un refresco global acotado.

### PQ-001
La UI crea **un único `process_runs` canónico** para la ejecución C6 y procesa bloques acotados con `processC6Batch`. Cada chunk actualiza `items_processed`, `items_succeeded`, `items_pending`, heartbeat y métricas del mismo run. `pipeline_runs` deja de ser escrito por PQ-001; su eventual retirada física de Neon es una decisión separada y sólo podrá hacerse tras verificar que no queden otros consumidores. El cálculo, fingerprint y agregados de C6 no cambian. **MODELO ESPECIAL canónico**.

### PQ-002
Vercel solicita/controla captura técnica y Railway mantiene el worker persistente. Pausa/reanudación/cancelación usan su control especializado, no `batch_engine_control`.

## Decisiones manuales

ID-002, IV-003/004/005, DATA-005, MOV-002/003, SER-005/006, NOV-002/003/004/005/006/007/010/011/016 y OPS-001 son decisiones/correcciones humanas. No deben recibir Batch automáticamente.

NOV-005 ya entra por una acción observada propia (`exclude-actions.js`), persiste la exclusión global y registra la decisión en `process_runs`/eventos. No se considera candidato a Batch.

## Modelos de estado y observabilidad

- `process_runs` + `process_run_events` + `process_run_errors`: **fuente canónica de observabilidad de ejecución**.
- `batch_run_control` + `batch_run_items` + `batch_engine_control`: **estado operativo canónico del Batch Engine**; no sustituyen a `process_runs`.
- `pipeline_runs`: **compatibilidad histórica**. PQ-001 ya no lo escribe. No eliminar físicamente sin un gate específico de consumidores.
- `series_quality_runs`: **compatibilidad temporal de Series**; el flujo manual vigente todavía lo utiliza y la UI mantiene lectura de último estado. No retirar durante P5.
- `piko_quality` y `piko_quality_aggregates`: estado/read model funcional de PikoQuality, no logs de ejecución.
- `person_refresh_state` y `person_filmography`: estado/read model funcional de Personas, no observabilidad alternativa.

## P5 — cierre de hallazgos

- **P5-H01 — PER-001: CERRADO.** Core canónico compartido y una sola frontera `process_run` por ejecución individual/child Batch.
- **P5-H02 — NOV-005: CERRADO.** Exclusión viva observada bajo `PROC-NOV-005` y nombre humano en Operaciones.
- **P5-H03 — Series: CERRADO.** Contrato explícito fija la reconstrucción del read model para SER-003/004 en individual y Batch.
- **P5-H04 — PikoQuality: CERRADO EN CÓDIGO.** PQ-001 converge en `process_runs`; `pipeline_runs` deja de recibir sus chunks. La eliminación física de la tabla queda fuera de este cierre hasta auditoría de consumidores.
- **P5-H05 — código histórico: NO BLOQUEANTE PARA EL CATÁLOGO.** Las exportaciones/módulos históricos que no son entrypoint vivo no definen procesos; su eliminación física requiere barrido de consumidores y pertenece a limpieza posterior, no a redefinir el catálogo.
- **P5-H06 — documentación histórica: DIFERIDO A P6.** `docs/LIFECYCLE_CANONICAL_PROCESSES.md` y documentos históricos deben etiquetarse/depurarse en la fase documental; este archivo es la fuente canónica P5.

## Gate P5

P5 queda funcionalmente listo cuando los contratos de CI de observabilidad/paridad pasan junto con el build y los cambios de PQ-001 siguen sin fusionar/desplegar hasta decisión explícita. La fase no autoriza por sí sola eliminar `pipeline_runs`, `series_quality_runs`, servicios Railway ni otros modelos de compatibilidad.

## Regla para nuevas implementaciones

Antes de añadir o modificar un proceso: definir PROC, operación canónica, trigger, executor, fuentes, lecturas/escrituras, transición Lifecycle, observabilidad, error/retry/idempotencia y, si existe Batch, demostrar que llama al mismo core. Cualquier excepción debe quedar registrada aquí antes de considerarse PRE-V4 ready.
