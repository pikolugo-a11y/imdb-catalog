# PikoFilm — AI development entrypoint

PikoFilm is maintained primarily with AI-assisted engineering. Any AI agent, coding assistant or new chat/session MUST treat this file as the first repository entrypoint.

## Mandatory startup sequence

Before proposing or changing behavior, read:

1. `docs/AI_DEVELOPMENT_GUIDE.md`
2. `docs/PROJECT_RULES.md`
3. `docs/PRE_V4_READINESS_PLAN.md` while PRE-V4 remains active
4. `docs/README.md` — canonical documentation map
5. `docs/processes/PROCESS_CATALOG.md`
6. `docs/processes/BATCH_ARCHITECTURE.md`
7. canonical architecture/product/operations documentation for the affected domain

The live system wins over stale documentation. If code, Neon, Railway, Vercel, GitHub Actions and docs disagree, verify the live implementation first and update documentation in the same work block.

## Non-negotiable process rule

Every functional process has one canonical business operation. Batch is orchestration only.

`individual -> process_run -> canonical operation X`

`Batch -> queue/orchestration -> child process_run -> canonical operation X`

A Batch worker must not contain a copied or independently evolving recipe. If individual behavior changes, Batch inherits it through the same canonical core. Deliberate guard/postprocessing differences must be explicit and contract-tested.

## Documentation is implementation

A change is incomplete if it alters architecture, behavior, process flow, Lifecycle, persistence, executor, external sources, retry/error behavior, Batch, observability, infrastructure or operations without reviewing the canonical docs.

Use `docs/development/AI_CHANGE_CHECKLIST.md` before delivering significant changes.

## New-chat continuity

Do not use conversation memory as source of truth. Recover context from the repository. Historical documents are evidence only; discover current authority through `docs/README.md`.

## Safety

- Audit before delete; UNKNOWN blocks deletion.
- Do not infer legacy from names/version suffixes.
- Structural Neon cleanup must be migration-backed and verifiable.
- Vercel production deployment is performed by the user; do not deploy it automatically.
- Preserve separation: Vercel = UI/control plane, Neon = data/state plane, Railway = persistent execution, GitHub Actions = explicit controlled exceptions.
- Never persist secrets in code/docs/issues/logs.