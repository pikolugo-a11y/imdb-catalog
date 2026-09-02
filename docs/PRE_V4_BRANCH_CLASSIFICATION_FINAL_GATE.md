# PikoFilm — PRE-V4 · Gate final de clasificación de ramas

Fecha: 2026-09-02
Base de comparación: `main` = `47a4a521f9997b3838b160ad02ffc027d5c35d9c`
Inventario: 345 ramas, paginado 100 + 100 + 100 + 45.

## Criterio final y exhaustivo

Este gate cierra la **clasificación de seguridad de las 345 refs** sin borrar ninguna.

1. `main` y `pre-v4-readiness` = **PROTEGIDAS**.
2. Toda rama documentada en `PRE_V4_BRANCH_CLASSIFICATION_LEDGER.md` como BORRAR, más las confirmadas en la pasada final de este documento, = **BORRAR**.
3. Toda rama del inventario de 345 que no esté expresamente en PROTEGIDAS o BORRAR = **INVESTIGAR / CONSERVAR POR DEFECTO**. Esta regla hace que ninguna ref quede sin clasificación y evita que una rama con commits exclusivos se borre por inferencia de nombre.

`archive/railway-pikoquality-technical-snapshot-20260901` sigue explícitamente protegida de borrado hasta auditoría histórica separada.

## BORRAR añadido en la pasada final

Comparación directa contra `main`: `ahead_by=0`, `files=[]`.

- `feat/pikoquality-technical-observability`
- `feat/pikoscore-v3-ready`
- `feat/quality-personas`
- `feat/ratings-quality-decouple-fa`
- `feat/ser001-observed-plex-series-sync`
- `feat/ser002-plex-series-detail`
- `feat/ser003-tmdb-reference-observability`
- `feat/ser004-es-availability-observability`
- `feat/ser005-evidence-bound-overrides-ui`
- `feat/ser006-reset-season-availability-observability`
- `feature/identity-validation`
- `feature/lifecycle-identity-validation`
- `fix/batch-preview-neon`
- `fix/batch-preview-neon-native`
- `fix/batch-status-clarity`
- `fix/data002-mdblist-404-fallback`
- `fix/data-quality-fast-layout-v2`
- `fix/data-quality-page-speed-layout`
- `fix/data-quality-parameter-binding`
- `fix/data-quality-sequential-cascade`
- `fix/data-ratings-missing-date-pending`
- `fix/id001-remove-legacy-batch-state`
- `fix/identity-edit-formdata`
- `fix/identity-fa-multisearch`
- `fix/identity-fa-python`
- `fix/identity-fa-resolution`
- `fix/identity-lifecycle-only`
- `fix/identity-new-only-consistency`
- `fix/identity-unit-fa-web-search`
- `fix/identity-unit-google-trace`
- `fix/source-breaker-http-semantics`
- `fix-identity-multilingual-rescue`
- `fix-pikoquality-page-load`
- `fix-series-detail-availability-refresh`
- `fix-series-exclude`
- `fix-unitary-fa-evidence-host`
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
- `movie-file-validation-lifecycle`
- `movie-review-reset-flow`
- `ops/cleanup-vercel-deploy-once`
- `ops/human-process-names`
- `railway/code-change-N4O52t`
- `tune/fa-probable-candidates`

## INVESTIGAR confirmado en la pasada final

Estas ramas tienen `ahead_by>0`; por tanto no son borrables automáticamente aunque sean históricas:

- `feat/pikoscore-v3-experimental`
- `feat/ratings-foundation-204`
- `feat/saga001-observability`
- `feat/series-confirm-es-season`
- `feat/series-detail-v3-issue-246`
- `feat/watchmode-es-fallback`
- `feat/227-identity-validation-ux`
- `feat/229-calidad-series-v3`
- `feature/guard-fast-from-lifecycle`
- `feature/lifecycle-state-model`
- `feature/novedades-v1-stabilization`
- `fix/brave-200-false-block`
- `fix/calidad-layout-224`
- `fix/catalog-performance-news-table`
- `fix/dashboard-neon-runtime`
- `fix/data-quality-fast-layout`
- `fix/data-quality-metadata-fallbacks`
- `fix/data-quality-performance-logs-readability`
- `fix/fa-auth-diagnostics`
- `fix/fa-auth-programmingerror-detail`
- `fix/fa-search-local-lifecycle`
- `fix/fa-vercel-fingerprint-override`
- `fix/fa-worker-auth-fastpath`
- `fix/identity-brave-massive`
- `fix/identity-recalculate-cache-only`
- `fix/identity-stale-cancel`
- `fix/identity-string-similarity-colors`
- `fix/identity-unit-google-html-diagnostics`
- `fix/series-availability-global-provider`
- `fix/series-detail-final`
- `fix/series-detail-todos`
- `fix/series-double-episode-reconcile`
- `fix/series-double-runtime-source`
- `fix/series-filters-performance-tmdb-pending`
- `fix/series-search-and-stage-routing`
- `fix/series-season-coherence`
- `fix/series-tmdb-status-manual-sync`
- `fix/source-budget-real-attempts`
- `fix/stabilize-v2-all-pending`
- `fix/watchmode-diagnostics`
- `fix/watchmode-direct-tmdb-title`
- `fix/watchmode-episode-sources`
- `fix/watchmode-episode-witness`
- `fix/watchmode-tmdb-tv-id`
- `fix/wikidata-combined-identity`
- `fix/wikidata-query-timeout`
- `fix/wikidata-retry-policy`
- `fix-data-quality-source-args`
- `fix-data-quality-type-recovery`
- `fix-fa-cross-runtime-auth`
- `fix-identity-fa-local`
- `fix-tech-exact-unitary`
- `fix-tech-unitary-parity`
- `hotfix/a-battery-round2`
- `issue-14-frontend`
- `issue-14-worker`
- `issue-19-plex-fast-sync`
- `issue-197-validation-imdb-tmdb`
- `m46-identity-lifecycle`
- `m46-lifecycle-orchestrator`
- `m46-movie-file-lifecycle`
- `m46-pikoscore-lifecycle`
- `m46-series-sync-lifecycle`
- `m46-tech-lifecycle`
- `migration/m16-m27-legacy-workers`

## Safety Gate

La lista BORRAR sólo contiene refs demostradas sin commits exclusivos respecto a `main`. Borrar esas refs no cambia el árbol de producción, frontend, Railway, Vercel ni Neon. Las ramas con commits exclusivos quedan fuera de la lista de borrado aunque parezcan obsoletas.

## Resultado

**Clasificación de seguridad cerrada para las 345 ramas.**

La siguiente acción destructiva es manual y requiere aprobación/intervención de Roberto: eliminar únicamente las ramas de la lista BORRAR consolidada (ledger + este gate). No borrar ramas INVESTIGAR ni PROTEGIDAS.
