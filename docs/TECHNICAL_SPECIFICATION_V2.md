# PikoFilm V2 — Documento técnico

**Estado:** baseline técnica viva ampliada con Novedades V1 · 19/08/2026  
**Repositorio:** `pikolugo-a11y/imdb-catalog`

> Regla de mantenimiento: esta especificación técnica y la funcional deben actualizarse antes de cada fusión/despliegue que cambie comportamiento, arquitectura, fuentes de verdad o flujos operativos.

## 1. Arquitectura general
PikoFilm es una aplicación Next.js desplegada en Vercel con PostgreSQL en Neon. Usa App Router, Server Components y Server Actions. La lógica de dominio reside principalmente en `lib/`; los trabajos batch largos se ejecutan con GitHub Actions/workers para evitar depender de timeouts HTTP.

Flujo principal:
`Browser → Next.js/Vercel → lib/* → Neon PostgreSQL`

Integraciones:
- `Plex → plex-sync → plex_* → read models/diagnósticos`
- `IMDb/FA/TMDb/Wikidata → enrich-title → catálogo/identidad/sagas`
- `TMDb TV → series-v2 → referencia de episodios + disponibilidad ES`
- `IMDb datasets → imdb-discovery worker → catalog_candidates → Novedades`
- `IMDb title.ratings.tsv.gz → helper on-demand → enriquecimiento individual cuando falta rating local`

La regla arquitectónica es separar datos fuente, estado editorial, staging/candidatos y datos derivados.

## 2. Rutas principales
- `/` Dashboard.
- `/catalogo`, `/catalogo/[imdbId]`, `/catalogo/excluidas`.
- `/novedades`, `/novedades/criterios`.
- `/plex`.
- `/calidad`, `/calidad/peliculas`, `/calidad/identidad`, `/calidad/series`, `/calidad/series/[ratingKey]`.
- `/sagas`, `/sagas/[name]`.
- `/personas/[id]`.
- `/admin`.

`app/actions.js` concentra acciones globales; `app/novedades/actions.js` concentra mutaciones específicas de Novedades.

## 3. Servicios principales
- `lib/db.js`: cliente Neon.
- `lib/queries.js`: lecturas generales.
- `lib/operational-queries.js`: consultas operativas V2.
- `lib/plex-queries-v2.js`: Biblioteca Plex paginada.
- `lib/plex-sync.js`: sincronización Plex e invalidación de referencias derivadas.
- `lib/enrich-title.js`: enriquecimiento individual canónico.
- `lib/imdb-rating-on-demand.js`: hidratación puntual de rating/votos IMDb desde dataset oficial.
- `lib/news-v1.js`: lectura/configuración de Novedades.
- `lib/identity.js`: diagnóstico/persistencia de identidad.
- `lib/quality-v2.js`: Calidad Películas.
- `lib/series-v2.js`: Series V2.
- `lib/sagas-v2.js`: Sagas.
- `lib/dashboard-v2.js`: Dashboard/snapshots.
- `lib/admin-queries-v2.js`: Admin.
- `lib/runlog.js`: logging transversal.

## 4. Persistencia y fuentes de verdad
### 4.1 Catálogo
`movies` y `catalog_read_model` representan el universo editorial. IMDb ID es identificador canónico central en el pipeline de títulos.

### 4.2 Plex
`plex_items` contiene inventario físico y estado `active`. `plex_external_ids` contiene IMDb/TMDb/TVDb/otros IDs. `plex_media` y `plex_files` contienen propiedades técnicas.

### 4.3 Exclusiones
`catalog_exclusions` es la única fuente canónica de exclusión reversible. Novedades, Calidad, Series, Sagas y Dashboard deben anti-join esta tabla cuando corresponda.

### 4.4 Candidatos
`catalog_candidates` es el staging canónico de Novedades. Almacena IMDb ID, tipo, año, rating, votos, elegibilidad, timestamps y `source_snapshot`. No debe crearse una segunda tabla paralela con la misma responsabilidad.

### 4.5 Configuración
`app_settings` almacena configuración versionable de discovery (`imdb_discovery_v1`): umbrales generales/españoles y países excluidos.

### 4.6 Cola de jobs
`admin_job_requests` permite solicitar desde la web trabajos largos como `imdb_discovery` sin ejecutar el batch en la petición Vercel.

### 4.7 Series
`series_reference`, `series_reference_episodes` y `series_season_availability` forman la referencia derivada. Solo shows activos en Plex participan en lecturas/refrescos operativos.

### 4.8 Procesos
`pipeline_runs` registra job type, source, estado, contadores, timings y `summary` JSON.

## 5. Sincronización Plex
`plex-sync.js` es propietario de cambios físicos y de identidad provenientes de Plex. Detecta altas/cambios/bajas y marca inactivos los títulos que desaparecen.

En Series, si cambia IMDb/TMDb/TVDb del show, Plex Sync invalida la referencia derivada anterior. `series-v2` reconstruye después. Esta separación evita duplicar lógica y previene soluciones locales inconsistentes.

Un show `active=false` no puede aparecer en Calidad Series ni alimentar KPIs aunque `series_reference` permanezca por histórico. Caso de regresión: `Love is in the Air`.

## 6. Enriquecimiento individual
`lib/enrich-title.js` es el único pipeline canónico de alta/actualización detallada. Resuelve identidad fuente, IMDb local, Wikidata/FilmAffinity, TMDb, PikoScore, metadatos, arte, géneros, reparto y colección/saga.

Las correcciones manuales de IDs tienen precedencia mediante `COALESCE`/lógica de preservación. El pipeline no debe borrar un ID manual válido porque una resolución automática falle.

### 6.1 IMDb rating/votos on-demand
Problema resuelto por #40: un título recién añadido desde Plex puede tener IMDb ID correcto pero todavía no haber sido incluido en el último refresco batch local de ratings.

`lib/imdb-rating-on-demand.js` implementa dos funciones:
- `imdbRatingFromOfficialDataset(imdbId,{timeoutMs})`: descarga `title.ratings.tsv.gz`, descomprime en streaming, recorre líneas hasta localizar el `tt...` y retorna rating/votos. No hace scraping web.
- `ensureImdbRating(imdbId,{timeoutMs})`: primero consulta `movies` y `catalog_candidates`; solo si faltan datos usa el dataset oficial y persiste el resultado en ambos dominios cuando corresponda.

`app/actions.js::processTitle()` llama `ensureImdbRating()` antes de `enrichTitle()`. El timeout puntual es acotado (12 s). Si el dataset no contiene el ID o expira, se continúa con TMDb/FA y `imdb_status=pending_dataset`; un fallo IMDb nunca invalida datos TMDb válidos.

Esto complementa, no sustituye, al worker batch diario `worker/update-imdb-ratings.mjs`.

Caso de regresión: `First Lady`, IMDb `tt15787006`, TMDb `158808`.

## 7. Novedades V1
### 7.1 Lectura/UI
`lib/news-v1.js` consulta `catalog_candidates` con anti-joins contra `movies` y `catalog_exclusions`, paginación y filtros. `/novedades` no realiza llamadas externas durante render normal.

### 7.2 Configuración
`/novedades/criterios` edita `app_settings.imdb_discovery_v1`. Valores iniciales:
- movie general 6.0 / 10.000 votos;
- movie ES 6.0 / 7.500;
- series general 7.0 / 5.000;
- series ES 6.5 / 4.000;
- India excluida inicialmente (`Q668`/`IN`).

La versión de configuración se incrementa y se guarda en snapshots/runs.

### 7.3 Alta manual
`addManualCandidateAction()` valida `tt...`, impide duplicar catálogo, respeta exclusiones y crea/activa candidato manual. Los manuales se protegen frente a recalculación automática usando flags en `source_snapshot` (`manual`, `manualActive`, `matchedRule`).

Si el título está excluido se exige `restoreAndAddManualAction()`; nunca se restaura silenciosamente.

### 7.4 Excluir/retirar
`excludeNewsCandidateAction()` reutiliza `catalog_exclusions`. `removeManualCandidateAction()` desactiva el candidato manual sin convertirlo en exclusión global.

### 7.5 Incorporar al catálogo
`enrichNewsCandidateAction()` reutiliza `enrichTitle()`. Se crea un staging mínimo en `movies` para satisfacer el contrato del pipeline; si el enriquecimiento falla, ese staging se elimina y el candidato vuelve a `eligible`. En éxito queda `catalogued` y el anti-join hace que desaparezca de Novedades.

No se crea un segundo enriquecedor.

## 8. Worker IMDb discovery
`worker/imdb-discovery.mjs` ejecuta el discovery sin scraping.

### 8.1 Fase ratings
Stream de `title.ratings.tsv.gz`. Se conserva en memoria solo el subconjunto que alcanza el mínimo absoluto de alguna regla activa.

### 8.2 Fase basics
Stream de `title.basics.tsv.gz`. Solo se procesan IDs preseleccionados; se filtran tipos `movie`, `tvSeries`, `tvMiniSeries`, adultos y demás criterios.

### 8.3 Regla general y zona España
Si cumple regla general no necesita nacionalidad para elegibilidad. Si solo cumple la zona española, se resuelve país selectivamente.

### 8.4 Resolución de país
Primero reutiliza país cacheado en `source_snapshot`; después intenta Wikidata batch y, si sigue sin resolverse, TMDb con concurrencia acotada. España se reconoce por `ES`/`Q29`. India se rechaza mientras figure en configuración global.

### 8.5 Persistencia
Upserts por lotes en `catalog_candidates`. Se guardan `matchedRule`, versión de reglas, países, estado de país, datasets y fecha de discovery. Los manuales activos no son pisados por el batch.

### 8.6 Invalidación
Candidatos automáticos que dejan de cumplir pasan a `not_eligible`; no se borran. Excluidos y catalogados nunca reaparecen por el anti-join.

## 9. GitHub Actions / ejecución batch
`.github/workflows/imdb-discovery.yml` ejecuta el worker de forma programada y manual. La web puede crear una fila `admin_job_requests`; el worker reclama solicitudes pendientes (`FOR UPDATE SKIP LOCKED`) y registra resultado.

`.github/workflows/imdb-ratings-refresh.yml` usa ya código de `main`, no una rama experimental, y actualiza ratings masivos de `movies`/`catalog_candidates`.

Los jobs están diseñados para ser idempotentes y reintentables.

## 10. Calidad Películas
`quality-v2.js` opera principalmente sobre datos persistidos de Plex/catálogo. Analiza duración, filename, duplicados y calidad técnica. Filtra excluidos y nunca borra archivos.

## 11. Series V2
`series-v2.js` usa TMDb con `cache:no-store`. Selecciona únicamente shows activos en Plex, no excluidos y con TMDb ID.

Procesa shows con concurrencia acotada y temporadas/episodios; upserta referencia y disponibilidad ES, preservando `manual_override`.

El cálculo de anomalías compara episodios Plex activos con la referencia oficial y detecta extras/no mapeados.

### 11.1 Timeout/observabilidad
#36 aumenta el margen de la acción de Series a 60 s y añade instrumentación de fases para medir selección, TMDb/refresco, anomalías y finalización. El objetivo es completar en el primer intento con el volumen actual y disponer de evidencia para futuras optimizaciones/desacoplamiento.

## 12. Sagas
`sagas-v2.js` mantiene colecciones/universos y cobertura derivada contra Plex. Exclusiones no deben contaminar cobertura.

## 13. Dashboard
`dashboard-v2.js` produce KPIs, histórico, distribuciones y cobertura por décadas. Los snapshots permiten evolución temporal. Los KPIs de series ignoran shows inactivos.

## 14. Biblioteca y rendimiento
`plex-queries-v2.js` pagina y filtra en SQL. Novedades aplica el mismo principio. No se descargan miles de filas para filtrar en navegador.

## 15. Admin y observabilidad
`runlog.js` normaliza el ciclo de vida de jobs. `Admin` debe permitir distinguir errores funcionales, timeouts y fallos de infraestructura.

Nuevos/actualizados jobs relevantes:
- `imdb_discovery`;
- `single_title` con estado IMDb completo/pendiente;
- `series_v2_refresh` con timings por fase.

## 16. Seguridad
`DATABASE_URL`, Plex token, `TMDB_API_TOKEN` y credenciales equivalentes viven solo en secretos/variables de entorno. No deben entrar en commits, UI ni trazas.

IMDb datasets se acceden con User-Agent de uso personal/no comercial y sin scraping de páginas IMDb.

## 17. CI/CD
El PR debe pasar `npm run build` y comprobaciones sintácticas de workers antes de fusionarse. Vercel despliega `main`; un merge no implica producción validada hasta que el deployment quede `READY`.

## 18. Consistencia / fuentes canónicas
- presencia física → `plex_items.active`;
- IDs Plex → `plex_external_ids`;
- catálogo editorial → `movies`/read model;
- exclusión → `catalog_exclusions`;
- candidatos → `catalog_candidates`;
- configuración discovery → `app_settings`;
- referencia series → `series_reference*`;
- disponibilidad ES → `series_season_availability`;
- histórico de procesos → `pipeline_runs`;
- solicitudes batch → `admin_job_requests`.

No deben crearse fuentes paralelas para solucionar bugs locales.

## 19. Dependencias
`Plex Sync → inventario/IDs → catálogo/sagas + invalidación Series`

`Series Refresh → TMDb reference/disponibilidad → diagnósticos`

`IMDb Discovery → catalog_candidates → Novedades`

`Novedades Add → enrichTitle → movies → desaparece de Novedades`

`Single-title update → ensureImdbRating → enrichTitle`

`IMDb ratings batch → movies + catalog_candidates`

`Procesos → pipeline_runs → Admin`

## 20. Regresiones obligatorias
- Castle: cambio de identidad Plex no deja referencia vieja activa.
- Love is in the Air: show inactivo no aparece en Calidad ni KPIs.
- First Lady `tt15787006`: actualización individual intenta hidratar IMDb desde dataset oficial y conserva TMDb `158808`.
- Novedades: catálogo y excluidos no reaparecen.
- India: permanece fuera mientras esté configurada como excluida.
- España: títulos en zona de rescate solo entran si se confirma participación española.
- Manuales: no desaparecen por fluctuación IMDb y no levantan exclusión silenciosamente.

## 21. Documentación especializada
`docs/NOVEDADES_V1_FUNCTIONAL.md` y `docs/NOVEDADES_V1_TECHNICAL.md` amplían el detalle del módulo. Este documento sigue siendo la referencia técnica global y debe actualizarse junto con la especificación funcional en cada cambio relevante.