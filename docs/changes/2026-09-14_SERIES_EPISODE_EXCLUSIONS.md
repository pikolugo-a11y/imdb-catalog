# Calidad · Series — Exclusiones manuales de episodios

Fecha: 2026-09-14  
Estado: contrato funcional de la corrección `fix/series-episode-exclusions`.

## Objetivo

Permitir que un episodio oficial de la referencia de una serie se marque manualmente como **Exclusión** cuando no debe exigirse físicamente en Plex, por ejemplo porque no fue publicado en España o porque la referencia de TMDb contiene una numeración/episodio que no corresponde al catálogo gestionado.

## Semántica canónica

- La exclusión se guarda en `series_episode_overrides` con `decision='unavailable'`.
- La identidad de la decisión es `show_rating_key + season_number + episode_number`; no depende de un archivo Plex ni de su fingerprint.
- Sólo se puede crear sobre un episodio oficial existente en `series_reference_episodes` cuyo diagnóstico físico actual sea `missing`.
- La exclusión **no afirma que el episodio exista físicamente en Plex**. `series_diagnostics.status` continúa siendo `missing`.
- Para Calidad, una exclusión se considera satisfecha/cubierta: `series_episode_effective_status.effective_status='present'`. Por tanto no cuenta como `missing_actionable`, `availability_unknown` ni pendiente de atención.
- La UI debe mostrar `⊘ Exclusión`, no `En Plex`, y la evidencia debe conservar `Plex: No encontrado · exclusión manual`.
- Los agregados que usan la cobertura efectiva pueden contabilizarla como cubierta. Por claridad, la interfaz denomina a ese agregado **Cobertura efectiva** y no Cobertura Plex.
- La decisión es reversible mediante **Quitar exclusión**. Al retirarla, el episodio vuelve inmediatamente al estado efectivo que resulte de Plex + disponibilidad España.
- Un refresco de Plex o TMDb no debe eliminar automáticamente una exclusión mientras siga existiendo la misma identidad oficial de episodio.
- Si el episodio desaparece de la referencia oficial, el override no crea por sí mismo un episodio ficticio ni participa en los agregados.

## Proceso y observabilidad

La acción pertenece a `PROC-SER-005 — Resolver anomalía de episodio`, como decisión humana individual sin Batch. Crea eventos `manual_decision` diferenciando `exclude_official_episode` y `reopen_official_episode`, recompone Lifecycle y refresca el read model de Calidad · Series.

## Implementación

- Acción: `app/calidad/series/episode-exclusion-actions.js`.
- UX: `app/calidad/series/[ratingKey]/page.js`.
- Vista efectiva: `db/migrations/20260914_series_episode_exclusions.sql`.
- Contrato de regresión: `test/series-episode-exclusion-contract.test.mjs`.

## Despliegue

La migración de Neon debe aplicarse antes del deploy Vercel Production que exponga la acción, para que la vista `series_episode_effective_status` incluya la decisión `unavailable` y las columnas de override. El deploy de Vercel Production sigue siendo responsabilidad exclusiva del usuario.
