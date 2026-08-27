# PikoQuality frontend evolution — implementation checkpoint 2026-08-27

This checkpoint records the implementation started after the full UX/functional audit in issue #264. It exists so the current work can be recovered independently of chat history.

## Work running in parallel

The initial Plex technical snapshot (Phase 1) remains running. Frontend work must not stop that worker and must not modify Fast Sync. C5 is frozen separately and is not being rolled out as the production formula during this frontend evolution.

## Implemented in this checkpoint

- Replaced in-memory loading/filtering of all PikoQuality physical rows with SQL aggregation.
- Added canonical server-side pending queue with real total and 25-row pagination.
- Added query-param-preserved search, filters and order.
- Search covers localized title, principal title, original title, Plex title and IMDb ID.
- Filters include resolution, codec and operational state.
- Priority ordering is deterministic in SQL and exposes its reason.
- KPI cards expose coverage, global movie queue, stale and incidents; relevant KPIs link to filtered work queues.
- Main progress ring uses real canonical coverage instead of a hardcoded percentage.
- Technical capture and PikoQuality calculation are presented as separate workflows.
- Queue rows show useful technical file summary rather than Plex rating_key.
- Individual PikoQuality no longer reads Plex live. It consumes the persisted technical snapshot (`plex_media`, `plex_files`, `plex_streams`, `plex_technical_state`).
- Individual analysis blocks clearly when technical snapshot is not `ready` or movie-file validation is not current.
- Server action returns structured expected errors/results.
- Row action has `Analizando…` pending state, prevents double-submit and displays contextual success/error.
- Fingerprint/formula mismatch is represented as stale/desactualizado and prioritized.
- Evaluated-items browsing was removed from this workspace, respecting the decision that evaluated results belong in Catalog.
- Clean `PikoQuality al día` state hides the operational queue when there is no pending/stale/error work.
- Responsive CSS added for filters, KPI, completion and technical capture areas.

## Explicitly deferred

### PikoQuality explanation component (audit change 7)
Do not generate an ad-hoc explanation from the old formula. The explanation must come from the same domain function/components as the final C5-or-successor implementation. Implement it when the candidate formula is promoted into Individual, so score and explanation cannot diverge.

### Formula C5 production rollout
C5 (`PQ2-C5-UNIFIED-2026-08-27`) remains frozen for revalidation against a materially larger Phase 1 sample. The current production formula version remains unchanged during this frontend checkpoint.

### Batch/Railway formula changes
Do not alter Batch/Railway PikoQuality calculation until Individual has the final validated formula. Mandatory order remains Individual → regression validation → shared implementation → Batch/Railway → parity test.

## Runtime/database validation performed

- SQL aggregate path tested against Neon and returned a canonical eligible universe without loading rows into Node.
- Pending movie queue count validated independently: 141 at validation time.
- Persisted snapshot input query validated against a real ready movie, including video/audio stream values.

## Deployment state

These changes are committed to GitHub main through the individual commits generated in this checkpoint. At the time of writing, Vercel had not yet produced a deployment containing the new commits; therefore visual/runtime validation on Vercel is still pending deployment.
