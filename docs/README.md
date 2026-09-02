# PikoFilm — Documentación canónica

Estado: **fuente de verdad documental viva**.

Este árbol contiene únicamente documentación necesaria para comprender y modificar el sistema actual. La historia anterior permanece en Git y en issues cerradas; no se conserva documentación histórica dentro de `main` cuando pueda confundir a una persona o a una IA.

## Entrada obligatoria

1. `/AGENTS.md`
2. `AI_DEVELOPMENT_GUIDE.md`
3. `PROJECT_RULES.md`
4. `BASELINE_V4_START.md`
5. `processes/PROCESS_CATALOG.md`
6. `processes/BATCH_ARCHITECTURE.md`
7. documentación canónica del dominio afectado

**El sistema vivo manda.** Si código, Neon, Railway, Vercel o GitHub Actions contradicen un documento, se verifica la implementación viva y se corrige la documentación en el mismo bloque.

## Mapa canónico

### Producto
- `product/PRODUCT_AND_LIFECYCLE.md`
- `product/V4_UX_FOUNDATION.md` — conclusiones del frontal V3 que sirven como contexto de arranque para diseñar V4; no es backlog ni especificación cerrada.

### Arquitectura
- `architecture/SYSTEM_ARCHITECTURE.md`
- `architecture/DATA_ARCHITECTURE.md`
- `architecture/EXECUTION_ARCHITECTURE.md`
- `architecture/OBSERVABILITY.md`

### Procesos
- `processes/PROCESS_CATALOG.md`
- `processes/BATCH_ARCHITECTURE.md`

### Operaciones
- `operations/RUNBOOK.md`

### Desarrollo AI-first
- `AI_DEVELOPMENT_GUIDE.md`
- `PROJECT_RULES.md`
- `development/AI_CHANGE_CHECKLIST.md`
- `/AGENTS.md`

### Baseline V4
- `BASELINE_V4_START.md` fija el cierre PRE-V4 y el commit de partida auditado para V4.
- V4 crea decisiones e issues desde cero; no hereda automáticamente propuestas V3/PRE-V4.

## Regla documental

No crear una segunda fuente de verdad para el mismo concepto. Un cambio funcional o arquitectónico debe revisar el catálogo de procesos, Batch si aplica, arquitectura/producto/operaciones afectadas y esta entrada documental.

Los planes V2/V3, auditorías intermedias, ledgers, tombstones, informes de ramas y documentación PRE-V4 de fases cerradas **no pertenecen al árbol documental vigente**. Git conserva su historia.
