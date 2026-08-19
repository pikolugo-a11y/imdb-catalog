# PikoFilm V2 — Documento técnico

**Estado:** baseline técnica viva ampliada con Novedades V1 · 19/08/2026  
**Repositorio:** `pikolugo-a11y/imdb-catalog`

> Regla de mantenimiento: esta especificación técnica y la funcional deben actualizarse antes de cada fusión/despliegue que cambie comportamiento, arquitectura, fuentes de verdad o flujos operativos.

## 1. Arquitectura general
PikoFilm es una aplicación Next.js desplegada en Vercel con PostgreSQL en Neon. Usa App Router, Server Components y Server Actions. La lógica de dominio reside principalmente en `lib/`; los trabajos batch largos se ejecutan con GitHub Actions/workers para evitar depender de timeouts HTTP.

Flujo principal: `Browser → Next.js/Vercel → lib/* → Neon PostgreSQL`.

La regla arquitectónica es separar datos fuente, estado editorial, staging/candidatos y datos derivados. La pertenencia al catálogo no debe depender de que todas las fuentes externas estén disponibles simultáneamente.

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
`movies` y `catalog_read_model` representan el universo editorial. IMDb ID es identificador canónico central en el pipeline de títulos. Una fila catalogada puede estar parcialmente enriquecida; la ausencia de IDs/metadatos secundarios debe ser observable por Calidad, no representarse borrando la fila.

### 4.2 Plex
`plex_items` contiene inventario físico y estado `active`. `plex_external_ids` contiene IMDb/TMDb/TVDb/otros IDs. `plex_media` y `plex_files` contienen propiedades técnicas.

### 4.3 Exclusiones
`catalog_exclusions` es la única fuente canónica de exclusión reversible. Novedades, Calidad, Series, Sagas y Dashboard deben anti-join esta tabla cuando corresponda.

### 4.4 Candidatos
`catalog_candidates` es el staging canónico de Novedades. Almacena IMDb ID, tipo, año, rating, votos, elegibilidad, timestamps y `source_snapshot`. No debe crearse una segunda tabla paralela con la misma responsabilidad.

### 4.5 Configuración
`app_settings` almacena configuración versionable de discovery (`imdb_discovery_v1`).

### 4.6 Solicitudes históricas de jobs
`admin_job_requests` puede conservar trazabilidad histórica, pero discovery IMDb no depende de polling periódico.

### 4.7 Series
`series_reference`, `series_reference_episodes` y `series_season_availability` forman la referencia derivada. Solo shows activos en Plex participan en lecturas/refrescos operativos.

### 4.8 Procesos
`pipeline_runs` registra job type, source, estado, contadores, timings y `summary` JSON.

## 5. Sincronización Plex
`plex-sync.js` es propietario de cambios físicos y de identidad provenientes de Plex. Detecta altas/cambios/bajas y marca inactivos los títulos que desaparecen. Si cambia identidad de Series, invalida referencia derivada y `series-v2` reconstruye posteriormente.

Un show `active=false` no puede aparecer en Calidad Series ni alimentar KPIs. Caso de regresión: `Love is in the Air`.

## 6. Enriquecimiento individual
`lib/enrich-title.js` sigue siendo el único enriquecedor canónico. Resuelve lo que pueda de identidad, IMDb local, Wikidata/FilmAffinity, TMDb, PikoScore, metadatos, arte, géneros, reparto y colección/saga.

Las correcciones manuales de IDs tienen precedencia. El pipeline no debe borrar un ID manual válido porque una resolución automática falle.

### 6.1 Contrato de alta tolerante a enriquecimiento parcial (#43)
La capa que incorpora un título debe distinguir **fallo de identidad/integridad** de **fallo de enriquecimiento secundario**.

- Si no puede establecerse una identidad mínima fiable o existe riesgo de duplicidad/corrupción, la operación puede abortar.
- Si IMDb identifica suficientemente el título y ya existen metadatos mínimos persistibles, un fallo/no-match de TMDb, FilmAffinity/Wikidata, arte u otra fuente secundaria **no debe eliminar el staging ni revertir la catalogación**.
- Debe persistirse el título con los datos disponibles y un estado/diagnóstico que permita a Calidad detectar qué fuentes/campos faltan.
- El reintento posterior debe reutilizar `enrichTitle()` y completar la misma fila, nunca crear un duplicado.
- `pipeline_runs.summary` debe distinguir alta completa de alta parcial y enumerar fuentes/etapas pendientes cuando sea posible.

No se crea un segundo enriquecedor: la tolerancia debe implementarse alrededor/dentro del contrato canónico existente de forma reutilizable también para altas desde Plex cuando proceda.

### 6.2 IMDb rating/votos on-demand
`lib/imdb-rating-on-demand.js` hidrata puntualmente rating/votos desde `title.ratings.tsv.gz`. `app/actions.js::processTitle()` intenta `ensureImdbRating()` antes de `enrichTitle()`. Si IMDb dataset no contiene el ID o expira, se continúa con otras fuentes y `imdb_status=pending_dataset`. Caso de regresión: `First Lady`, `tt15787006`, TMDb `158808`.

## 7. Novedades V1
### 7.1 Lectura/UI
`lib/news-v1.js` consulta `catalog_candidates` con anti-joins contra `movies` y `catalog_exclusions`, paginación y filtros. `/novedades` no realiza llamadas externas durante render normal.

### 7.2 Configuración
`/novedades/criterios` edita `app_settings.imdb_discovery_v1`.

### 7.3 Alta manual
`addManualCandidateAction()` valida `tt...`, impide duplicar catálogo, respeta exclusiones y crea/activa candidato manual. Si está excluido exige restauración explícita.

### 7.4 Excluir/retirar
`excludeNewsCandidateAction()` reutiliza `catalog_exclusions`. `removeManualCandidateAction()` desactiva el candidato manual sin convertirlo en exclusión global.

### 7.5 Incorporar al catálogo
`enrichNewsCandidateAction()` reutiliza `enrichTitle()`. El staging mínimo en `movies` deja de considerarse puramente descartable cuando existe identidad mínima fiable: ante un fallo secundario como `TMDb no encontró el título`, debe conservarse/promoverse como título catalogado parcial, marcar el candidato `catalogued` y dejar que el anti-join lo retire de Novedades. Calidad debe detectar después los IDs/datos pendientes.

Solo se elimina/revierte el staging ante fallos de identidad mínima, duplicidad o integridad que hagan insegura la catalogación. Caso de regresión: `tt38268282`.

## 8. Worker IMDb discovery
`worker/imdb-discovery.mjs` ejecuta el discovery sin scraping, mediante streaming de datasets oficiales. Filtra ratings, cruza basics, resuelve país selectivamente y persiste por lotes en `catalog_candidates`. Los automáticos que dejan de cumplir pasan a `not_eligible`; no se borran.

Antes de descargar datasets, consulta la última ejecución `imdb_discovery` exitosa. Si no han pasado 7 días, registra `weekly_cooldown` y termina antes del trabajo pesado.

## 9. GitHub Actions / ejecución batch
`.github/workflows/imdb-discovery.yml` no contiene `schedule`: solo `workflow_dispatch`. No existe polling cada 5 minutos ni discovery diario automático. La guardia semanal vive también en el worker.

Los jobs deben ser idempotentes/reintentables sin ejecuciones frecuentes no solicitadas.

## 10. Calidad Películas / Identidad
`quality-v2.js` analiza calidad técnica y filtra excluidos. Calidad/Identidad debe ser además el destino operativo de títulos catalogados parcialmente: ausencia de TMDb/FA u otros campos esperables se muestra como dato pendiente, con posibilidad de reintento/edición según el mecanismo canónico existente. No se crea una lista paralela específica para #43 si la vista de Calidad ya puede representar el diagnóstico.

## 11. Series V2
`series-v2.js` usa TMDb con concurrencia acotada, temporadas/episodios y disponibilidad ES. Solo shows Plex activos, no excluidos y con TMDb ID participan. #36 amplía margen a 60 s e instrumenta fases.

## 12. Sagas
`sagas-v2.js` mantiene colecciones/universos y cobertura derivada contra Plex. Exclusiones no contaminan cobertura.

## 13. Dashboard
`dashboard-v2.js` produce KPIs, histórico, distribuciones y cobertura por décadas. Los KPIs de series ignoran shows inactivos.

## 14. Biblioteca y rendimiento
`plex-queries-v2.js` pagina y filtra en SQL. Novedades aplica el mismo principio.

## 15. Admin y observabilidad
`runlog.js` normaliza jobs. Admin debe distinguir errores funcionales, timeouts, cooldown y enriquecimientos parciales. Jobs relevantes: `imdb_discovery`, `single_title`, `series_v2_refresh`.

## 16. Seguridad
Secretos (`DATABASE_URL`, Plex token, `TMDB_API_TOKEN`, etc.) viven solo en variables de entorno. IMDb datasets se acceden sin scraping.

## 17. CI/CD
El PR debe pasar `npm run build` y comprobaciones sintácticas de workers antes de fusionarse. Los deployments de producción los realiza manualmente el usuario; ChatGPT verifica después el deployment y el usuario ejecuta las pruebas funcionales dirigidas.

## 18. Consistencia / fuentes canónicas
- presencia física → `plex_items.active`;
- IDs Plex → `plex_external_ids`;
- catálogo editorial → `movies`/read model;
- exclusión → `catalog_exclusions`;
- candidatos → `catalog_candidates`;
- configuración discovery → `app_settings`;
- referencia series → `series_reference*`;
- disponibilidad ES → `series_season_availability`;
- histórico de procesos → `pipeline_runs`.

No deben crearse fuentes paralelas para solucionar bugs locales.

## 19. Dependencias
`Plex Sync → inventario/IDs → catálogo/sagas + invalidación Series`

`Series Refresh → TMDb reference/disponibilidad → diagnósticos`

`IMDb Discovery manual (máximo semanal) → catalog_candidates → Novedades`

`Novedades Add → identidad mínima → movies → enrichTitle (best effort) → Calidad si parcial → desaparece de Novedades`

`Single-title update → ensureImdbRating → enrichTitle`

`Procesos → pipeline_runs → Admin`

## 20. Regresiones obligatorias
- Castle: cambio de identidad Plex no deja referencia vieja activa.
- Love is in the Air: show inactivo no aparece en Calidad ni KPIs.
- First Lady `tt15787006`: rating IMDb on-demand y TMDb `158808` conservado.
- Novedades: catálogo y excluidos no reaparecen.
- India permanece fuera mientras esté configurada.
- España: rescate solo con participación española confirmada.
- Manual excluido requiere restauración explícita.
- Discovery no tiene cron/polling y respeta cooldown semanal.
- `tt38268282`: ausencia de TMDb no bloquea catalogación; desaparece de Novedades y queda diagnosticado en Calidad como incompleto.