# PikoFilm V2 — Documento técnico

**Estado:** baseline técnica viva + evolución UX V3 en curso · 20/08/2026  
**Repositorio:** `pikolugo-a11y/imdb-catalog`

> Funcional, técnico y bitácora deben actualizarse antes de deployment. Producción la despliega manualmente el usuario y la aceptación funcional/visual la ejecuta el usuario.

## 1. Arquitectura
Next.js App Router en Vercel + PostgreSQL Neon. Server Components/Server Actions para web; workers GitHub Actions para batch largo. Separación canónica: fuente física Plex, catálogo editorial, staging de candidatos, exclusiones y datos derivados.

## 2. Rutas
- `/`, `/catalogo`, `/catalogo/[imdbId]`, `/catalogo/excluidas`.
- `/novedades`, `/novedades/[imdbId]`, `/novedades/criterios`.
- `/plex`, `/calidad/*`, `/sagas/*`, `/personas/*`, `/admin`.

## 3. Servicios
- `lib/db.js`: Neon.
- `lib/queries.js`, `lib/operational-queries.js`: lecturas.
- `lib/plex-sync.js`, `lib/plex-queries-v2.js`: Plex.
- `lib/enrich-title.js`: enriquecedor individual canónico.
- `lib/imdb-rating-on-demand.js`: rating/votos IMDb puntual.
- `lib/news-v1.js`: Novedades, stats, cooldown, override de aceptación y candidatos.
- `lib/identity.js`, `lib/quality-v2.js`, `lib/series-v2.js`, `lib/sagas-v2.js`, `lib/dashboard-v2.js`.
- `lib/runlog.js`: observabilidad.

## 4. Fuentes de verdad
- catálogo: `movies` + `catalog_read_model`;
- Plex: `plex_items.active`, `plex_external_ids`, `plex_media`, `plex_files`;
- exclusión: `catalog_exclusions`;
- candidatos: `catalog_candidates`;
- configuración discovery: `app_settings.imdb_discovery_v1`;
- override de aceptación discovery: `app_settings.imdb_discovery_test_override`;
- series: `series_reference*`, `series_season_availability`;
- procesos: `pipeline_runs`.

`admin_job_requests` queda como histórico/infra heredada: Novedades no crea solicitudes discovery `pending` y no existe polling que las recoja.

## 5. Plex / Mi Biblioteca
`plex-sync.js` mantiene inventario físico e invalida referencias de Series cuando cambia identidad. Shows `active=false` quedan fuera de Calidad/KPIs sin necesidad de borrar histórico.

`/plex` se implementa como bandeja operativa Plex → Catálogo. `getPlexLibrary(..., mode='uncatalogued')` cruza `plex_items` + `plex_external_ids` + `movies`; las filas visibles son elementos Plex activos cuyo IMDb no tiene fila en `movies`. `getPlexSummary()` conserva el agregado `in_catalog/outside_catalog` para contexto, pero los ya catalogados no se listan como universo operativo.

La tabla usa directamente `plex_title`, `plex_year`, `item_type`, `added_at`, `rating_key` e IMDb de `plex_external_ids`. También expone `movies.original_title` cuando existe; en pendientes puros normalmente será nulo hasta que haya metadata catalogada, por lo que la UI no inventa un título original. No existe ficha intermedia de Plex. Con IMDb se reutiliza `EnrichTitleButton`; sin IMDb se deriva a Calidad/Identidad. La columna de estado normal se elimina y solo las excepciones se expresan visualmente. Tras una catalogación correcta, la siguiente revalidación/lectura deja de cumplir el anti-join y la fila desaparece.

`added_at` se presenta explícitamente como **Añadido a Plex**, no como fecha de detección del sincronizador. `PlexSyncButton` permanece junto al último `plex_sync_runs.finished_at` exitoso.

### Alta parcial desde Plex
`app/actions.js::processTitle()` aplica el mismo contrato funcional de alta parcial usado por Novedades sin crear una fuente nueva ni una tabla paralela. Antes de enriquecer, si el IMDb todavía no existe en `movies`, obtiene de Plex la identidad mínima (`rating_key`, `plex_title`, `plex_year`, `item_type`) y crea una fila staging en `movies` con origen/inclusion `plex_manual`.

Después ejecuta `ensureImdbRating()` best-effort y el enriquecedor canónico `enrichTitle()`. Si el enriquecimiento termina bien, elimina el flag `staging`. Si falla una fuente secundaria (por ejemplo `TMDb no encontró el título`) pero existía identidad mínima Plex/IMDb, conserva la fila, elimina `staging`, marca `source_status.partial=true`, `enrichment_status='pending'`, `tmdb='missing'`, guarda el error y finaliza `pipeline_runs` como éxito parcial con `errors=1`. La UI devuelve éxito parcial para que la fila desaparezca de Mi Biblioteca y Calidad/Identidad la detecte mediante `m.tmdb_id IS NULL`.

Si no existe identidad mínima fiable, se elimina únicamente la fila staging y el run termina como fallo. Los reintentos posteriores se realizan desde Calidad/Identidad mediante el mismo `enrichTitle()` canónico.

## 6. Enriquecimiento y alta parcial
`lib/enrich-title.js` continúa siendo el único enriquecedor. Catalogación y enriquecimiento son separables: con identidad mínima fiable, fallos secundarios dejan alta parcial diagnosticable en Calidad en lugar de destruir el registro.

## 7. Novedades
`lib/news-v1.js` realiza anti-join de catálogo/exclusiones, filtros, stats y cooldown. La UX operativa es compacta y el discovery se inicia manualmente desde el frontal mediante Server Action server-side.

## 8. Candidatos manuales/exclusión
Las acciones de Novedades validan IMDb, impiden duplicados y reutilizan `catalog_exclusions`. Retirar un manual no equivale a excluir.

## 9. Discovery IMDb seguro
`.github/workflows/imdb-discovery.yml` usa `workflow_dispatch`; no existe `schedule`. El worker mantiene guard semanal y la credencial GitHub es server-only.

## 10. Calidad
Calidad Películas usa datos persistidos Plex/catálogo. Calidad Identidad es el destino de altas parciales y de elementos Plex sin IMDb. Excluidos se filtran.

## 11. Series
`series-v2.js` usa TMDb, referencia/disponibilidad ES y solo shows Plex activos/no excluidos. Cambios de identidad invalidan derivados para reconstrucción posterior.

## 12. Sagas / Dashboard / Admin
Sagas mantiene cobertura sin excluidos. Dashboard ignora shows inactivos. `pipeline_runs` mantiene trazabilidad de procesos relevantes.

## 13. Seguridad
Secretos solo en variables de entorno. Sin scraping IMDb. Tokens nunca se persisten en GitHub/Neon/logs.

## 14. CI/CD y aceptación
Antes de deployment: revisar consistencia de `main`. ChatGPT no despliega producción. El usuario ejecuta deployment manual en Vercel y realiza todas las pruebas funcionales/visuales. No se considera aceptado antes del PASS explícito.

## 15. Dependencias
`Plex Sync → plex_items/IDs → Mi Biblioteca pendientes → processTitle staging mínimo → enrichTitle → Catálogo → Calidad si parcial`

`PikoFilm Server Action → GitHub workflow_dispatch → IMDb Discovery → catalog_candidates → Novedades`

`Procesos → pipeline_runs → Admin`

## 16. Regresiones obligatorias
- Castle: referencia antigua invalidada tras cambio de identidad.
- Love is in the Air: inactiva fuera de Calidad/KPIs.
- First Lady: IMDb on-demand conserva TMDb.
- `tt5901280` (The River): TMDb ausente desde Mi Biblioteca → alta parcial conservada, fila desaparece de `/plex`, aparece en Calidad/Identidad y queda traza `plex_catalogue_partial`.
- Novedades: catálogo/excluidos no reaparecen.
- Discovery: sin cron/polling y cooldown semanal.
- Mi Biblioteca: solo activos no catalogados; sin IMDb deriva a Identidad; alta correcta elimina la fila; `added_at` se etiqueta correctamente; no existe estado normal redundante.
