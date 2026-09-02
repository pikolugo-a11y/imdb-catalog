# PikoFilm — Documentación canónica

Estado: **fuente de verdad documental viva**.

Este árbol contiene únicamente documentación necesaria para comprender y modificar el sistema actual. La historia anterior permanece en Git y en issues cerradas; no se conserva documentación histórica dentro de `main` cuando pueda confundir a una persona o a una IA.

## Entrada obligatoria

1. `/AGENTS.md`
2. `AI_DEVELOPMENT_GUIDE.md`
3. `PROJECT_RULES.md`
4. `PRE_V4_READINESS_PLAN.md` mientras PRE-V4 siga activo
5. `processes/PROCESS_CATALOG.md`
6. `processes/BATCH_ARCHITECTURE.md`
7. documentación canónica del dominio afectado

**El sistema vivo manda.** Si código, Neon, Railway, Vercel o GitHub Actions contradicen un documento, se verifica la implementación viva y se corrige la documentación en el mismo bloque.

## Mapa canónico

### Producto
- `product/PRODUCT_AND_LIFECYCLE.md`

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

### PRE-V4
- `PRE_V4_READINESS_PLAN.md` es el único documento temporal de PRE-V4 que se mantiene durante el cierre.
- Al superar el gate final, debe sustituirse por un único baseline/cierre final o eliminarse si `README.md` y la arquitectura ya contienen todo lo necesario.

## Regla documental

No crear una segunda fuente de verdad para el mismo concepto. Un cambio funcional o arquitectónico debe revisar el catálogo de procesos, Batch si aplica, arquitectura/producto/operaciones afectadas y esta entrada documental.

Los planes V2/V3, auditorías intermedias, ledgers, tombstones, informes de ramas y documentación PRE-V4 de fases cerradas **no pertenecen al árbol documental vigente**. Git conserva su historia.
