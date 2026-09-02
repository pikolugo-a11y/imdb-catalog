# PikoFilm AI instructions

Before changing this repository, read and follow:

1. `/AGENTS.md`
2. `/docs/AI_DEVELOPMENT_GUIDE.md`
3. `/docs/PROJECT_RULES.md`
4. `/docs/PRE_V4_READINESS_PLAN.md` while PRE-V4 remains active
5. `/docs/processes/PROCESS_CATALOG.md` and `/docs/processes/BATCH_ARCHITECTURE.md` when working on processes or Batch

Do not rely on chat/session memory as the project source of truth. Reconstruct context from the repository and verify against the live system when necessary.

Critical architecture rule: individual and Batch execution must call the same canonical business operation. Batch may orchestrate selection, queues, leases, concurrency, retries and metrics, but must not maintain a second copy of functional logic.

Any functional or architectural modification must include the corresponding canonical documentation update in the same change.
