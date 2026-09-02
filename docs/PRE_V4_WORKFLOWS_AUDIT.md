# PikoFilm — Auditoría PRE-V4 de GitHub Actions y capas generacionales

Fecha: 2026-09-01  
Rama: `pre-v4-readiness`  
Estado: **P1/P2 auditado; sin borrados nuevos en este bloque**

## 1. Workflows actuales en `pre-v4-readiness`

La rama contiene actualmente 7 workflows:

| Workflow | Trigger | Función real | Clasificación | Decisión |
|---|---|---|---|---|
| `ci.yml` | PR → main/develop | sintaxis + selfcheck + `test:quality` + build | CANONICAL | CONSERVAR |
| `drop-legacy-batch-job-steps.yml` | push a rama cleanup concreta | drop one-shot de tabla legacy | TEMP/MIGRATION | BORRAR sólo cuando Neon confirme |
| `imdb-discovery.yml` | manual `workflow_dispatch` | PROC-NOV-001 global | CANONICAL + FRONTEND=SÍ | CONSERVAR |
| `manual-maintenance.yml` | manual | checks read-only acotados | OPERATIONS UTILITY | CONSERVAR |
| `neon-access-check.yml` | manual | comprobar conexión/rol/tamaño/version | OPERATIONS UTILITY | CONSERVAR mientras NEON-001 siga activo |
| `neon-branch-first-migrations.yml` | PR/push con SQL | probar en rama Neon + aplicar producción tras merge | CANONICAL, policy debt | CONSERVAR; revisar política antes de V4 |
| `neon-observability-migration.yml` | manual | migración puntual de observabilidad | TEMP/MIGRATION ONE-SHOT | BORRAR sólo tras confirmar aplicada |

El antiguo `revalidate-mov001-tt8442644.yml` ya no existe en la rama PRE-V4.

## 2. CI-001 — resuelto

El CI ya fue actualizado durante P2-C para dejar de proteger el worker Lifecycle histórico y comprobar los workers Batch actuales. Se conservan además Discovery, PikoScore V3, tests de calidad y build.

**Estado: RESUELTO.**

## 3. DBMIG-001 — riesgo acotado, deuda de política pendiente

`neon-branch-first-migrations.yml` tiene filtros de ruta tanto en PR como en push a `main`:

- sólo se activa si cambia `db/migrations/*.sql`;
- en PR prueba las migraciones modificadas sobre una rama Neon efímera;
- en push a `main`, si hay migraciones nuevas/modificadas, las aplica a `DATABASE_URL` de producción y ejecuta los smoke tests asociados.

Consecuencia importante: los hotfixes recientes de Railway/Plex que sólo tocaron Docker/configuración/código no disparan este workflow.

Sigue existiendo una deuda de política PRE-V4: un merge que sí incluya DDL bajo `db/migrations/*.sql` puede aplicar producción automáticamente. Para V4 conviene separar claramente:

1. validación branch-first en CI;
2. apply de producción manual/approval-gated y trazable.

**Estado: riesgo técnico ACOTADO; policy debt ABIERTA.**

## 4. Workflows one-shot bloqueados por Neon

### `drop-legacy-batch-job-steps.yml`

Sólo escucha `cleanup/drop-batch-job-steps-direct` y ejecuta una auditoría de dependencias antes de aplicar `20260831_drop_legacy_batch_job_steps.sql`.

No existe consumidor frontend directo del workflow, pero su efecto es destructivo en base de datos. El frontend safety gate no basta para autorizar su retirada ni ejecución: primero debe verificarse el estado real de `batch_job_steps` en producción.

**Clasificación: TEMP/MIGRATION — BLOCKED BY NEON-001.**

### `neon-observability-migration.yml`

Es `workflow_dispatch`, aplica `20260828_process_observability.sql`, verifica `process_runs`, `process_run_errors`, `process_run_events` e índices y hace smoke transaccional.

Es one-shot y conceptualmente superseded por el mecanismo genérico branch-first, pero no se borra hasta confirmar que observabilidad ya está aplicada en producción.

**Clasificación: TEMP/MIGRATION — BLOCKED BY NEON-001.**

## 5. `imdb-discovery.yml` — frontend safety gate completado

Cadena comprobada:

`/novedades` → botón visible `Buscar novedades` → `requestNewsDiscoveryAction` → crea run `PROC-NOV-001` en `process_runs` → dispatch GitHub de `imdb-discovery.yml` con `run_id` → workflow hace checkout de `main` → `npm run worker:imdb-discovery` → `worker/imdb-discovery.mjs`.

Por tanto:

- **FRONTEND=SÍ**;
- **CANONICAL**;
- no borrar, renombrar ni sustituir sin decisión explícita del usuario y migración completa de la cadena frontend→executor.

## 6. `manual-maintenance.yml`

Sólo admite tareas manuales acotadas y read-only:

- `database-health`;
- `series-sample`, con límite 1–10.

Ejecuta `scripts/manual-check.mjs` contra `DATABASE_URL`.

No forma parte de un botón frontend conocido y no es execution plane continuo. Aporta valor operativo, especialmente mientras el conector Neon no permita inspección fiable.

**Clasificación: OPERATIONS UTILITY — CONSERVAR.**

## 7. `neon-access-check.yml`

Es manual y read-only. Comprueba conexión real, database, role, tamaño y versión de PostgreSQL mediante `psql`.

Mientras NEON-001 siga bloqueando `get_database_tables`/`describe_branch`/SQL directo del conector, este workflow conserva valor diagnóstico.

**Clasificación: OPERATIONS UTILITY — CONSERVAR.**

## 8. UI-LEGACY-001 — CSS global generacional sigue protegido

`app/layout.js` carga varias hojas generacionales globales. No se debe inferir que `v1/v2/v3/v4` son ficheros muertos por nombre. La consolidación requiere inventario de selectores, overrides y validación visual ruta por ruta.

**Estado: DEUDA UX/P8; no borrar por nombre.**

## 9. Sagas

`/sagas` y `/sagas/[name]` usan `lib/sagas-v3`, que queda CANONICAL para lectura/dashboard.

`lib/sagas-v2.js` sigue presente y contiene `refreshSagas()`/PROC-SAGA-001 con writes reales a `saga_collections` y `saga_collection_members`. La búsqueda de código no devuelve importadores actuales y el árbol no muestra un fichero adicional obvio que lo consuma, pero la ausencia de resultados de code-search no es evidencia suficiente por sí sola para borrar.

**Clasificación actual: `sagas-v2.js` = LEGACY PROBABLE / INVESTIGAR.**

Frontend safety gate para borrado: **UNKNOWN** hasta demostrar exhaustivamente que ningún action, test, script o import dinámico lo consume.

## 10. Novedades — componentes Plex antiguos detectados

En el árbol actual siguen presentes:

- `app/novedades/NovedadesPlexShell.js`;
- `app/novedades/PlexIntake.js`.

`app/novedades/layout.js` actualmente devuelve únicamente `children`, por lo que no monta `NovedadesPlexShell` ni `PlexIntake`. La página actual `/novedades` implementa directamente su bloque operativo y usa `PlexSyncButton`, acciones de identidad Plex y cola unificada.

Las búsquedas de código por `NovedadesPlexShell` y `PlexIntake` no devolvieron consumidores. Esto los convierte en candidatos fuertes a DEAD/LEGACY, pero se mantiene el gate conservador:

- `NovedadesPlexShell.js`: **DEAD probable / FRONTEND=NO probable**;
- `PlexIntake.js`: **LEGACY probable / FRONTEND=NO probable**;
- decisión destructiva: **NO APROBADA TODAVÍA**, hasta completar un último chequeo de consumidores/import dinámico y contraste con tests.

## 11. PikoScore

- `pikoscore-v3-core.mjs`: CANONICAL
- `pikoscore-v3.js`: CANONICAL
- `pikoscore.js`: COMPATIBILITY FACADE viva
- `pikoscore-core.mjs`: LEGACY probable

No borrar la fachada ni el core antiguo hasta cerrar importadores restantes.

## 12. Estado PRE-V4 actualizado

Resueltos o confirmados:

- CI-001 resuelto;
- Plex Batch executor productivo restaurado;
- Technical Snapshot migrado a `main` y rama feature eliminada;
- `imdb-discovery.yml` confirmado frontend-consumed y canónico;
- DBMIG-001 no se dispara por cualquier push: sólo por cambios en `db/migrations/*.sql`.

Bloqueos/deuda activos:

- NEON-001 impide inventario y limpieza P3;
- dos workflows one-shot Neon no se borran hasta verificar producción;
- CSS generacional requiere P8;
- `sagas-v2.js`, `NovedadesPlexShell.js`, `PlexIntake.js`, `pikoscore-core.mjs` siguen en investigación conservadora;
- la política de apply automático de migraciones a producción debe revisarse antes de V4.
