# PRE-V4 — GitHub remainder / cuarto gate P2

Fecha: 2026-09-01
Rama: `pre-v4-readiness`

## 1. Estado de PR abiertas

Tras cerrar #211–#218 quedan exactamente 3 PR abiertas:

- #261 `fix(data): acelerar Calidad Datos y corregir layout`
- #258 `feat(data): observabilidad completa y carga más legible`
- #99 `docs: documentar PA-001 Actualizar datos de una película`

## 2. PR #261

La rama `fix/data-quality-fast-layout` está 5 commits por delante y 762 por detrás de `main`.

La idea útil no absorbida es arquitectónica: mover agregaciones, clasificación operativa, filtros, ordenación, resumen y paginación de Calidad → Datos a PostgreSQL para evitar cargar todo el universo en Node/Vercel.

No debe mergearse literalmente porque `main` ha evolucionado cientos de commits y las reglas actuales deben prevalecer. Se ha preservado la deuda válida en el issue #449:

`PERF — Calidad Datos: mover clasificación y paginación a PostgreSQL`.

Frontend gate: cerrar la PR sin merge no cambia el frontend desplegado ni ningún botón/control actual. Estado para cierre: `FRONTEND=NO`.

Clasificación: `SUPERSEDED / IDEA RESCATADA EN #449`.

## 3. PR #258

La rama `feat/data-quality-observability-performance` está 4 commits por delante y 773 por detrás de `main`.

Contiene tres líneas de trabajo históricas:

1. una optimización SQL parcial, ya cubierta de forma más completa por el objetivo preservado en #449;
2. cambios visuales de Calidad → Datos, que no deben importarse desde una rama antigua porque el frontend actual es la referencia validada;
3. logging de bodies HTTP completos de proveedores.

La propuesta de logging completo no se adopta como default PRE-V4: elimina el truncado y persiste el body sanitizado completo en auditoría. Aunque enmascara ciertos tokens, aumenta volumen, retención y superficie de datos sin una política explícita.

Frontend gate: cerrar sin merge no cambia el frontend actual. Estado: `FRONTEND=NO`.

Clasificación: `SUPERSEDED / NO MERGE`; optimización útil absorbida conceptualmente por #449, logging completo rechazado como default.

## 4. PR #99 — NO cerrar todavía

La PR documental contiene 23 ficheros (`INDICE` + PA-001…PA-022) y está 25 commits por delante / 1449 por detrás de `main`.

Es una fuente histórica útil, pero no representa el sistema vivo. El propio índice afirma, entre otras cosas, que no existe cron funcional y que `vercel.json` no define crons; el PRE-V4 vivo ya comprobó un cron Vercel `/api/cron/dashboard-snapshot` a las 02:15.

También documenta generaciones de procesos anteriores a la arquitectura canónica Batch/observability actual.

Decisión: conservar abierta temporalmente como fuente de extracción hasta P5 `PROCESS_CATALOG`. Después, cerrar sin merge una vez que cualquier información aún válida esté incorporada a documentación canónica actual.

Clasificación: `HISTORICAL SOURCE / DO NOT MERGE / HOLD UNTIL P5`.

## 5. Workflows actuales

Quedan 7 workflows en la rama PRE-V4:

- `ci.yml` — CANONICAL, ya actualizado a workers actuales.
- `imdb-discovery.yml` — CANONICAL probable; debe conservarse y terminar su traza frontend.
- `manual-maintenance.yml` — utilidad operativa; conservar por ahora.
- `neon-access-check.yml` — utilidad operativa; conservar.
- `neon-branch-first-migrations.yml` — política DB a revisar; actualmente puede aplicar migraciones de producción desde main y no se toca hasta P3/política explícita.
- `drop-legacy-batch-job-steps.yml` — one-shot TEMP de retirada de tabla histórica.
- `neon-observability-migration.yml` — one-shot TEMP de aplicación/verificación de observabilidad.

Los dos workflows one-shot Neon NO se borran todavía porque NEON-001 impide verificar de forma fiable el estado real de producción. El primero incluso contiene un DROP de `batch_job_steps`; el segundo aplica `20260828_process_observability.sql` y hace smoke test.

Estado: `BLOCKED BY NEON-001` para borrado de ambos.

## 6. Ramas

La rama accidental `pre-v4-audit-tmp` es idéntica a `main`: 0 ahead / 0 behind, sin commits únicos. Es candidata segura a eliminar cuando exista una acción de borrado de refs disponible.

`pre-v4-readiness` se conserva hasta terminar PRE-V4.

`feat/pikoquality-technical-snapshot` se conserva mientras Railway siga utilizándola como source. No puede eliminarse antes de migrar el source a `main` y verificar deployment equivalente.

Existe también `archive/railway-pikoquality-technical-snapshot-20260901`; no se toca hasta cerrar la estrategia de source/rollback de Technical Snapshot.

Las ramas head de #258/#261 se podrán retirar sólo después de cerrar las PR y con una acción de borrado de refs disponible. La integración GitHub disponible en esta sesión no expone borrado de ramas, por lo que no se realizará ninguna simulación ni workaround destructivo.

## 7. Cuarto lote P2 propuesto

Con la idea útil preservada en issue #449 y sin impacto runtime/frontend:

1. cerrar #261 sin merge, dejando comentario PRE-V4 enlazando #449;
2. cerrar #258 sin merge, dejando comentario PRE-V4 indicando que la mejora de rendimiento queda en #449 y que el logging completo no se adopta como default.

No cerrar #99 todavía.
No borrar workflows Neon todavía.
No borrar ramas todavía.

**Estado:** CUARTO LOTE P2 LISTO PARA DECISIÓN EXPLÍCITA.
