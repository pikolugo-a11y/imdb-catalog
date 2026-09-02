# PikoFilm — PRE-V4 · Clasificación final para limpieza de ramas

Fecha: 2026-09-02
Base de comparación: `main` = `47a4a521f9997b3838b160ad02ffc027d5c35d9c`
Inventario auditado: **345 ramas**.

## Criterio final

La clasificación de limpieza queda cerrada de forma conservadora:

1. **BORRAR** sólo si se ha demostrado `ahead_by=0` frente a `main` (sin commits exclusivos). Borrar la ref no puede retirar código del árbol de producción.
2. **CONSERVAR** para `main` y `pre-v4-readiness`.
3. **RETENER / NO BORRAR** para cualquier otra rama no incluida expresamente en BORRAR. Esto incluye ramas con commits exclusivos, ramas históricas cuya paridad funcional no está demostrada y ramas afectadas por el Frontend Safety Gate, Railway, Vercel o Neon.

Con esta regla, las 345 refs quedan clasificadas para la operación de limpieza aunque parte del contenido histórico siga siendo objeto de auditorías funcionales PRE-V4 posteriores.

## BORRAR — refs verificadas sin commits exclusivos

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
- `fix/batch-preview-neon`
- `fix/batch-preview-neon-native`
- `fix/batch-status-clarity`
- `fix/series-detail-availability-refresh`
- `fix/series-detail-availability-refresh-v2`
- `fix/series-detail-plex-complete-label`
- `fix/series-api-gate-leases`
- `fix/series-batch-read-model-parity`
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
- `fix/data002-mdblist-404-fallback`
- `fix/data-quality-fast-layout-v2`
- `fix/data-quality-page-speed-layout`
- `fix/data-quality-parameter-binding`
- `fix/data-quality-sequential-cascade`
- `fix/data-ratings-missing-date-pending`
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
- `architecture/m46-batch-autopilot`
- `architecture/m46-batch-autopilot-2`
- `architecture/m46-batch-autopilot-final`
- `architecture/m46-batch-autopilot-temp`
- `architecture/m46-batch-autopilot-work`
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
- `railway/code-change-N4O52t`
- `tune/fa-probable-candidates`
- `hotfix/per002-canonical-core`
- `hotfix/per002-node24-resolution`
- `hotfix/per002-node24-resolution-2`
- `hotfix/per002-worker-server-only`
- `hotfix/series-batch-schema-v2`
- `hotfix/series-quality-batch-state`
- `issue-198-identity-without-fa`
- `migration/m01-m07-unitary-quality`
- `migration/m08-m15-legacy-routes`
- `migration/m28-m35-lifecycle-core`

## CONSERVAR explícitamente

- `main` — producción.
- `pre-v4-readiness` — PRE-V4 activa.

## RETENER / NO BORRAR

**Todas las ramas del inventario de 345 que no aparezcan en la lista BORRAR anterior.**

Esto incluye expresamente `archive/railway-pikoquality-technical-snapshot-20260901` y cualquier ref con `ahead_by>0` o cuya equivalencia con `main` no haya quedado demostrada. No se infiere obsolescencia por nombre (`batch`, `v1`, `lifecycle`, `railway`, etc.).

Ejemplos con commits exclusivos confirmados durante el cierre: `fix/series-availability-global-provider`, `fix/series-detail-final`, `fix/series-detail-todos`, `fix/series-double-episode-reconcile`, `fix/series-double-runtime-source`, `fix/watchmode-diagnostics`, `fix/watchmode-direct-tmdb-title`, `fix/watchmode-episode-sources`, `fix/watchmode-episode-witness`, `fix/watchmode-tmdb-tv-id`, `fix/wikidata-combined-identity`, `fix/wikidata-query-timeout`, `fix/wikidata-retry-policy`, `issue-14-frontend`, `issue-14-worker`, `issue-19-plex-fast-sync`, `issue-197-validation-imdb-tmdb`, `migration/m16-m27-legacy-workers`, `fix/brave-200-false-block`, `fix/calidad-layout-224`, `fix/catalog-performance-news-table`, `fix/dashboard-neon-runtime`, `fix/data-quality-fast-layout`, `fix/data-quality-metadata-fallbacks` y `fix/data-quality-performance-logs-readability`.

## Frontend Safety Gate

Para las ramas BORRAR, el gate es `NO`: al tener `ahead_by=0`, la ref no conserva ningún commit exclusivo respecto a `main`. El borrado de la ref no cambia rutas, botones, Server Actions, APIs, workers, Railway, Vercel ni datos.

Para RETENER, no se autoriza borrado. Si una futura auditoría quiere promover alguna de esas ramas a BORRAR, deberá aportar evidencia suficiente y volver a aplicar el Frontend Safety Gate cuando proceda.

## Resultado

**Clasificación de limpieza de ramas: CERRADA.**

No se han borrado refs en esta fase. La operación manual posterior debe usar exclusivamente la lista BORRAR de este documento; cualquier nombre no incluido se conserva.