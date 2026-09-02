# PikoFilm — AI development entrypoint

This repository is developed and maintained primarily with AI-assisted engineering. Any AI agent, coding assistant, or new chat/session working on PikoFilm MUST treat this file as the first repository entrypoint.

## Mandatory startup sequence

Before proposing or changing application behavior, read at least:

1. `docs/AI_DEVELOPMENT_GUIDE.md`
2. `docs/PROJECT_RULES.md`
3. `docs/PRE_V4_READINESS_PLAN.md` while PRE-V4 remains active
4. `docs/processes/PROCESS_CATALOG.md` when it exists / is being built
5. `docs/processes/BATCH_ARCHITECTURE.md` when it exists / is being built
6. the domain documentation referenced by the process or component being changed

The live system wins over stale documentation. If code, Neon, Railway, Vercel, GitHub Actions, and docs disagree, verify the live implementation first and update the documentation in the same work block.

## Non-negotiable process rule

Every functional process has one canonical business operation. Batch is orchestration only.

Required shape:

`individual trigger -> canonical operation X`

`Batch trigger -> queue/orchestration -> canonical operation X`

A Batch worker must not contain a copied or independently evolving version of the functional logic. If the individual operation changes, Batch must inherit that change automatically through the same canonical operation.

Any deviation is priority technical debt and must be recorded in `docs/processes/PROCESS_CATALOG.md` and `docs/processes/BATCH_ARCHITECTURE.md` until removed.

## Documentation is part of the implementation

A code change is incomplete if it changes architecture, behavior, process flow, Lifecycle, persistence, executor, external sources, retry/error behavior, Batch behavior, observability, infrastructure, or operational procedure without updating the canonical docs that describe it.

Before finishing a change, perform a documentation impact check using `docs/AI_DEVELOPMENT_GUIDE.md`.

## New-chat continuity

Do not rely on conversation memory as the source of truth. Recover project context from this repository. The repository must contain enough current documentation for a new AI session to understand the application, identify the canonical implementation, and continue development safely.

## Safety

- Audit before delete.
- Do not infer legacy status from a name or version suffix alone.
- Structural Neon cleanup must be migration-backed and verifiable.
- Do not deploy automatically unless the user explicitly authorizes it.
- Preserve the separation: Vercel = UI/control plane, Neon = data/state plane, Railway = persistent/heavy execution where required, GitHub Actions = explicit exceptional jobs/workflows.
