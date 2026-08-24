# PikoFilm — Procesos canónicos de Lifecycle

Estado: Fase 1 cerrada para diseño del orchestrator. Fuente de verdad: implementación unitaria vigente del frontal. El código histórico solo sirve como apoyo cuando no contradice al unitario actual.

## Regla principal

Un job automático representa un **proceso Lifecycle sobre un título**, no una fuente externa. TMDb, OMDb, FilmAffinity, Wikidata, Plex, etc. son pasos internos de la receta. Cada paso debe registrar intento, hallazgo, cambio, evidencia, error y duración. Al terminar se recalcula Lifecycle una sola vez y se clasifica el resultado funcional.

## Resultados funcionales

- `CORREGIDO`: el proceso resolvió el bloqueo y el título avanzó de estado.
- `ACTUALIZADO_SIN_AVANCE`: hubo cambios útiles, pero el título sigue en el mismo estado por otro bloqueo.
- `SIN_CAMBIOS`: todas las consultas necesarias fueron correctas, pero no cambiaron datos.
- `NO_ENCONTRADO`: una fuente respondió correctamente pero no encontró el dato requerido.
- `INCOMPLETO`: se obtuvieron datos parciales, pero sigue faltando evidencia/dato obligatorio.
- `REVISION_MANUAL`: agotadas las alternativas automáticas razonables o el estado requiere decisión humana.
- `ERROR`: fallo técnico real.

## IDENTITY_PENDING — Obtener identidad

Fuente canónica: `resolveIdentityUnitary()`.

Precondición: IMDb válido; falta `tmdb_id` o `fa_id`.

Receta:
1. Conservar cualquier `tmdb_id`/`fa_id` ya conocido.
2. Si falta TMDb: resolver IMDb → TMDb.
3. Si falta FA: Wikidata por IMDb (`P345` → `P480`).
4. Si sigue faltando FA y ya existe TMDb: Wikidata por TMDb (película/serie).
5. Si sigue faltando FA: llamar al **FA Search actual** (`/api/fa-search`) con IMDb, títulos y año. Guardar `confidence`, `margin`, candidatos, queries, tiempo y error.
6. Guardar únicamente IDs faltantes; no reemplazar identidades conocidas automáticamente.
7. Recalcular Lifecycle.

Éxito: IMDb + TMDb + FA completos → `IDENTITY_VALIDATION`.

No resuelto: `NO_ENCONTRADO`/`INCOMPLETO`; tras política de reintentos pasa a revisión manual. Nunca sustituir el buscador FA actual por Brave u otra lógica histórica sin decisión explícita.

## IDENTITY_VALIDATION — Obtener evidencia y validar identidad

Fuente canónica: `refreshIdentityEvidence()` + `validateOne()`.

Precondición: IMDb + TMDb + FA completos.

Receta de evidencia:
1. IMDb: reutilizar evidencia válida en caché; si falta, usar `catalog_candidates`/catálogo; OMDb es fallback para título/año IMDb.
2. TMDb: obtener título español, título original y año del ID TMDb actual.
3. FilmAffinity: obtener título español, título original y año mediante `/api/fa-evidence` para el FA ID actual.
4. Guardar evidencia por fuente con timestamp. Si cambia un ID manualmente, invalidar solo la evidencia de la fuente modificada.
5. Cuando estén los tres títulos originales y años, ejecutar `validateIdentityEvidence()`.

Algoritmo actual: similitud de títulos originales + años, normalización/transliteración, comparación de títulos localizados y rescates multilingües/cross-alphabet. Estados automáticos: `valid`, `doubtful`, `invalid`.

Salida:
- `valid` → siguiente estado Lifecycle, normalmente `DATA_INCOMPLETE` o `PIKOSCORE_PENDING` según cobertura.
- `doubtful`/`invalid` → `IDENTITY_REVIEW_REQUIRED`.
- evidencia insuficiente → permanecer `IDENTITY_VALIDATION` con resultado `INCOMPLETO`.

## IDENTITY_REVIEW_REQUIRED — Revisión humana

No es un proceso masivo automático. El usuario puede:
- marcar `valid`, `doubtful` o `invalid` manualmente;
- corregir IMDb/TMDb/FA, lo que invalida la evidencia afectada y devuelve a validación;
- quitar una decisión manual para restaurar el último resultado automático.

Por defecto queda excluido de ejecuciones automáticas.

## DATA_INCOMPLETE — Completar ficha

Fuente canónica: `updateDataQualityTitle()` + `finalizeRatingsRefresh()`.

Precondición: identidad `valid`.

Datos obligatorios actuales: título ES, título original, año, tipo, IMDb nota/votos, FA nota/votos, TMDb nota/votos, duración, país, géneros, sinopsis y póster.

Receta actual, en este orden:
1. TMDb: completa metadatos faltantes y actualiza nota/votos TMDb. También sinopsis, idioma, fecha, géneros, director/reparto y arte cuando falten.
2. OMDb: completa faltantes, actualiza IMDb nota/votos y obtiene RT/Metacritic; puede aportar póster, sinopsis, géneros, director/reparto.
3. IMDb fallback: se ejecuta como paso de la receta y solo actúa si IMDb nota/votos siguen faltando.
4. FilmAffinity: usando `fa_id` conocido, actualiza nota/votos y título ES cuando falta.
5. Si cambió cualquier rating, invalidar PikoScore anterior.
6. `finalizeRatingsRefresh`: solo marca notas frescas si TMDb + FA + (OMDb o IMDb fallback) fueron verificados.
7. Recalcular Lifecycle.

Salida:
- ficha completa → `PIKOSCORE_PENDING`.
- sigue faltando algo → `DATA_INCOMPLETE` con `ACTUALIZADO_SIN_AVANCE`, `NO_ENCONTRADO` o `INCOMPLETO` según evidencia.

## PIKOSCORE_PENDING — Refrescar notas y calcular PikoScore

Fuentes canónicas: `refreshRatingsForTitle()` + `finalizeRatingsRefresh()` + `calculatePikoScoreForTitle()`.

Receta:
1. TMDb rating/votes.
2. OMDb para IMDb rating/votes + RT/Metacritic.
3. IMDb fallback **solo si OMDb falla**.
4. FilmAffinity rating/votes.
5. Si las tres fuentes obligatorias quedan verificadas, actualizar `ratings_refreshed_at`.
6. Calcular PikoScore v2.0.0 únicamente con notas frescas y seis valores obligatorios > 0.
7. Guardar score, confianza, versión, modificador de críticos y snapshots de votos.
8. Recalcular Lifecycle.

Si una fuente obligatoria no se verifica, no calcular PikoScore y mantener el estado pendiente con diagnóstico de la fuente.

## MOVIE_FILE_PENDING — Validación del archivo físico de película

Fuente canónica: `validateMovieFile()`.

Precondición: película en Plex con archivo físico activo.

Receta:
1. Localizar todas las versiones físicas activas ligadas al IMDb.
2. Comparar duración Plex vs duración canónica con los criterios configurables.
3. Comparar nombre/año del archivo con Plex/título ES/original.
4. Detectar múltiples versiones físicas.
5. Crear/actualizar findings `duration`, `filename`, `duplicate`; resolver findings antiguos que ya no aplican.
6. Guardar fingerprint validado del archivo actual.
7. Recalcular Lifecycle.

Salida:
- sin findings pendientes → `TECH_PENDING`.
- findings → `MOVIE_FILE_REVIEW`.

## MOVIE_FILE_REVIEW — Decisión humana

No se procesa en masa por defecto.

Decisiones actuales:
- `Es correcta` → finding `exception`, Lifecycle puede continuar a PikoQuality.
- `Ya la corregí` → reset del título físico/catálogo y retorno por Plex → Novedades tras sincronización.

## SERIES_SYNC_PENDING — Crear/refrescar referencia oficial

Fuente canónica: `refreshSeriesUnitary()`.

Precondición: identidad validada, serie no excluida y en Plex.

Receta:
1. Reconciliar referencias serie desde Plex.
2. Obtener serie TMDb y `watch/providers` de España.
3. Recorrer temporadas > 0 y obtener episodios oficiales de TMDb.
4. Calcular disponibilidad ES por temporada (`ES_AVAILABLE`, `ES_PARTIAL`, `ES_NOT_YET`, `UNKNOWN`) respetando overrides manuales.
5. Reemplazar referencia oficial de episodios y actualizar número oficial de temporadas/episodios.
6. Recalcular Lifecycle.

Salida:
- faltantes/extra/disponibilidad desconocida → `SERIES_REVIEW`.
- sin incidencias y PikoQuality pendiente → `TECH_PENDING`.
- sin incidencias ni PQ pendiente → `COMPLETE`.

## SERIES_REVIEW — Revisión de cobertura/disponibilidad

Estado de excepción/revisión. El unitario permite **Refrescar serie** para volver a consultar TMDb y permite marcar disponibilidad ES manualmente por temporada. No debe reintentarse de forma masiva indefinidamente: por defecto queda fuera salvo que el usuario incluya explícitamente no resueltos o cambie el contexto.

## TECH_PENDING — PikoQuality

### Películas
Fuente canónica: `analyzeMoviePikoQuality()`.

Precondición: archivo físico actual validado y fingerprint vigente.

Receta:
1. Obtener detalle/streams actuales desde Plex.
2. Seleccionar stream de vídeo y audio representativos.
3. Calcular PikoQuality con fórmula vigente.
4. Guardar score/banda/confianza/fingerprint/version.
5. Recalcular Lifecycle → normalmente `COMPLETE`.

### Series
El frontal actual no expone un unitario equivalente por serie/episodio. Existe el proceso histórico `processLifecycleABatch()` que puntúa películas y episodios, pero **no se declarará canónico para masivos hasta crear/validar un unitario por serie que reproduzca exactamente esa semántica**. Hasta entonces, TECH_PENDING de series queda protegido y no entra en el orchestrator masivo.

## COMPLETE

Terminal mientras no cambie el contexto (ratings caducados, Plex/file fingerprint, fórmula, referencia de serie, etc.). Si un cambio externo provoca un nuevo bloqueo, Lifecycle lo moverá al estado correspondiente.

## EXCLUDED

Terminal manual. Nunca entra en procesos automáticos.

## Política anti-bucle

Cada `entidad + proceso Lifecycle` debe conservar:
- `attempt_count`
- `last_attempt_at`
- `last_outcome`
- `next_retry_at`
- `context_signature`
- `manual_review`
- `last_job_id`
- resumen/evidencia del último intento

Selección de lote:
- por defecto: solo nunca intentados o cuyo contexto cambió;
- errores técnicos pueden reintentarse según backoff;
- no encontrados/sin cambios no reentran automáticamente en el siguiente lote;
- el usuario puede incluir explícitamente `errores`, `no resueltos` o `todos`;
- tras varios intentos sin progreso, mover a revisión manual.

## Observabilidad obligatoria

Cada step debe guardar como mínimo:
`step_key`, `source`, `status`, `attempted`, `found`, `changed`, `before`, `after`, `reason`, `duration_ms`, `error`.

Cada job debe guardar:
- Lifecycle antes/después;
- outcome funcional;
- campos modificados;
- datos todavía faltantes;
- pasos ejecutados/omitidos;
- motivo de revisión manual si aplica.
