# PikoFilm V2 — Documento técnico

**Estado:** baseline técnica viva + Novedades V1; aceptación en curso; #42 ampliada para dispatch desde frontal · 19/08/2026  
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

## 5. Plex
`plex-sync.js` mantiene inventario físico e invalida referencias de Series cuando cambia identidad. Shows `active=false` quedan fuera de Calidad/KPIs sin necesidad de borrar histórico. Regresión: `Love is in the Air`.

## 6. Enriquecimiento y alta parcial (#43)
`lib/enrich-title.js` continúa siendo el único enriquecedor. `app/novedades/actions.js::enrichNewsCandidateAction()` adapta un candidato al catálogo.

Contrato implementado:
1. Crea staging mínimo en `movies`.
2. Ejecuta `enrichTitle()`.
3. Si completa: elimina flag staging, marca candidato `catalogued`, run `success/stage=done`.
4. Si falla y existe identidad mínima fiable (`title !== imdbId` + `candidate_type` soportado): no borra `movies`; elimina staging y añade a `source_status` `partial=true`, `enrichment_status='pending'`, error y fecha; marca candidato `catalogued`; `pipeline_runs` termina `success/stage=partial`.
5. Si no existe identidad mínima fiable: rollback del staging, candidato vuelve a `eligible`, run `failed/stage=failed_identity`.

Calidad/Identidad detecta los IDs/campos faltantes desde las fuentes canónicas; no se crea tabla paralela para #43. Regresión: `tt38268282`.

## 7. Novedades — lectura y UX (#41)
`lib/news-v1.js::getNewsV1()` realiza anti-join `movies` + `catalog_exclusions`, filtros, paginación 24/48/96, stats, contador de excluidas, último run, última ejecución exitosa y cálculo server-side del cooldown.

Además lee `app_settings.imdb_discovery_test_override`. `testOverrideAvailable=true` únicamente cuando `enabled=true` y `used!=true`.

`app/novedades/page.js` presenta tabla compacta y acciones `Ver`, `IMDb`, `Añadir`, `Excluir` y `Retirar` para manuales. Cabecera ofrece `Criterios IMDb`, `Excluidas · N` y control de discovery. Catálogo muestra `Ver excluidas` como botón visible.

## 8. Candidatos manuales/exclusión
`addManualCandidateAction()` valida IMDb, impide duplicados y respeta exclusión. `restoreAndAddManualAction()` exige restauración explícita. `removeManualCandidateAction()` solo desactiva el manual. `excludeNewsCandidateAction()` escribe en `catalog_exclusions`.

## 9. Discovery IMDb seguro (#42)
`.github/workflows/imdb-discovery.yml` contiene únicamente `workflow_dispatch`; no existe `schedule`.

El workflow acepta input `force_once` (`false` por defecto). Lo propaga a `FORCE_DISCOVERY_ONCE` del worker. `worker/imdb-discovery.mjs` consulta la última ejecución exitosa antes de descargar datasets: si hay cooldown y `FORCE_DISCOVERY_ONCE!=true`, registra bloqueo y termina antes del trabajo pesado. Con `force_once=true`, omite exclusivamente esa comprobación para una ejecución y registra `source='manual_test_override'`, `forceOnce=true` y `weeklyGuardBypassed=true` cuando corresponda.

### Dispatch desde el frontal
`app/novedades/actions.js::requestNewsDiscoveryAction()`:
1. requiere secreto server-side `GITHUB_ACTIONS_TOKEN` en Vercel;
2. recalcula el cooldown desde `pipeline_runs`, sin confiar solo en la UI;
3. si no hay cooldown, solicita `workflow_dispatch` normal con `force_once=false`;
4. si hay cooldown, intenta consumir atómicamente `app_settings.imdb_discovery_test_override` mediante `UPDATE ... WHERE enabled=true AND used=false RETURNING`;
5. solo si consume esa excepción envía `force_once=true`;
6. hace `POST` a la API GitHub Actions para `imdb-discovery.yml` sobre `ref=main`;
7. si GitHub rechaza la solicitud, devuelve `used=false` para que un fallo técnico no consuma la excepción;
8. registra audit log del dispatch o fallo y redirige a Novedades con feedback.

El token nunca llega al navegador: se usa únicamente dentro de la Server Action. Debe tener permisos mínimos suficientes para disparar el workflow del repositorio y vivir solo como secreto de producción Vercel.

### Override de aceptación
`app_settings.imdb_discovery_test_override` no sustituye la política semanal. Es una bandera operacional excepcional para pruebas controladas. Se ha preparado con `enabled=true`, `used=false` para una sola aceptación de #42. Después de una ejecución exitosa, la nueva fila `pipeline_runs status=success` vuelve a fijar automáticamente el siguiente cooldown a +7 días. El flag consumido permanece `used=true` hasta que exista una decisión explícita futura; no se rearma automáticamente.

## 10. Worker discovery
Streaming gzip de ratings → preselección → basics → resolución selectiva de país → upserts por lotes. India configurable; rescate España solo donde procede. Automáticos que dejan de cumplir pasan a `not_eligible`, no se borran.

## 11. Calidad
Calidad Películas usa datos persistidos Plex/catálogo. Calidad Identidad es el destino de altas parciales con TMDb/FA/campos pendientes. Excluidos se filtran.

## 12. Series
`series-v2.js` usa TMDb, referencia/disponibilidad ES y solo shows Plex activos/no excluidos. #36 mantiene margen de 60 s e instrumentación por fases.

## 13. Sagas / Dashboard / Admin
Sagas mantiene cobertura sin excluidos. Dashboard ignora shows inactivos en KPIs de Series. Admin debe distinguir `weekly_cooldown`, dispatch manual, override de aceptación, fallos, timeouts y `single_title` parcial/completo.

## 14. Seguridad
Secretos solo en variables de entorno. Sin scraping IMDb. Sin cron/polling para discovery. `GITHUB_ACTIONS_TOKEN` es server-only en Vercel y jamás se persiste en GitHub/Neon/logs. La excepción de aceptación se consume una sola vez con actualización condicional para minimizar dobles pulsaciones/race conditions.

## 15. CI/CD y aceptación
Antes de deployment: revisar sintaxis/build y consistencia de `main`. ChatGPT no despliega producción. El usuario configura el secreto necesario, ejecuta deployment manual en Vercel y realiza todas las pruebas funcionales/visuales. Issues no se cierran antes del PASS explícito.

## 16. Dependencias
`Plex Sync → inventario/IDs → catálogo/sagas + invalidación Series`

`PikoFilm Server Action → GitHub workflow_dispatch → IMDb Discovery manual semanal → catalog_candidates → Novedades`

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
- Dispatch desde PikoFilm: botón server-side solicita exactamente un workflow y no expone token.
- Override de aceptación: puede consumirse una sola vez y vuelve a quedar bloqueado tras la ejecución exitosa.
- `tt38268282`: TMDb ausente → alta parcial catalogada + Calidad.
- Excluidas: acceso visible desde Catálogo y Novedades.
- UX Novedades: tabla compacta, acciones visibles y paginación 24/48/96.
