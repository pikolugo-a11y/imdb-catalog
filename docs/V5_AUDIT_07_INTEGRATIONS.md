# PikoFilm V5 — Auditoría Punto 7 · Integraciones externas

Estado: **Fase 1 CERRADA — auditoría completa y persistida**.

Rama: `audit/v5-07-integrations`.

## Alcance obligatorio

Auditar profundamente las integraciones externas reales de PikoFilm: Plex, TMDb, IMDb/datasets oficiales, OMDb, MDBList, Watchmode, Wikidata, FilmAffinity y cualquier otra fuente viva o residual detectada.

La auditoría debe cubrir como mínimo:
- callers y operaciones canónicas;
- autenticación/secretos;
- timeouts;
- retries/backoff;
- rate limits/cuotas;
- circuit breakers;
- API governance;
- fallback/degradación;
- clasificación de errores;
- observabilidad;
- paridad manual/Batch;
- estado vivo en Neon/Railway;
- código legacy/residual;
- documentación vs implementación real.

No presentar propuestas V5 hasta cerrar y persistir esta Fase 1.

## Estado heredado

- Punto 6 Workers: **CERRADO**.
- WKR-01..WKR-13: APROBADAS.
- Innovaciones válidas Punto 6:
  - INNO-WKR-01 Runtime Fabric: RECHAZADA.
  - INNO-WKR-02 Burst Mode: RECHAZADA.
  - INNO-WKR-03 Shadow Worker: RECHAZADA.
  - INNO-WKR-04 Local Core: APROBADA PARA ESTUDIAR → ROADMAP INNO-07.
  - INNO-WKR-05 Split Execution: APROBADA PARA ESTUDIAR → ROADMAP INNO-08.
- Job Mode fue retirada por duplicar V5 y no contó entre las 5.

## Hallazgos ya verificados en Fase 1

### 1. Gobierno canónico de APIs
`batch_api_source_limits`, `batch_api_source_usage` y `batch_api_source_leases` gobiernan actualmente:
- tmdb
- omdb
- mdblist

Hard caps de código:
- TMDb: maxConcurrency 8, sin daily limit duro.
- OMDb: maxConcurrency 8, dailyLimit 100000.
- MDBList: maxConcurrency 8, dailyLimit 25000.

Estado vivo 2026-09-20:
- breakers cerrados para las tres;
- 0 active leases en el momento de inspección;
- últimos 30 días:
  - TMDb: 14.874 llamadas, 13 errores de gate/usage, 0 rate-limited.
  - MDBList: 198 llamadas, 0 errores, 0 rate-limited.
  - OMDb: 79 llamadas, 0 errores, 0 rate-limited.

### 2. Ratings
`title_ratings` está dominada por MDBList como agregador:
- IMDb vía MDBList: 20.790 filas.
- Trakt vía MDBList: 20.766.
- TMDb vía MDBList: 20.754.
- RT audience: 17.786.
- Letterboxd: 16.798.
- RT critics: 14.910.
- Metacritic: 13.029.
- Metacritic user: 12.703.
- Roger Ebert: 8.737.
Rescates directos OMDb/TMDb son residuales.

### 3. Watchmode está vivo y fuera del gobierno común
Aunque `V4_ARCHITECTURE.md` dice que Watchmode “si en el futuro debe gobernarse…”:
- Railway API tiene `WATCHMODE_API_KEY`;
- `lib/series-es-availability-core.mjs` llama Watchmode activamente;
- Watchmode tiene retry local (máx. 2) pero NO usa `apiGate`;
- no tiene timeout explícito;
- Production contiene:
  - 55 filas `watchmode_episode_witness_es`;
  - 15 filas `tmdb_watchmode_es`;
  - actividad hasta 2026-09-19.
Esto es una discrepancia documentación/sistema vivo.

### 4. SER-004 es la integración más degradada funcionalmente
Últimos 30 días:
- 321 runs;
- 234 succeeded;
- 83 partial;
- 4 failed.
Combina TMDb + Watchmode.
El fallback Watchmode puede convertir el proceso en partial si falla.

### 5. Errores mal atribuidos a TMDb
Muchos errores recientes con `source='tmdb'` no eran fallos externos, sino errores internos de PikoFilm:
- `column "tmdb_rating" does not exist`
- ocurren en DATA/LC.
También se observaron 404 de validación TMDb marcados `retryable=true`.
La clasificación actual distorsiona la salud real de la integración.

### 6. Código legacy de Integraciones aún coexistente
La tabla `movies` ya NO tiene:
- `fa_id`
- `fa_rating`
- `fa_votes`
- `tmdb_rating`
- `tmdb_votes`

Sin embargo `lib/data-quality-repair.js` todavía intenta leer/escribir esas columnas y contiene caminos directos:
- OMDb sin gate;
- TMDb sin gate;
- FilmAffinity directo;
- recomputación de score basada en columnas retiradas.
No se ha confirmado todavía si tiene callers vivos; debe completarse el consumer sweep antes de clasificarlo como eliminable.

### 7. FilmAffinity
Coexisten al menos:
- `lib/filmaffinity-rating.js`
- `lib/filmaffinity-source.mjs`
- lógica FilmAffinity dentro de `data-quality-repair.js`.

Las antiguas lambdas Python FA sí están documentadas como retiradas, pero el estado de las implementaciones JS aún debe cerrarse con consumer sweep.

### 8. Wikidata e IMDb Discovery
`PROC-NOV-001` usa:
- datasets oficiales IMDb (`title.ratings.tsv.gz`, `title.basics.tsv.gz`);
- Wikidata SPARQL para país/mercado español;
- fallback TMDb para país.

Estos caminos NO usan el gate común.
El worker:
- tiene timeout global GitHub Actions de 20 min;
- los fetch IMDb/Wikidata/TMDb no tienen un timeout por request homogéneo;
- Wikidata se degrada a parcial y TMDb fallback usa concurrencia interna 8;
- hay que decidir si son excepciones legítimas o deuda de gobierno.

### 9. Identidad
Se detectó `lib/identity-resolver.js` con llamadas TMDb directas y timeout 15 s.
`identity-correction.js` usa ese resolver para validación manual de IDs.
Debe verificarse si este camino manual está intencionadamente fuera del gate o viola la regla canónica “TMDb no se consulta sin governance”.

### 10. Plex
Plex sigue siendo integración física canónica.
Hallazgos ya conocidos:
- NOV-009 y SER-001 son globales manuales y durables en Railway Plex;
- SER-002 es detalle durable;
- hubo timeouts reales de Plex en los últimos 30 días;
- la reconciliación física de SER-001 fue corregida en PR #581 para detectar cambios de Media/Part aunque `updatedAt` no cambie;
- falta cerrar auditoría específica de todos los timeout/retry/fallback de Plex y la clasificación 404/retryable.

## Estado vivo de procesos relevantes (30 días)

- DATA-001: 55 runs · 43 succeeded · 9 partial · 3 failed.
- DATA-002: 95 · 94 succeeded · 1 failed.
- ID-001: 26 · 22 succeeded · 1 partial · 3 failed.
- IV-001: 27 · 27 succeeded.
- NOV-001: 3 · 3 succeeded.
- NOV-009: 43 · 30 succeeded · 11 failed.
- PER-001: 18.840 · 18.837 succeeded · 2 failed.
- SAGA-001: 1.592 · 1.588 succeeded · 3 partial.
- SER-001: 42 · 34 succeeded · 7 partial.
- SER-002: 781 · 770 succeeded · 1 partial · 5 failed.
- SER-003: 494 · 471 succeeded · 5 partial · 18 failed.
- SER-004: 321 · 234 succeeded · 83 partial · 4 failed.

## Cierre de la Fase 1 — consumer sweep, contratos y riesgos finales

La auditoría se cerró contrastando la rama activa, el esquema y ejecución viva de Neon y los servicios/variables disponibles en Railway. El sistema vivo prevalece sobre documentación previa.

### 11. Railway: distribución real de secretos y workloads

Proyecto vivo: PikoFilm Batch, entorno production.

- pikofilm-worker-api-v3 dispone de TMDB_API_TOKEN, OMDB_API_KEY, MDBLIST_API_KEY, WATCHMODE_API_KEY, PLEX_TOKEN y DATABASE_URL.
- pikofilm-batch-plex-worker-v2 dispone de PLEX_TOKEN y DATABASE_URL.
- pikofilm-technical-snapshot-worker-v1 dispone de PLEX_TOKEN y DATABASE_URL.
- pikofilm-batch-fast-worker-v1 no necesita credenciales de APIs externas en su configuración viva.

Los valores permanecieron redacted; sólo se auditó presencia/nombre. Watchmode está provisionado explícitamente en el runtime API de Production y no es una integración hipotética.

Durante esta auditoría Neon Postgres Direct devolvió HTTP 401 por credenciales, mientras el conector oficial Neon permitió consultas read-only. No se cambió ninguna credencial ni se hizo ninguna mutación.

### 12. Consumer sweep FilmAffinity y enriquecimiento legacy

data-quality-repair.js sigue exportando retryDataQualitySource/repairDataQualityTitle y contiene OMDb directo sin gate/timeout explícito, TMDb directo sin gate/timeout explícito, FilmAffinity directo y score basado en columnas antiguas. Los entrypoints canónicos actuales de Calidad/Datos inspeccionados usan data001-canonical.mjs y ratings-refresh-core.mjs, no este módulo. Debe tratarse como legacy peligroso, no como fallback válido.

El problema más grave es enrich-title.js. Mantiene su propia receta Wikidata + FilmAffinity + TMDb + ratings IMDb + score heredado y sigue leyendo/escribiendo imdb_rating, imdb_votes, fa_id, fa_rating, fa_votes, tmdb_rating y tmdb_votes dentro de movies.

El esquema vivo de Neon confirmó que esas columnas de rating/FilmAffinity ya no existen; de ese grupo sólo siguen existiendo tmdb_id y wikidata_id.

enrich-title.js sí tiene consumers vivos:
- identity-refresh.js llama enrichTitle() para identidad normal;
- app/calidad/identidad/actions.js::refreshIdentityDataAction llama refreshKnownIdentity();
- IdentityRefreshButton expone esa acción en UI;
- identity.js::reanalyzeIdentity() también llama enrichTitle().

Por tanto existe una ruta UI/operativa viva estructuralmente incompatible con el esquema actual. El camino TMDb-only usa enrich-title-tmdb-only.js y no comparte este defecto.

Coexisten además filmaffinity-rating.js, filmaffinity-source.mjs y FilmAffinity embebido en enrich-title.js/data-quality-repair.js. Los helpers tienen timeout 15 s pero distinta semántica de error. Las antiguas lambdas Python están retiradas; la duplicidad JS sigue siendo deuda real.

### 13. OMDb: gobierno canónico y bypass vivo en Novedades

Los cores canónicos DATA/ratings/evidencia usan gate en sus wrappers actuales. Sin embargo news-manual-resolver.js importa omdbMinimumByImdb():
- omdb-minimum.js llama directamente www.omdbapi.com;
- tiene timeout por request de 10 s;
- no usa apiGate, lease, cuota ni circuit breaker;
- el error se captura y degrada la preparación manual a failed.

Este camino está vivo en preparación/reintento de candidatos de Novedades mediante news-intake-v4.js. La regla documentada de OMDb gobernado/fail-closed no es universal.

Production registró además Incorrect IMDb ID. como OMDb retryable, aunque es una condición de input/aplicación que normalmente no mejora con retry.

### 14. TMDb: callers, fail-closed, timeouts y 404

Caminos gobernados en sus wrappers actuales: ID-001, IV-001, DATA-001, DATA-002, SER-003, parte TMDb de SER-004, PER-001, SAGA-001 y TMDb-only.

Bypasses/contratos inseguros:
- identity-resolver.js usa TMDb directo, timeout 15 s y sin gate; lo consume identity-correction.js / ID-002;
- imdb-discovery.mjs usa fallback TMDb para país fuera del gate común;
- enrich-title.js adquiere gate sólo para TMDb, pero la receta completa está rota por el esquema legacy;
- identity-validation-canonical.mjs permite raw fetch cuando recibe apiGate=null; los callers actuales inspeccionados pasan gate, pero el core no es fail-closed por construcción.

La política de timeout TMDb está fragmentada: 15 s en resolver/validación/TMDb-only, pero sin timeout explícito por request en DATA-001/DATA-002, Personas, Sagas y Series disponibilidad. Discovery mantiene política propia.

Los 404 tampoco son uniformes: Sagas y Series tienen 404 funcionales esperados, mientras Identity Validation/Correction ha producido 404 retryable en Production.

### 15. MDBList

MDBList es la fuente técnica principal de ratings lógicos y está gobernada en DATA-002. Permanece además ratings-provider-mdblist.js, helper separado capaz de fetch directo si se usa fuera del core. La duplicidad crea riesgo de bypass futuro. No hubo rate limits vivos en la ventana auditada; hard cap 25.000/día y concurrencia 8.

### 16. Wikidata e IMDb oficial

NOV-001 usa datasets oficiales IMDb, Wikidata SPARQL para país/mercado español y fallback TMDb. Corre en GitHub Actions y no comparte batch_api_source_limits/leases. Agrupa fallos de país como wikidata_tmdb.

wikidata-source.mjs tiene timeout 12 s, pero Discovery mantiene implementación propia y enrich-title.js conserva otro query Wikidata. No existe un único cliente Wikidata canónico.

IMDb datasets no son una API unitaria comparable con TMDb/OMDb: su riesgo está en descarga/parseo global, timeout total del workflow y fallback de país.

### 17. Plex: auditoría endpoint por endpoint

Plex mantiene correctamente su frontera de fuente física y no necesita el mismo gate de APIs públicas. Sí existen tres políticas HTTP distintas.

A) Series usa fetchPlexJsonWithRetry:
- requests normales 45/60/90 s;
- inventarios pesados 1000/1000/1000 s;
- 429, 5xx, timeout/Abort y TypeError transitorio son retryable;
- 404 y resto de 4xx no retryable;
- heartbeat/retry observado.

Endpoints: /library/sections; /library/sections/{section}/all; inventario type=4 includeMedia=1; /library/metadata/{show}/children; /library/metadata/{season}/children; /library/metadata/{episode}?includeMedia=1.

B) NOV-009 usa plex-sync-core.mjs:
- discovery plex.tv/api/resources timeout 15 s, sin retry local;
- pget contra Plex timeout 120 s, sin retry local;
- /library/sections, full section includeGuids/includeMedia y metadata por rating_key;
- errores no normalizados por plex-request-error.mjs.

C) Captura técnica usa discovery común pero fetch directo metadata includeGuids/includeMedia con timeout 120 s y sin helper de retry Series.

En Production hubo timeouts Plex retryable, 404 metadata/children no retryable y un error histórico del antiguo límite Vercel. HTTP 404 no retryable es razonable, pero el significado funcional entidad desaparecida vs referencia stale depende del caller y no de un contrato Plex global.

### 18. Personas y Sagas

PER-001 y SAGA-001 usan requireApiGate TMDb y comparten receta manual/Batch. Personas resuelve películas con concurrencia interna 8 y puede degradar detalles no críticos; Sagas trata 404 de colección/external_ids como estados funcionales. Ambos carecen de timeout explícito por request.

### 19. Observabilidad: health de proveedor contaminado

La tabla viva es process_run_errors. En la ventana inspeccionada: TMDb no-retryable 104; TMDb retryable 67; Plex no-retryable 3; Plex retryable 2; OMDb retryable 2.

Gran parte de TMDb no fue un fallo externo:
- 98 x relation tmdb_external_ids does not exist en refresh_collection;
- 58 x column tmdb_rating does not exist en PROC-LC-001/data_tmdb;
- 7 x el mismo error en PROC-DATA-001/source_tmdb.

Por tanto source no puede interpretarse hoy como disponibilidad del proveedor sin separar proveedor, contrato interno, input inválido y estado funcional esperado.

### 20. Estado vivo actualizado al cierre

Los contadores son ventanas móviles y pueden variar respecto al checkpoint anterior:
- DATA-001: 43 succeeded, 9 partial, 3 failed;
- DATA-002: 94 succeeded, 1 failed;
- ID-001: 22 succeeded, 1 partial, 3 failed;
- IV-001: 27 succeeded;
- NOV-001: 3 succeeded;
- NOV-009: 32 succeeded, 1 partial, 12 failed, 2 cancelled;
- SER-001: 36 succeeded, 7 partial, 1 cancelled;
- SER-002: 776 succeeded, 1 partial, 5 failed, 5 cancelled;
- SER-003: 474 succeeded, 5 partial, 18 failed;
- SER-004: 236 succeeded, 83 partial, 4 failed.

series_season_availability confirma actividad reciente: plex_complete 3.206; tmdb_season_watch_providers 366; tmdb_watch_providers 193; manual 99; plex_coverage_changed 65; watchmode_episode_witness_es 55; tmdb_watchmode_es 15.

### 21. Matriz final de gobierno

| Integración | Viva | Gate común | Timeout homogéneo | Retry homogéneo | Hallazgo |
|---|---:|---:|---:|---:|---|
| Plex | Sí | No aplica | No | No | tres políticas HTTP coexistentes |
| TMDb | Sí | Parcial | No | No | bypasses manual/Discovery y 404 inconsistentes |
| IMDb datasets | Sí | No aplica | No | No | pipeline GitHub con fallback propio |
| OMDb | Sí | Parcial | No | No | Novedades manual bypassa gate |
| MDBList | Sí | Sí en core | No | Parcial | proveedor principal; helper duplicado |
| Watchmode | Sí | No | No | Local | SER-004 activo fuera de governance |
| Wikidata | Sí | No | No | No | múltiples clientes |
| FilmAffinity | Sí/legacy mixto | No | Parcial | Divergente | duplicidad y ruta legacy viva |

### 22. Riesgos finales priorizados

Críticos:
1. Ruta viva de refresco normal de Identidad incompatible con el esquema real.
2. Errores internos etiquetados como proveedor externo, contaminando observabilidad/decisiones.
3. Fail-closed documentado incumplido por callers vivos TMDb/OMDb.

Altos:
4. Watchmode activo sin gate, timeout explícito, cuota/breaker común ni documentación correcta.
5. Plex carece de contrato HTTP único; NOV-009 y Technical no usan el helper robusto de Series.
6. Timeouts ausentes en varios cores gobernados.

Medios:
7. Clientes duplicados FilmAffinity/Wikidata/MDBList.
8. Discovery IMDb/Wikidata/TMDb con gobierno propio y observabilidad demasiado combinada.
9. Semántica 404/retryable no normalizada por integración/contexto.
10. Documentación V4 obsoleta respecto a Watchmode y varios contratos reales.

## Conclusión de la Fase 1

La Fase 1 del Punto 7 queda **CERRADA**.

Los cores canónicos principales de TMDb/OMDb/MDBList ya tienen una base de governance útil y Plex está correctamente separado como fuente física. El problema estructural es que ese contrato no cubre todos los caminos vivos y coexisten clientes históricos con semánticas distintas.

No se implementó ninguna corrección funcional durante esta auditoría, no se mutó Neon y no se desplegó Vercel Production.

**Siguiente fase:** Fase 2, mínimo 10 propuestas V5 revisadas una a una. La primera propuesta todavía no se presenta en esta Fase 1.
