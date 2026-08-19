# PikoFilm V2 — Documento técnico

**Estado:** baseline técnica viva + Novedades V1; #41/#42/#43 preparadas · 19/08/2026  
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
- `lib/news-v1.js`: Novedades, stats, cooldown y candidatos.
- `lib/identity.js`, `lib/quality-v2.js`, `lib/series-v2.js`, `lib/sagas-v2.js`, `lib/dashboard-v2.js`.
- `lib/runlog.js`: observabilidad.

## 4. Fuentes de verdad
- catálogo: `movies` + `catalog_read_model`;
- Plex: `plex_items.active`, `plex_external_ids`, `plex_media`, `plex_files`;
- exclusión: `catalog_exclusions`;
- candidatos: `catalog_candidates`;
- configuración discovery: `app_settings.imdb_discovery_v1`;
- series: `series_reference*`, `series_season_availability`;
- procesos: `pipeline_runs`.

`admin_job_requests` queda como histórico/infra heredada: **Novedades ya no crea solicitudes discovery pending** y no existe polling que las recoja.

## 5. Plex
`plex-sync.js` mantiene inventario físico e invalida referencias de Series cuando cambia identidad. Shows `active=false` quedan fuera de Calidad/KPIs sin necesidad de borrar histórico. Regresión: `Love is in the Air`.

## 6. Enriquecimiento y alta parcial (#43)
`lib/enrich-title.js` continúa siendo el único enriquecedor. `app/novedades/actions.js::enrichNewsCandidateAction()` adapta un candidato al catálogo.

Contrato implementado:
1. Crea staging mínimo en `movies`.
2. Ejecuta `enrichTitle()`.
3. Si completa: elimina flag staging, marca candidato `catalogued`, run `success/stage=done`.
4. Si falla y existe identidad mínima fiable (`title !== imdbId` + `candidate_type` soportado): **no borra `movies`**; elimina staging y añade a `source_status` `partial=true`, `enrichment_status='pending'`, `last_enrichment_error`, `last_enrichment_at`; marca candidato `catalogued`; `pipeline_runs` termina `success` con `stage='partial'`, `errors=1` y error pendiente trazable.
5. Si no existe identidad mínima fiable: rollback del staging, candidato vuelve a `eligible`, run `failed/stage=failed_identity`.

Calidad/Identidad detecta los IDs/campos faltantes desde las fuentes canónicas; no se crea tabla paralela para #43. Reintentar usa la misma fila/`enrichTitle()`.

Regresión: `tt38268282` debe entrar parcial aunque TMDb no lo encuentre.

### IMDb on-demand
`ensureImdbRating()` usa `title.ratings.tsv.gz` en streaming cuando faltan rating/votos locales. Fallo/ausencia no invalida TMDb/FA. Regresión: `First Lady`.

## 7. Novedades — lectura y UX (#41)
`lib/news-v1.js::getNewsV1()`:
- anti-join `movies` + `catalog_exclusions`;
- filtros tipo/búsqueda/orden;
- pageSize permitido 24/48/96, default 24;
- stats de propuestas/películas/series/rescate/manual;
- contador de `catalog_exclusions`;
- último run discovery;
- última ejecución exitosa y cálculo `nextAllowedAt = lastSuccess + 7 días`;
- `discoveryAllowed` calculado server-side.

`getNewsCandidate(imdbId)` alimenta `/novedades/[imdbId]` sin llamadas externas.

`app/novedades/page.js` usa `app/novedades/news.css` y presenta tabla compacta con acciones directas `Ver`, `IMDb`, `Añadir`, `Excluir` y `Retirar` para manuales. Cabecera ofrece `Criterios IMDb`, `Excluidas · N` y control de discovery. Catálogo muestra `Ver excluidas` como botón visible en cabecera.

## 8. Candidatos manuales/exclusión
`addManualCandidateAction()` valida IMDb, impide duplicados y respeta exclusión. `restoreAndAddManualAction()` exige restauración explícita. `removeManualCandidateAction()` solo desactiva el manual. `excludeNewsCandidateAction()` escribe en `catalog_exclusions`.

## 9. Discovery IMDb seguro (#42)
`.github/workflows/imdb-discovery.yml` solo contiene `workflow_dispatch`; **sin `schedule`**.

`worker/imdb-discovery.mjs` consulta la última ejecución `imdb_discovery` exitosa antes de descargar datasets. Si no han pasado 7 días, registra `weekly_cooldown` y falla antes del trabajo pesado.

Web:
- se eliminó `requestNewsDiscoveryAction()` y toda inserción `pending` de discovery;
- `saveNewsSettingsAction()` solo guarda criterios;
- se eliminó `Guardar y buscar ahora`;
- Novedades muestra cooldown/fecha siguiente;
- cuando `discoveryAllowed=true`, el botón abre explícitamente `https://github.com/pikolugo-a11y/imdb-catalog/actions/workflows/imdb-discovery.yml` para que el usuario inicie el workflow manual;
- cuando no está permitido, el control queda deshabilitado.

No se introduce PAT/token GitHub en Vercel ni un disparador oculto desde la web: se prioriza seguridad operativa de la cuenta.

## 10. Worker discovery
Streaming gzip de ratings → preselección → basics → resolución selectiva de país → upserts por lotes. India configurable; rescate España solo donde procede. Automáticos que dejan de cumplir pasan a `not_eligible`, no se borran.

## 11. Calidad
Calidad Películas usa datos persistidos Plex/catálogo. Calidad Identidad es el destino de altas parciales con TMDb/FA/campos pendientes. Excluidos se filtran.

## 12. Series
`series-v2.js` usa TMDb, referencia/disponibilidad ES y solo shows Plex activos/no excluidos. #36 mantiene margen de 60 s e instrumentación por fases.

## 13. Sagas / Dashboard / Admin
Sagas mantiene cobertura sin excluidos. Dashboard ignora shows inactivos en KPIs de Series. Admin debe distinguir `weekly_cooldown`, fallos, timeouts y `single_title` parcial/completo.

## 14. Seguridad
Secretos solo en variables de entorno. Sin scraping IMDb. Sin cron/polling agresivo para discovery. No añadir credenciales GitHub al frontend ni al repositorio.

## 15. CI/CD y aceptación
Antes de deployment: revisar sintaxis/build y consistencia de `main`. **ChatGPT no despliega producción.** El usuario ejecuta deployment manual en Vercel; después ChatGPT verifica commit/READY y dirige pruebas que ejecuta el usuario. Issues no se cierran antes del PASS explícito.

## 16. Dependencias
`Plex Sync → inventario/IDs → catálogo/sagas + invalidación Series`

`IMDb Discovery manual semanal → catalog_candidates → Novedades`

`Novedades Add → identidad mínima → movies → enrichTitle best-effort → Calidad si parcial`

`Single title → ensureImdbRating → enrichTitle`

`Procesos → pipeline_runs → Admin`

## 17. Regresiones obligatorias
- Castle: referencia antigua invalidada tras cambio de identidad.
- Love is in the Air: inactiva fuera de Calidad/KPIs.
- First Lady: IMDb on-demand conserva TMDb.
- Novedades: catálogo/excluidos no reaparecen.
- India/rescate España correctos.
- Manual excluido requiere restauración explícita.
- Discovery: sin cron/polling, cooldown semanal, sin `pending` huérfanos.
- `tt38268282`: TMDb ausente → alta parcial catalogada + Calidad.
- Excluidas: acceso visible desde Catálogo y Novedades.
- UX Novedades: tabla compacta, acciones visibles y paginación 24/48/96.
