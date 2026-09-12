# PikoFilm — Documentación canónica

Estado: **fuente de verdad documental viva**.

Este árbol describe PikoFilm **tal como queda después del cierre de V4**. La historia de diseño, contratos intermedios, handoffs y baselines anteriores permanece en Git; no compite con la documentación vigente dentro de `main`.

## Regla de autoridad

1. **Sistema vivo**: código de `main`, esquema real de Neon, servicios Railway, configuración Vercel y workflows GitHub activos.
2. **Tríada canónica V4** de este directorio.
3. **Anexos técnicos especializados** (`PROCESS_CATALOG`, Batch, runbook, reglas de desarrollo).
4. Issues y conversaciones como evidencia de trabajo, nunca como autoridad superior.

Si el sistema vivo contradice un documento, se verifica la implementación real y se corrige la documentación en el mismo bloque.

## Entrada obligatoria para una nueva sesión

1. `/AGENTS.md`
2. `AI_DEVELOPMENT_GUIDE.md`
3. `PROJECT_RULES.md`
4. `V4_FUNCTIONAL_SPEC.md`
5. `V4_ARCHITECTURE.md`
6. `V4_UX_SPEC.md`
7. `processes/PROCESS_CATALOG.md` si se toca un proceso
8. `processes/BATCH_ARCHITECTURE.md` si se toca Batch/workers/leases/retry/concurrencia
9. `operations/RUNBOOK.md` si se toca operación/infraestructura

## Tríada canónica V4

### `V4_FUNCTIONAL_SPEC.md`

Autoridad para **qué hace PikoFilm**:

- propósito y no-objetivos;
- Lifecycle;
- Inicio;
- Catálogo y Excluidas;
- Ficha;
- Novedades;
- Calidad, Películas y Series;
- Personas;
- Sagas;
- PikoQuality;
- Actividad y calendario;
- Operaciones, incidencias y recuperación;
- políticas de mantenimiento automático/manual;
- cadencias y reglas funcionales;
- semántica de estados.

### `V4_ARCHITECTURE.md`

Autoridad para **cómo está construido PikoFilm**:

- Vercel / Neon / Railway / GitHub Actions;
- capas de ejecución;
- clasificación de persistencia;
- datos canónicos y read models;
- operación canónica y paridad individual/Batch;
- Batch Engine;
- gobierno de APIs fail-closed;
- observabilidad;
- retención 30 días;
- planner y crons;
- seguridad, rendimiento, CI y deployment.

### `V4_UX_SPEC.md`

Autoridad para **cómo debe sentirse y comportarse la interfaz**:

- Shell y navegación;
- jerarquía visual;
- tablas/listas/móvil;
- filtros y estado de URL;
- comportamiento pantalla por pantalla;
- errores/empty/loading;
- acciones peligrosas;
- microcopy y estados;
- Actividad ↔ Operaciones;
- rendimiento UX y criterios de validación.

## Anexos técnicos especializados

### Procesos

- `processes/PROCESS_CATALOG.md` — inventario ejecutable de PROC, cores, executors y paridad.
- `processes/BATCH_ARCHITECTURE.md` — mecánica específica del Batch Engine.

Estos documentos **complementan** la tríada y contienen más detalle de implementación en su ámbito. No redefinen el producto.

### Operaciones

- `operations/RUNBOOK.md` — procedimientos de operación y recuperación.

### Desarrollo AI-first

- `AI_DEVELOPMENT_GUIDE.md`
- `PROJECT_RULES.md`
- `development/AI_CHANGE_CHECKLIST.md`
- `/AGENTS.md`

## Baseline de V4

La tríada documenta el estado de `main` posterior al merge del PR #511, commit:

`323b1cd4dd2cc8b5def081bc98ab094006df3efe`

Ese commit cierra las verticales funcionales V4 y sirve como baseline documental de esta consolidación. Los antiguos `BASELINE_V4_START.md` y `CURRENT_V4_HANDOFF.md` eran documentos de transición y ya no forman parte del presente del sistema.

La última ronda de aceptación previa a V5 queda persistida en `V4_FINAL_GATE_2026-09-12.md`. Ese documento no sustituye la tríada: registra las verificaciones transversales, remediaciones de cierre y gates productivos que deben demostrarse antes de declarar V4 congelada y reabrir C074+.

## Documentos sustituidos

La tríada sustituye y retira como fuentes activas:

- los contratos V4 separados por vertical de `docs/product/`;
- `PRODUCT_AND_LIFECYCLE.md`;
- `V4_UX_FOUNDATION.md` y refinamientos UX intermedios;
- las cuatro arquitecturas PRE-V4 de `docs/architecture/`;
- baseline/handoff de arranque o continuidad V4.

Su historia permanece íntegra en Git.

## Regla documental permanente

No crear una segunda fuente de verdad para el mismo concepto.

Un cambio futuro debe actualizar:

- `V4_FUNCTIONAL_SPEC.md` si cambia comportamiento o regla de producto;
- `V4_ARCHITECTURE.md` si cambia una frontera, fuente de verdad, persistencia, executor, gobierno, observabilidad o infraestructura;
- `V4_UX_SPEC.md` si cambia navegación, jerarquía o comportamiento de interfaz;
- `PROCESS_CATALOG.md` si cambia un proceso concreto;
- `BATCH_ARCHITECTURE.md` si cambia la mecánica Batch;
- runbook si cambia un procedimiento operativo.

La documentación se modifica **en el mismo bloque que el código**. No existe una fase posterior de “ya lo documentaremos”.