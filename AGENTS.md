# PikoFilm — AI development entrypoint

PikoFilm is maintained primarily with AI-assisted engineering. Any AI agent, coding assistant or new chat/session MUST treat this file as the first repository entrypoint.

## Mandatory startup sequence

Before proposing or changing behavior, read:

1. `docs/AI_DEVELOPMENT_GUIDE.md`
2. `docs/PROJECT_RULES.md`
3. `docs/README.md` — canonical documentation map
4. `docs/V4_FUNCTIONAL_SPEC.md` — complete current functional contract
5. `docs/V4_ARCHITECTURE.md` — complete current architecture
6. `docs/V4_UX_SPEC.md` — complete current UX/UI contract
7. `docs/processes/PROCESS_CATALOG.md` when a process/PROC is affected
8. `docs/processes/BATCH_ARCHITECTURE.md` when Batch/workers/leases/retry/concurrency are affected
9. `docs/operations/RUNBOOK.md` when infrastructure/operations/recovery are affected

The live system wins over stale documentation. If code, Neon, Railway, Vercel, GitHub Actions and docs disagree, verify the live implementation first and update documentation in the same work block.

## Canonical V4 baseline

The consolidated V4 documentation describes `main` after PR #511, merge commit:

`323b1cd4dd2cc8b5def081bc98ab094006df3efe`

Do not restart from PRE-V4 baselines, intermediate V4 handoffs or historical per-vertical contracts. Git history preserves those documents when archaeology is required.

## Non-negotiable process rule

Every functional process has one canonical business operation. Batch is orchestration only.

```text
individual -> process_run -> canonical operation X
Batch -> queue/orchestration -> child process_run -> canonical operation X
```

A Batch worker must not contain a copied or independently evolving recipe. If individual behavior changes, Batch inherits it through the same canonical core. Deliberate guard/postprocessing differences must be explicit and contract-tested.

## Product invariants

- PikoFilm is the editorial master database; Plex is the truth for physical presence/playback.
- Do not introduce watched/unwatched, viewing progress or consumption semantics without an explicit product decision.
- Global Plex sync remains manual. Do not add scheduled/global Plex polling.
- Functional attention belongs in Calidad; human-readable history/planning in Actividad; technical diagnosis/control in Operaciones.
- Activity and Operations share canonical observability and a 30-day detailed retention window.
- TMDb, OMDb and MDBList governed calls are fail-closed: no governed fetch without canonical API governance.
- Recovery is contextual and safe. There is no generic `reset all PikoFilm` action.

## Documentation is implementation

A change is incomplete if it alters architecture, behavior, process flow, Lifecycle, persistence, executor, external sources, retry/error behavior, Batch, observability, infrastructure or UX without reviewing the canonical docs.

Use `docs/development/AI_CHANGE_CHECKLIST.md` before delivering significant changes.

## New-chat continuity

Do not use conversation memory as source of truth. Recover the project from this entrypoint and the canonical V4 triad. Historical documents/issues are evidence only.

## Safety

- Audit before delete; UNKNOWN blocks deletion.
- Do not infer legacy from names/version suffixes.
- Structural Neon cleanup must be migration-backed and verifiable.
- Vercel production deployment is performed by the user; do not deploy it automatically.
- Preserve separation: Vercel = UI/control plane, Neon = data/state plane, Railway = persistent execution, GitHub Actions = explicit controlled exceptions.
- Never persist secrets in code/docs/issues/logs.
