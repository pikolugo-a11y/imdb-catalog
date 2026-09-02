# PikoFilm — PRE-V4 · Registro acumulativo de ramas GitHub

Fecha de inicio: 2026-09-02  
Rama de trabajo: `pre-v4-readiness`

## Regla

Este documento acumula la clasificación mientras se auditan las ramas. No se elimina ninguna rama durante esta fase; Roberto hará la limpieza manual agrupada cuando termine la revisión completa.

- **BORRAR**: no conserva commits funcionales exclusivos que deban preservarse. El caso normal es `ahead_by=0`; cuando una rama tenga commits exclusivos puramente temporales deberá quedar explícitamente justificado antes de promoverla a BORRAR.
- **CONSERVAR / PROTEGIDA**: rama activa o necesaria.
- **INVESTIGAR**: contiene commits exclusivos o evidencia que todavía requiere contraste.

## PROTEGIDAS / CONSERVAR

- `main` — producción.
- `pre-v4-readiness` — rama PRE-V4 activa.

## INVESTIGAR prioritario

- `archive/railway-pikoquality-technical-snapshot-20260901` — 20 ahead / 705 behind; conserva trabajo exclusivo PikoQuality/Technical.
- `develop` — 25 ahead / 1792 behind; generación V1 completa, histórica, aún no promovida a BORRAR.
- `docs/procesos-automaticos-pa-001` — 25 ahead / 1451 behind; 23 documentos PA históricos que pueden aportar material a P5.
- `feat/process-runtime-id001` — 8 ahead / 600; generación temprana de process-runtime + Identidad.
- `feat/batch-v1-iv001-iv002` — 12 ahead / 143; implementación funcional de Validación/Batch; requiere paridad.
- `feature/m46-b-fast-worker` — 3 ahead / 1234; worker FAST y Railway históricos; contrastar con worker actual.
- `feat/exc001-canonical-exclusion` — 2 ahead / 394; incluye migración DB + workflow Neon temporal; bloqueado por P3/NEON-001.
- `feat/materialized-lifecycle-plex-feedback` — 3 ahead / 1439; modifica Lifecycle/Novedades.
- `agent/neon-storage-optimization` — 2 ahead / 1642; modifica PikoQuality enrichment y Plex sync.

### INVESTIGAR — validaciones, laboratorios y generaciones históricas

- `validate-identity-throughput` — 3 ahead; CI/triggers temporales.
- `validate-mdblist-only-pikoscore` — 2 ahead; CI/trigger temporal.
- `validate-movie-detail-v3` — 1 ahead; marcador CI.
- `validate-movie-quality-saga` — 1 ahead; marcador CI.
- `validate-people-v2-final` — 1 ahead; fichero de validación.
- `validate-people-v2-final2` — 1 ahead; fichero de validación.
- `validate-pikoscore3-rollout` — 1 ahead; CI histórico.
- `validate-runtime-perf` — 2 ahead; triggers temporales.
- `validate-sagas-redesign` — 1 ahead; trigger CI.
- `validate-sagas-v2` — 3 ahead; artefactos de validación/CI observados.
- `validate-series-detail-v3-fa-clean` — 1 ahead; fichero de validación.
- `validate-series-detail-v3` — 1 ahead; fichero de validación.
- `verify-identity-runtime-fix-2` — 1 ahead; fichero de verificación.
- `verify-identity-ui` — 5 ahead; ficheros de verificación/notas.
- `diag/brave-single` — 1 ahead; endpoint diagnóstico Brave.
- `experiment/identity-unit-fa-search-lab` — 1 ahead; modifica acción de Identidad.
- `test/fa-python-5` — 7 ahead; probes/workflow Python-Vercel.
- `test/fa-resolver-benchmark` — 3 ahead; benchmark FA.
- `fix/batch-outcomes-compact-ui` — 5 ahead; exclusivamente generación `/admin/batch` antigua; fuerte candidato BORRAR tras decisión de retirar esa generación.
- `feat/batch-control-center-v1` — 7 ahead; `/admin/batch` + `lib/batch-control`; fuerte candidato BORRAR.
- `feat/batch-duration-eta` — 4 ahead; ETA/UI de `/admin/batch`; fuerte candidato BORRAR.
- `remove-fa-ambiguos` — 3 ahead; retirada de antigua UI de ambiguos; revisar contra arquitectura actual.
- `ux-v1.1` — 2 ahead; UX V1 histórica.
- `v1.2-feedback` — 18 ahead; V1.2 histórica.
- `v2/issues-24-31` — 35 ahead; generación V2 histórica; contiene orígenes de nombres aún usados como compatibilidad.
- `feat/calidad-datos-248` — 4 ahead; cambios Calidad Datos.
- `feat/calidad-global-224` — 10 ahead; dashboard Calidad.
- `feat/data008-global-imdb-ratings` — 2 ahead; DATA-008 retirado actualmente; fuerte candidato BORRAR, falta cierre.
- `feat/data-quality-center` — 7 ahead; primera generación del centro de Calidad Datos.
- `feat/data-quality-observability-performance` — 4 ahead; perf/log Calidad Datos; ideas útiles ya preservadas históricamente en #449, falta cierre de rama.
- `feat/data-quality-source-retries` — 4 ahead; retry de fuentes histórico.
- `feat/fa-github-safe-search` — 6 ahead; Identity/FA histórico.
- `feat/fa-python-fallback` — 4 ahead; fallback Python FA histórico.
- `feat/home-audit-v2` — 8 ahead; Home histórico.
- `feat/home-dashboard-v3` — 5 ahead; Home histórico.
- `feat/home-third-review` — 7 ahead; incluye cron/dashboard snapshot y Vercel config; requiere contraste.
- `feat/identity-one-by-one` — 1 ahead y el único cambio es `tmp-placeholder`; candidato directo a BORRAR en siguiente cierre.
- `feat/identity-persist-ambiguities` — 6 ahead; UI/storage de ambiguos histórica.
- `feat/identity-validation-phased-cache` — 11 ahead; workflow/Python/cache histórico.
- `feat/m46c-filmaffinity` — 2 ahead; `tmp/noop-fa-fix` + pequeño worker SQL; candidato fuerte a BORRAR tras contraste.
- `feat/omdb-news-intake` — 6 ahead / 1443 behind; generación antigua de intake manual OMDb/Novedades; requiere contraste con flujo NOV actual.
- `fix/identity-validation-resume` — 2 ahead / 1500 behind; conserva cambios exclusivos en workflow + worker de refresh de validación; requiere contraste con runtime actual.
- `fix/lifecycle-dockerfile` — 1 ahead / 1165 behind; Dockerfile.lifecycle exclusivo de ejecución histórica. Mantener INVESTIGAR hasta cerrar ejecución-plane.
- `fix/lifecycle-railway-config` — 1 ahead / 1164 behind; railway.lifecycle.toml exclusivo histórico. Mantener INVESTIGAR hasta cerrar Railway/ejecución-plane.
- `fix/lifecycle-skip-cached-source-budget` — 1 ahead / 1143 behind; modifica worker lifecycle histórico. Requiere contraste con plano actual antes de descartar.
- `fix/manual-news-state-flow` — 1 ahead / 1445 behind; cambio exclusivo en `lib/news-v1.js`; requiere contraste con Novedades actual.
- `fix/novedades-remove-plex-duplicate` — 1 ahead / 1446 behind; cambia `app/novedades/layout.js`; candidato histórico pero por tocar montaje frontend permanece INVESTIGAR hasta cerrar Safety Gate.

## BORRAR — confirmado sin commits exclusivos (`ahead_by=0`)

### Temporales / operaciones / validaciones

- `pre-v4-audit-tmp`
- `cleanup/drop-batch-job-steps-direct`
- `cleanup/retire-legacy-batch-ui`
- `noop`
- `noop-check`
- `tmp-ignore`
- `tmp-ignore2`
- `tmp-noop`
- `ops/cleanup-id001-readonly-check`
- `ops/verify-id001-batch-readonly`
- `ops/revalidate-tt8442644`
- `ops/revalidate-tt8442644-rerun`
- `ops/revalidate-tt8442644-rerun3`
- `ops/revalidate-tt8442644-rerun4`
- `ops/vercel-deploy-iv-batch`
- `validate-people-v2`
- `validation-lifecycle-only`
- `test/brave-throttle-30`
- `audit-unitary-identity-validation`
- `chore/m46b-pilot-cleanup`
- `chore/neon-project-switch`
- `cleanup/catalog-legacy-actions`
- `cleanup/retire-data008`

### Performance / fixes absorbidos

- `perf/identity-minimal-resolution`
- `perf/identity-minimal-resolution-v2`
- `perf/vercel-frankfurt`
- `fix/api-worker-dockerfile`
- `fix/api-worker-entrypoint`
- `fix/batch-error-observability-ser003`
- `fix/batch-error-visibility`
- `fix/batch-external-calls-counter`
- `fix/batch-partial-status`
- `fix/batch-preview-context-signature`
- `fix/series-detail-availability-refresh`
- `fix/series-detail-availability-refresh-v2`
- `fix/identity-validation-batch-selection`
- `fix/identity-validation-worker-parity`
- `fix/iv003-show-result`
- `fix/m46b-result-summary`
- `fix/m46c-fa-sql-type`
- `fix/m46c-lifecycle-reconcile`
- `fix/m46c-omdb`
- `fix/m46c-omdb-null-scores`
- `fix/m46c-plex-docker-copy`
- `fix/mov001-effective-duration-fingerprint`
- `fix/mov001-fingerprint-order`
- `fix/mov001-postgres-fingerprint`
- `fix/nov008-concurrency-lock`
- `fix/novedades-plex-header`
- `fix/novedades-sql-hotfix`

### Batch / execution plane absorbido

- `feat/batch-double-accordion-global`
- `feat/data-batch-double-accordion`
- `feat/batch-engine-v1`
- `feat/batch-api-id001`
- `feat/batch-data003-pilot`
- `feat/batch-mov001`
- `feat/batch-v1-data001`
- `feat/batch-v1-data002`
- `feat/batch-v1-ser003-ser004`
- `feat/batch-validation-v1`
- `feat/ser002-batch-v1`
- `feature/m46-a-control-queue`

### Process Runtime ID-001 — aliases absorbidos

Las siguientes 18 refs apuntan al mismo commit `8e6174cf5698e4a9edf55da09acbed784832f681`, comparado contra `main` con ahead=0 / behind=600:

- `feat/process-runtime-id001-clean`
- `feat/process-runtime-id001-impl`
- `feat/process-runtime-id001-pilot`
- `feat/process-runtime-id001-pilot-2`
- `feat/process-runtime-id001-pilot-3`
- `feat/process-runtime-id001-pilot-4`
- `feat/process-runtime-id001-pilot-5`
- `feat/process-runtime-id001-pilot-20260828`
- `feat/process-runtime-id001-pilot-a`
- `feat/process-runtime-id001-pilot-b`
- `feat/process-runtime-id001-pilot-c`
- `feat/process-runtime-id001-pilot-final`
- `feat/process-runtime-id001-pilot-final2`
- `feat/process-runtime-id001-pilot-safe`
- `feat/process-runtime-id001-pilot-x`
- `feat/process-runtime-id001-pilot-y`
- `feat/process-runtime-id001-pilot-z`
- `feat/process-runtime-id001-v1`

### Arquitectura M46 absorbida

- `architecture/m46-batch-autopilot`
- `architecture/m46-batch-autopilot-2`
- `architecture/m46-batch-autopilot-final`
- `architecture/m46-batch-autopilot-temp`
- `architecture/m46-batch-autopilot-work`

Las cuatro últimas comparten head `5d1b4f74dd18d013de8ad7e4e9f7924a5f78f549`, ya comparado ahead=0.

### Documentación absorbida

- `docs/architecture-efficiency`
- `docs/cost-efficiency`
- `docs/efficiency`
- `docs/infra-efficiency`
- `docs/neon-efficiency-architecture`
- `docs/neon-efficiency-canonical`
- `docs/neon-efficiency-final`
- `docs/neon-efficiency-policy`
- `docs/neon-efficiency-rule19`
- `docs/neon-efficiency-rule-v2`
- `docs/neon-policy`
- `docs/neon-rule19`
- `docs/neon-efficiency-rule`
- `docs/golden-rules-purpose`
- `docs/cleanup-historical-docs`
- `docs/status-after-m01-m07`
- `docs-lifecycle-roadmaps`

Las primeras 12 del bloque comparten en su mayoría head `6edbf3ce66a105aa6376edbbf586a7a697489a1a`, ya comparado ahead=0.

### Calidad / Home / Identidad / M46 absorbidos

- `pikoscore-ratings-separation`
- `pikoscore-v2`
- `show-movie-file-pending`
- `unify-fa-rating-fetch`
- `unify-quality-frontends`
- `unitary-data-quality-flow`
- `unitary-identity-validation`
- `feat/calidad-datos-operational-ux`
- `feat/data001-observability`
- `feat/data002-ratings-observability`
- `feat/data003-pikoscore-observability`
- `feat/data005-accept-incomplete-observability`
- `feat/data-quality-manual-override-speed-layout`
- `feat/data-quality-validation-gate`
- `feat/home-db-storage`
- `feat/home-fourth-review`
- `feat/id-correction-core-iv003`
- `feat/iv001-observability`
- `feat/iv002-observability`
- `feat/iv004-observed-manual-decision`
- `feat/iv005-force-identity-association`
- `feat/m46c-plex-probe`
- `feat/m46c-tmdb-api-worker`
- `feat/m46c-wikidata`
- `feat/mov001-canonical-physical-validation`
- `feat/mov002-observed-exception`
- `feat/mov003-full-reprocessing-reset`

### Novedades / Personas absorbidos

- `feat/nov001-canonical-imdb-discovery`
- `feat/nov002-manual-imdb-intake`
- `feat/nov003-retry-manual-minimums`
- `feat/nov004-restore-and-add`
- `feat/nov006-remove-manual-candidate`
- `feat/nov007-minimal-catalog-admission`
- `feat/nov008-plex-news-seed-observed`
- `feat/nov009-canonical-plex-sync`
- `feat/nov010-plex-manual-imdb`
- `feat/nov011-saga-intake`
- `feat/nov016-restore-exclusion`
- `feat/operations-reset-title`
- `feat/per001-canonical-person-refresh`
- `feat/per002-common-batch`

## Frontend Safety Gate para ramas

Borrar una ref que no contiene commits exclusivos no modifica el árbol de `main`, el frontend desplegado, Railway, Vercel ni Neon. Por eso estas refs pueden clasificarse BORRAR independientemente de que el código histórico contenido en su commit haya sido frontend-consumido: la implementación relevante ya está absorbida por la historia de `main`.

Las ramas con commits exclusivos sí se mantienen en INVESTIGAR hasta demostrar si esos commits son sólo temporales/históricos o si conservan valor funcional no absorbido.

## Estado

Inventario vivo confirmado el 2026-09-02: **345 ramas** mediante paginación completa del repositorio. Auditoría todavía en curso. En este bloque se añadieron 18 ramas `ahead_by=0` a BORRAR y 5 ramas con commits exclusivos a INVESTIGAR. No ejecutar limpieza manual hasta que todas estén clasificadas y se genere la lista final consolidada.
