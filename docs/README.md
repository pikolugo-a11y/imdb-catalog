# PikoFilm — Documentación canónica

Estado: **fuente de verdad documental viva**.

Este índice permite reconstruir PikoFilm desde el repositorio sin depender de conversaciones anteriores.

## Entrada obligatoria para IA

1. `/AGENTS.md`
2. `/docs/AI_DEVELOPMENT_GUIDE.md`
3. `/docs/PROJECT_RULES.md`
4. `/docs/PRE_V4_READINESS_PLAN.md` mientras PRE-V4 siga activo
5. este índice
6. `/docs/processes/PROCESS_CATALOG.md`
7. `/docs/processes/BATCH_ARCHITECTURE.md`
8. documentación canónica del dominio afectado

**El sistema vivo manda.** Si código, Neon, Railway, Vercel o GitHub Actions contradicen un documento, se verifica la implementación viva y se corrige la documentación en el mismo bloque.

## Mapa canónico

### Producto
- `product/PRODUCT_AND_LIFECYCLE.md` — propósito, dominios y contrato Lifecycle.

### Arquitectura
- `architecture/SYSTEM_ARCHITECTURE.md` — fronteras Vercel/Neon/Railway/GitHub Actions.
- `architecture/DATA_ARCHITECTURE.md` — capas de datos y fuentes de verdad.
- `architecture/EXECUTION_ARCHITECTURE.md` — executors y modelo de ejecución.
- `architecture/OBSERVABILITY.md` — `process_runs` y tracing canónico.
- `CANONICAL_DATA.md` — detalle vigente de normalización de países/géneros.
- `INFRASTRUCTURE_EFFICIENCY.md` — reglas de coste/eficiencia vigentes.

### Procesos
- `processes/PROCESS_CATALOG.md` — inventario maestro de PROC vivos/retirados, cores y paridad.
- `processes/BATCH_ARCHITECTURE.md` — Batch Engine, pools y contrato individual/Batch.

### Operaciones
- `operations/RUNBOOK.md` — intervención, incidentes, Railway, Neon, Vercel, GHA y rollback.

### Desarrollo AI-first
- `AI_DEVELOPMENT_GUIDE.md` — contrato de desarrollo con IA.
- `PROJECT_RULES.md` — reglas permanentes.
- `development/AI_CHANGE_CHECKLIST.md` — checklist ejecutable antes de entregar cambios.
- `/AGENTS.md` — entrypoint raíz.

### PRE-V4
- `PRE_V4_READINESS_PLAN.md` — gate maestro mientras PRE-V4 esté activo.
- Los demás `PRE_V4_*` son evidencia/auditoría histórica de fases; no sustituyen las fuentes canónicas.

## Documentación histórica

Un documento histórico puede conservar valor como evidencia, pero no es automáticamente una especificación vigente.

- `LIFECYCLE_CANONICAL_PROCESSES.md` — **RETIRADO**; no usar para implementar.
- `LIFECYCLE_IMPLEMENTATION_8_PHASES.md` — plan histórico de implementación; no prevalece sobre arquitectura/procesos actuales.
- `BATCH_AUTOPILOT_ARCHITECTURE.md` — generación histórica; la fuente Batch vigente es `processes/BATCH_ARCHITECTURE.md`.
- `FUNCTIONAL_SPECIFICATION_V2.md` — especificación de generación anterior; consultar sólo como evidencia hasta que una sección sea verificada contra el sistema vivo. El contrato funcional actual parte de `product/PRODUCT_AND_LIFECYCLE.md` + `PROCESS_CATALOG.md`.
- documentos `PRE_V4_*` cerrados — evidencia de auditoría, no arquitectura permanente.

Si otro documento contradice este mapa, `AGENTS.md`, el catálogo canónico o el sistema vivo, debe tratarse como candidato a consolidación/retirada y no como autoridad por antigüedad o nombre.

## Regla documental no negociable

Un cambio funcional o arquitectónico no está terminado hasta revisar su impacto documental. Como mínimo:

`AGENTS.md → AI_DEVELOPMENT_GUIDE → PROCESS_CATALOG → BATCH_ARCHITECTURE → architecture/product/operations afectado → PRE-V4/roadmap si aplica`.

No crear una segunda fuente de verdad para explicar el mismo concepto. Las decisiones duraderas deben quedar en código, tests, datos, issues o documentación versionada; nunca sólo en una conversación.
