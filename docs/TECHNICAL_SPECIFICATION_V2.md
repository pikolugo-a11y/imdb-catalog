# PikoFilm — Especificación técnica canónica

**Versión documental:** Lifecycle + PikoScore 2.0  
**Fecha:** 23/08/2026  
**Repositorio:** `pikolugo-a11y/imdb-catalog`

## 1. Arquitectura general

PikoFilm es una aplicación Next.js App Router desplegada en Vercel y respaldada por PostgreSQL Neon. La arquitectura separa explícitamente:

- **Catálogo editorial:** PostgreSQL/Neon.
- **Inventario físico:** Plex sincronizado a tablas locales.
- **Staging de entradas:** Novedades / `catalog_candidates`.
- **Estado operativo:** `catalog_lifecycle` materializado.
- **Datos derivados:** identidad, series, validación física, PikoQuality, sagas.
- **Observabilidad:** `pipeline_runs`, `plex_sync_runs`, `admin_events`.

El frontal usa principalmente Server Components para lectura y Server Actions para operaciones. Abrir una pantalla no debe iniciar procesamiento masivo ni escrituras implícitas.

## 2. Stack

- Next.js `^15.5.0`.
- React / React DOM `^19.1.0`.
- `@neondatabase/serverless ^1.0.1`.
- Vercel como runtime web.
- Neon PostgreSQL como persistencia.
- Plex API como fuente física.
- TMDb API, OMDb API y FilmAffinity como fuentes externas principales de enriquecimiento/ratings.
- datasets públicos IMDb como fallback/discovery donde corresponda.
- GitHub Actions únicamente para CI y procesos manuales heredados/discovery explícito; no como scheduler permanente.

## 3. Configuración

Variables documentadas en `.env.example`:

- `DATABASE_URL`;
- `TMDB_API_TOKEN`;
- `OMDB_API_KEY`;
- `PLEX_TOKEN`;
- `PLEX_URL` opcional; si falta, se descubre el servidor mediante `plex.tv`.

Los secretos nunca deben persistirse en Neon, logs, documentación o navegador.

## 4. Rutas principales

| Ruta | Responsabilidad |
|---|---|
| `/` | dashboard |
| `/novedades` | única entrada Discovery/Plex/Manual |
| `/novedades/criterios` | configuración del discovery |
| `/catalogo` | consulta maestra del catálogo |
| `/catalogo/[imdbId]` | ficha película/serie |
| `/catalogo/excluidas` | archivo reversible |
| `/calidad` | mapa de colas lifecycle; solo lectura/navegación |
| `/calidad/identidad` | `IDENTITY_PENDING` |
| `/calidad/validacion-identidad` | validación/revisión de IDs |
| `/calidad/datos` | datos + PikoScore |
| `/calidad/peliculas` | validación física unitaria de películas |
| `/calidad/pikoquality` | PikoQuality unitario de películas |
| `/calidad/series` | referencia/diagnóstico unitario de series |
| `/calidad/series/[ratingKey]` | detalle episodio a episodio |
| `/sagas` / `/sagas/[id]` | colecciones |
| `/personas/[id]` | filmografía PikoFilm |
| `/admin` | trazabilidad |
| `/plex` | redirect legado a `/novedades?source=plex` |

## 5. Modelo de datos esencial

### 5.1 Catálogo
- `movies`: entidad editorial principal, ratings, PikoScore y fechas de frescura.
- `movie_metadata`: sinopsis, fechas y metadata extendida.
- `movie_genres`: géneros normalizados.
- `movie_credits`: reparto/equipo.
- `people`: personas TMDb.

### 5.2 Entrada y exclusión
- `catalog_candidates`: candidatos Discovery/Plex/Manual.
- `catalog_exclusions`: exclusión reversible por IMDb.
- `acquisition_status`: estado En proceso.

### 5.3 Plex
- `plex_items`: elementos activos/inactivos, `rating_key`, fingerprint, jerarquía.
- `plex_external_ids`: IMDb/TMDb/etc asociados por Plex.
- `plex_media`: resolución, codecs, bitrate y media-level data.
- `plex_files`: ruta, tamaño, duración y partes.
- `plex_catalog_status`: cruce Catálogo ↔ Plex.

### 5.4 Identidad
- tablas/estructuras de identidad y `identity_validation`: evidencia, score, estado y decisiones manuales.

### 5.5 Series
- `series_reference` y derivados de temporadas/episodios oficiales.
- `series_reference_episodes`.
- `series_season_availability`.
- vistas/derivados de `series_episode_effective_status`.

### 5.6 Validación física
- `movie_file_validation`: último fingerprint validado por `rating_key`.
- `movie_quality_findings`: incidencias duration/filename/duplicate/quality heredada donde aplique.

### 5.7 PikoQuality
- `piko_quality`: score técnico por `rating_key`, versión y `source_fingerprint`.
- `plex_streams`: streams cuando se materializan.
- `piko_quality_aggregates`: agregados de temporada/serie.

### 5.8 Lifecycle
- `catalog_lifecycle`: `imdb_id`, estado, estado anterior, bloqueo, fechas de cambio/cálculo.

### 5.9 Observabilidad
- `pipeline_runs`.
- `plex_sync_runs`.
- `admin_events`.

## 6. Lifecycle materializado

`lib/lifecycle.js` es el clasificador canónico.

### 6.1 Estados

`IDENTITY_PENDING`, `IDENTITY_VALIDATION`, `IDENTITY_REVIEW_REQUIRED`, `DATA_INCOMPLETE`, `PIKOSCORE_PENDING`, `MOVIE_FILE_PENDING`, `MOVIE_FILE_REVIEW`, `SERIES_SYNC_PENDING`, `SERIES_REVIEW`, `TECH_PENDING`, `TECH_REVIEW`, `COMPLETE`, `EXCLUDED`.

### 6.2 Prioridad de clasificación

1. exclusión;
2. IDs mínimos;
3. resultado de validación identidad;
4. datos obligatorios;
5. PikoScore vigente;
6. presencia Plex;
7. rama serie o película;
8. Complete.

### 6.3 Datos obligatorios

`dataComplete()` exige:
- título español;
- título original;
- año;
- tipo;
- IMDb rating/votos;
- FA rating/votos;
- TMDb rating/votos;
- runtime;
- país;
- al menos un género;
- sinopsis;
- poster TMDb o poster externo.

### 6.4 Materialización

`recomputeLifecycleForIds(ids)` calcula y hace UPSERT en `catalog_lifecycle`, conservando `previous_state` cuando cambia.

`getLifecycleForIds()` puede refrescar entradas ausentes/antiguas. La arquitectura objetivo debe evitar que grandes páginas provoquen miles de recalculados; por ello las pantallas operativas pesadas leen el snapshot materializado.

`reconcileLifecycleBatch()` existe para mantenimiento/backfill explícito, no como operación de render.

## 7. Novedades

`lib/news-v1.js` y `app/novedades/actions.js` gestionan candidatos, anti-join contra Catálogo/Exclusiones, cooldown y acciones.

El origen es un atributo de la misma cola, no una tabla/pantalla distinta.

### 7.1 Plex → Novedades

`syncPlexFast()` mantiene el inventario. `seedPlexNewsCandidates()` detecta elementos físicos aún no catalogados y los lleva a Novedades. Si falta IMDb se mantiene la fila Plex identificable por `rating_key`; `savePlexIdentityAction` permite introducir IMDb y encadenar la misma ruta común.

### 7.2 Discovery

`.github/workflows/imdb-discovery.yml` se inicia mediante `workflow_dispatch`. No hay `schedule`. El worker consume datasets IMDb en streaming y aplica los criterios configurados.

## 8. Identidad

La etapa de identidad es exclusivamente unitaria en el flujo canónico.

- `lib/identity.js` concentra resolución/corrección.
- `/calidad/identidad` filtra solo `IDENTITY_PENDING`.
- la edición manual puede cambiar IMDb/TMDb/FA.

Cambiar un ID debe invalidar evidencia derivada y forzar revalidación. En series puede invalidar referencias oficiales previas.

## 9. Validación de identidad

La evidencia compara campos equivalentes de IMDb/TMDb/FA, especialmente título original y año. El score determina valid/doubtful/invalid; el umbral funcional de salida automática es 85.

Las decisiones manuales se persisten y deben prevalecer hasta que el usuario las retire o cambie la identidad.

## 10. Actualización de datos

`lib/data-quality-unitary.js` es la ruta unitaria de ficha completa. Su objetivo es completar solo los campos requeridos/útiles, no almacenar respuestas brutas.

Fuentes preferidas:
- TMDb API para metadata estructurada;
- OMDb para datos IMDb y señales externas disponibles;
- IMDb dataset como fallback cuando corresponda;
- FilmAffinity mediante extractor compartido.

El resultado incluye por fuente éxito/error y campos modificados. La Server Action recalcula lifecycle al terminar.

## 11. Refresco ligero de ratings

`lib/ratings-refresh.js` separa ratings de metadata.

### 11.1 TMDb
Consulta endpoint movie/tv por `tmdb_id`, guarda `vote_average` y `vote_count`.

### 11.2 OMDb
Consulta por IMDb. Guarda:
- `imdb_rating`;
- `imdb_votes`;
- `rotten_tomatoes_score` si existe;
- `metacritic_score` si existe.

### 11.3 IMDb fallback
Solo se ejecuta si OMDb falla. `ensureImdbRating()` intenta recuperar rating/votos desde el mecanismo IMDb disponible.

### 11.4 FilmAffinity
`fetchFilmAffinityRating(fa_id)` es el extractor compartido. Prueba ficha principal y fallback de reseñas; soporta JSON-LD y extracción de texto visible. Solo se persisten rating/votos y metadatos escalares de diagnóstico, no HTML/JSON bruto.

### 11.5 Verificación
`ratings_refreshed_at` solo avanza si se verifican TMDb + FA + (OMDb o IMDb fallback).

## 12. PikoScore 2.0

`lib/pikoscore.js`; versión `2.0.0`.

### 12.1 Shrinkage bayesiano

Por fuente:

`adjusted = (votes * rating + m * prior) / (votes + m)`

`m = mediana_votos_contexto * factor_antigüedad`

`confidence = votes / (votes + m)`

Esto evita que ratings con muy pocos votos dominen el resultado.

### 12.2 Parámetros no españoles

Priors:
- IMDb 6.54
- FA 5.72
- TMDb 6.63

Medianas de votos:
- IMDb 21.969
- FA 2.340
- TMDb 490

Pesos:
- IMDb 0.40
- FA 0.35
- TMDb 0.25

### 12.3 Parámetros españoles

Priors:
- IMDb 5.72
- FA 5.12
- TMDb 5.91

Medianas:
- IMDb 807
- FA 2.160
- TMDb 39

Pesos:
- IMDb 0.30
- FA 0.45
- TMDb 0.25

La corrección España se produce por distribución/confianza y pesos, no mediante suma fija de puntos.

### 12.4 Factor edad

- <= 3 meses: 0.25
- <= 1 año: 0.35
- <= 3 años: 0.55
- <= 10 años: 0.8
- >10 años: 1

### 12.5 Críticos

Metacritic y RT se transforman en señales centradas en 60 y generan un modificador combinado limitado a `[-0.35,+0.35]`.

### 12.6 Confianza final

Combina confianza ponderada de votos con un factor de consenso calculado desde la dispersión entre ratings ajustados.

### 12.7 Persistencia

En `movies`:
- `final_rating`;
- `pikoscore_calculated_at`;
- `pikoscore_version`;
- `pikoscore_confidence`;
- votos de las tres fuentes usados en el cálculo;
- `pikoscore_critics_modifier`.

### 12.8 Caducidad

`freshnessDays()`:
- <3 meses 14 días;
- <1 año 30;
- <3 años 90;
- <10 años 180;
- resto 365.

`isPikoScoreDue()` devuelve pendiente si falta fecha, cambia versión, los ratings son posteriores al cálculo o vence la ventana temporal.

## 13. Plex y fingerprint

Cada `plex_item` activo tiene un fingerprint representativo de la versión física. Los controles técnicos comparan el fingerprint almacenado con el actual.

Consecuencia: sustituir un fichero invalida validación/PikoQuality sin obligar a repetir identidad/datos/PikoScore si siguen vigentes.

## 14. Validación de película

`lib/movie-file-validation.js` es la ruta operativa canónica y unitaria.

### 14.1 Duración
Compara `duration_ms` Plex con `movies.runtime`. Solo crea finding si supera simultáneamente el umbral absoluto y relativo configurado.

### 14.2 Filename
Normaliza ruta/nombre retirando tokens típicos de release (resolución, codec, HDR, WEB-DL, BluRay, etc.). Calcula similitud contra títulos conocidos. El año incompatible incrementa riesgo.

### 14.3 Varias versiones
Más de un elemento físico activo asociado al mismo IMDb genera finding de posible duplicado/montaje.

### 14.4 Persistencia

`movie_file_validation` guarda `rating_key`, `imdb_id`, `source_fingerprint`, `checked_at` y status.

`movie_quality_findings` guarda findings activos/resueltos/excepciones.

La operación recalcula lifecycle y audita inicio/fin. El análisis masivo antiguo ya no tiene entrada desde `/calidad`.

## 15. PikoQuality unitario de películas

`lib/pikoquality-unitary.js`.

Precondición: `movie_file_validation` debe estar `checked` y con fingerprint actual.

Proceso:
1. localizar archivo físico por IMDb;
2. comprobar precondición;
3. descubrir/usar Plex remoto;
4. pedir `/library/metadata/{ratingKey}`;
5. seleccionar streams de vídeo/audio relevantes;
6. calcular `scoreMovie()`;
7. UPSERT `piko_quality` con `QUALITY_VERSION`, fingerprint, score/band/confidence;
8. recalcular lifecycle;
9. auditar.

Un éxito puede pasar a `COMPLETE` en la misma transacción lógica; no hay segundo botón.

La API batch `/api/pikoquality/run` y `PikoQualityRunner.js` fueron retirados. El frontal operativo usa exclusivamente `analyzeOnePikoQualityAction`.

## 16. Motor PikoQuality

`lib/pikoquality.js`, `QUALITY_VERSION='1.0.0'`.

`scoreMovie()` combina:
- resolución;
- bitrate relativo al objetivo por codec/resolución;
- eficiencia codec;
- profundidad de bits;
- HDR/dynamic range;
- codec y canales de audio;
- bitrate audio;
- integridad básica (tamaño/duración/rating key);
- metadatos técnicos adicionales.

`lib/pikoquality.js` conserva las primitivas compartidas de scoring y compatibilidad necesaria mientras se completa la limpieza de pilotos/legado. Los runners batch ya no forman parte del flujo operativo normal.

## 17. Series

La referencia oficial se construye a partir de fuentes externas y se cruza con la jerarquía Plex.

`lib/series-unitary.js` es la ruta operativa canónica para crear o refrescar una serie. La acción trabaja sobre un único `imdb_id`/`rating_key`, reutiliza `reconcileSeriesReferencesFromPlex()`, consulta TMDb para esa serie y sus temporadas, actualiza `series_reference`, `series_reference_episodes` y `series_season_availability`, recalcula Lifecycle y audita el resultado.

`/calidad/series` no ofrece actualización masiva: cada fila tiene su propia acción `Crear referencia` o `Refrescar serie`.

Estados efectivos de episodio:
- `present`;
- `missing_actionable`;
- `availability_unknown`;
- `not_available_es`.

La disponibilidad España impide considerar automáticamente faltante cualquier episodio técnicamente ausente.

Los agregados PikoQuality de temporada/serie se almacenan en `piko_quality_aggregates`.

El workflow histórico `series-full-refresh.yml` y su worker permanecen temporalmente como legado sin consumidor desde el frontal; su retirada corresponde a M19/M27 del roadmap de migración.

## 18. Exclusión

`excludeTitle` hace UPSERT en `catalog_exclusions`, limpia `acquisition_status`, resuelve findings físicos activos aplicables, audita y revalida rutas.

No elimina `plex_items` ni ficheros físicos.

La clasificación lifecycle comprueba exclusión en primer lugar.

## 19. Reset “Ya la corregí”

En la validación física, esta acción representa una modificación externa de archivo/referencia. Debe retirar las asociaciones catalogadas/derivadas necesarias pero conservar el inventario Plex, para que la próxima sincronización detecte el elemento como nuevo candidato y lo envíe a Novedades.

## 20. Sagas y Personas

Sagas consumen colecciones/relaciones derivadas y cruzan presencia Plex sin incluir excluidos.

Personas consumen `people` + `movie_credits` y muestran filmografía dentro del universo PikoFilm.

## 21. Observabilidad

### `pipeline_runs`
Procesos de mayor entidad: tipo, fuente, estado, inicio/fin, procesados, añadidos, actualizados, omitidos, errores y summary JSON.

### `admin_events`
Acciones unitarias: fuente, entidad, acción y payload técnico acotado.

### Retención actual
Tras mantenimiento manual se conservaron los últimos 1.000 `admin_events` y 1.000 `pipeline_runs`. La retención automática está pendiente.

## 22. Rendimiento y coste

Reglas:
1. no hacer writes masivos al renderizar;
2. usar `catalog_lifecycle` materializado en colas grandes;
3. paginar las tablas;
4. preferir agregación SQL frente a cargar decenas de miles de filas en Node;
5. reutilizar datos frescos antes de llamar APIs;
6. no almacenar payloads brutos de APIs;
7. separar refresco de ratings de metadata completa;
8. usar fingerprints para invalidación selectiva;
9. minimizar transferencia Neon → Vercel y almacenamiento regenerable, según `INFRASTRUCTURE_EFFICIENCY.md`.

El incidente de PikoQuality que cargaba ~69k elementos y recalculaba lifecycle durante render se considera regresión a impedir.

## 23. Capacidad Neon

La instalación usa Neon de pago con 500 GB de transferencia pública incluidos por proyecto. El coste variable debe mantenerse controlado mediante la política `INFRASTRUCTURE_EFFICIENCY.md`.

Zonas de crecimiento a vigilar:
- `movie_credits` e índices;
- tablas Plex;
- referencia de episodios;
- `piko_quality`;
- diagnósticos de series;
- históricos de auditoría.

`catalog_candidates.source_snapshot` se vació para candidatos ya catalogados porque el snapshot dejó de ser necesario.

## 24. Seguridad

- credenciales únicamente server-side;
- no exponer tokens en componentes cliente;
- `PLEX_TOKEN`, TMDb/OMDb y DB solo en entorno;
- GitHub discovery mediante secreto server-side;
- no realizar commits desde workflows operativos;
- no ejecutar procesos no acotados automáticamente.

## 25. GitHub Actions

Automático vigente:
- **CI de Pull Request**: instalación, validación y build; lectura; cancelación por concurrencia.

Workflows manuales existentes incluyen discovery y varios procesos heredados de identidad/series/ratings/mantenimiento. No existe cron/schedule activo. Los workflows masivos obsoletos deben retirarse según roadmap de migración.

## 26. Deployment

`main` es la rama preparada para producción, pero Git no debe desplegar automáticamente. El usuario realiza deployment manual en Vercel cuando decide agrupar cambios.

Flujo de desarrollo:
`rama → cambios → PR → CI → merge main → deployment manual usuario → prueba usuario`.

## 27. Compatibilidad y legado

La portada de Calidad y sus ramas operativas de película/PikoQuality/Series ya son unitarias. Aún existen workflows, workers, APIs, pilotos y componentes heredados fuera de ese camino normal; se inventarían y eliminan gradualmente mediante `ROADMAP_MIGRATION.md`, verificando consumidores antes de borrar.

## 28. Regresiones técnicas esenciales

1. una página de listado no escribe lifecycle masivamente al abrirse;
2. `Calcular PikoScore` no llama APIs;
3. `Actualizar notas` no descarga metadata completa;
4. FA utiliza el extractor robusto compartido;
5. cambiar fingerprint invalida validación/PikoQuality física;
6. PikoQuality unitario recalcula lifecycle en la misma acción;
7. una película sin Plex puede ser Complete sin PikoQuality;
8. una película con Plex no puede ser Complete sin validación física + PQ actuales;
9. excluidos no entran en colas;
10. series Plex inactivas no contaminan diagnósticos;
11. una identidad editada invalida derivados apropiados;
12. toda operación unitaria relevante aparece en Admin;
13. `/calidad` no contiene botones masivos ni polling de procesos batch;
14. refrescar Series afecta solo a la serie seleccionada.

## 29. Gobernanza documental

Esta especificación y `FUNCTIONAL_SPECIFICATION_V2.md` son las fuentes canónicas actuales. La política transversal de eficiencia está en `INFRASTRUCTURE_EFFICIENCY.md`. Los documentos históricos son recuperables desde Git y no gobiernan el comportamiento actual.
