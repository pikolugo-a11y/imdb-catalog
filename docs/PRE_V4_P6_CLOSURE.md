# PRE-V4 — Cierre P6 Documentación

Fecha: 2026-09-02.

## Resultado

**P6 CERRADO documentalmente** cuando la PR asociada pase CI y sea fusionada a `main`.

## Fuentes canónicas consolidadas

- `AGENTS.md` — entrypoint obligatorio para IA.
- `docs/README.md` — mapa de autoridad documental.
- `docs/AI_DEVELOPMENT_GUIDE.md` + `docs/PROJECT_RULES.md` — contrato de desarrollo.
- `docs/product/PRODUCT_AND_LIFECYCLE.md` — producto/Lifecycle.
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — arquitectura física.
- `docs/architecture/DATA_ARCHITECTURE.md` — datos.
- `docs/architecture/EXECUTION_ARCHITECTURE.md` — ejecución.
- `docs/architecture/OBSERVABILITY.md` — observabilidad.
- `docs/processes/PROCESS_CATALOG.md` — inventario de procesos.
- `docs/processes/BATCH_ARCHITECTURE.md` — Batch vigente.
- `docs/operations/RUNBOOK.md` — operación/recuperación.
- `docs/development/AI_CHANGE_CHECKLIST.md` — control de cambios AI-first.

## Deuda documental eliminada

Se neutralizaron como fuentes de verdad las generaciones históricas que podían reintroducir arquitectura obsoleta:
- `FUNCTIONAL_SPECIFICATION_V2.md`;
- `LIFECYCLE_CANONICAL_PROCESSES.md`;
- `LIFECYCLE_IMPLEMENTATION_8_PHASES.md`;
- `BATCH_AUTOPILOT_ARCHITECTURE.md`.

Se conservan como tombstones y el historial completo permanece en Git.

## Corrección P5 incorporada

`processes/BATCH_ARCHITECTURE.md` se alineó con el cierre real de P5:
- PER-001 = core compartido, paridad EXACTA, sin doble observabilidad;
- SER-003/004 = PARCIAL controlada y protegida por contrato;
- PQ-001 = un `process_run` canónico, sin writes de chunks a `pipeline_runs`;
- Batch V1 retirado.

## Compatibilidades que P6 NO autoriza a borrar

- `pipeline_runs` — histórica; requiere gate de consumidores antes de retirada física.
- `series_quality_runs` — temporal y todavía con consumidores vivos.

## Siguiente fase

P7 — limpiar issues para que las abiertas representen únicamente trabajo futuro real. La documentación PRE-V4 cerrada puede usarse para decidir qué issues están completed/superseded/V4 backlog.

Después: P8 — auditoría funcional/UX completa con aceptación ejecutada por el usuario según `PROJECT_RULES.md`.
