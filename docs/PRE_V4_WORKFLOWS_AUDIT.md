# PikoFilm — Auditoría PRE-V4 de GitHub Actions y capas generacionales

Fecha: 2026-09-01  
Rama: `pre-v4-readiness`  
Estado: **P1 en curso; no ejecutar borrados todavía**

## 1. Los 8 workflows actuales

| Workflow | Trigger | Función real | Clasificación P1 | Decisión provisional |
|---|---|---|---|---|
| `ci.yml` | PR → main/develop | sintaxis + selfcheck + `test:quality` + build | CANONICAL pero desactualizado | CONSERVAR y corregir |
| `drop-legacy-batch-job-steps.yml` | push a rama cleanup concreta | drop one-shot de tabla legacy | TEMP/MIGRATION | BORRAR cuando DB confirme |
| `imdb-discovery.yml` | manual `workflow_dispatch` | PROC-NOV-001 global | CANONICAL | CONSERVAR |
| `manual-maintenance.yml` | manual | checks read-only acotados | OPERATIONS UTILITY | CONSERVAR o integrar en runbook |
| `neon-access-check.yml` | manual | comprobar conexión/rol/tamaño/version | OPERATIONS UTILITY | CONSERVAR de momento |
| `neon-branch-first-migrations.yml` | PR/push con SQL | probar en rama Neon + aplicar producción tras merge | CANONICAL pero RIESGO ALTO | REDISEÑAR antes de V4 |
| `neon-observability-migration.yml` | manual | migración puntual de observabilidad | TEMP/MIGRATION ONE-SHOT | BORRAR tras confirmar aplicada |
| `revalidate-mov001-tt8442644.yml` | push de marcador específico | revalidación de una sola película | TEMP/DIAGNOSTIC | BORRAR |

## 2. Hallazgo CI-001 — CI sigue llamando “canónicos” a workers legacy

`ci.yml` incluye un paso llamado `Validar workers canónicos` que comprueba expresamente:

- `worker/imdb-discovery.mjs`
- `worker/lifecycle-pikoscore-executor.mjs`
- `worker/lifecycle-worker.mjs`
- `lib/lifecycle-data-stage.mjs`

La auditoría del execution plane ha demostrado que el Batch V1 actual usa `batch-api-worker`, `batch-fast-worker` y requiere `batch-plex-worker`, mientras el Lifecycle worker histórico depende de la arquitectura antigua `batch_jobs`/`batch_job_steps`.

### Consecuencia

CI está protegiendo una generación antigua y, al mismo tiempo, no hace `node --check` explícito de los tres workers Batch V1 que sí componen el execution plane actual.

### Acción PRE-V4 propuesta

Cuando se cierre definitivamente la clasificación Lifecycle:

1. retirar de CI los checks de workers legacy;
2. añadir checks explícitos de `batch-api-worker.mjs`, `batch-fast-worker.mjs`, `batch-plex-worker.mjs`, `technical-snapshot-worker.mjs` e `imdb-discovery.mjs`;
3. conservar `npm run test:quality` y build;
4. asegurar que los tests contractuales cubren la asignación proceso → pool → adapter canónico.

## 3. Hallazgo DBMIG-001 — merge a main puede modificar producción automáticamente

`neon-branch-first-migrations.yml` hace dos cosas distintas:

- en PR: crea una rama Neon efímera y prueba las migraciones modificadas;
- en push a `main`: ejecuta automáticamente esas migraciones contra `DATABASE_URL` de producción y luego sus smoke tests.

Esto es técnicamente coherente con branch-first, pero **no es coherente con la regla PRE-V4 de que cada cambio destructivo/riesgoso tenga evidencia y decisión explícita antes de afectar producción**.

Además, el trigger por `db/migrations/*.sql` significa que un merge de código que incluya DDL puede convertirse directamente en cambio productivo sin una segunda aprobación operacional.

### Decisión propuesta

Para V4, separar:

- **CI de migración:** validar siempre en rama efímera;
- **apply de producción:** manual/approval-gated y trazable.

No modificar todavía el workflow hasta acordar política definitiva de migraciones.

## 4. Workflows one-shot de alta confianza

### `revalidate-mov001-tt8442644.yml`

Es inequívocamente diagnóstico puntual: depende de un marcador `ops/revalidate/tt8442644.final` y ejecuta un script para ese IMDb concreto.

**P2: BORRAR como bloque junto con script y marcadores.**

### `drop-legacy-batch-job-steps.yml`

Sólo escucha la rama `cleanup/drop-batch-job-steps-direct` y existe para retirar `batch_job_steps`.

**P2: BORRAR workflow tras verificación DB.** La migración SQL se tratará según la política histórica de migraciones.

### `neon-observability-migration.yml`

Aplica manualmente una migración concreta (`20260828_process_observability.sql`) y verifica tablas/índices con smoke test transaccional.

La migración ya forma parte de `db/migrations/` y existe un mecanismo genérico branch-first posterior.

**Clasificación:** superseded one-shot.  
**P2:** borrar workflow tras confirmar que observabilidad está aplicada en producción.

## 5. Workflows que sí tienen responsabilidad actual

### `imdb-discovery.yml`

Es manual, recibe un `run_id` canónico de PROC-NOV-001, usa `main` y ejecuta `worker:imdb-discovery`.

**CANONICAL.** Encaja en el modelo GitHub Actions para tareas globales explícitas/excepcionales, no como motor continuo.

### `manual-maintenance.yml`

Sólo permite dos checks read-only (`database-health`, `series-sample`) y limita el sample.

**OPERATIONS UTILITY.** No urge borrarlo. En P6 debe documentarse en RUNBOOK y decidir si aporta valor frente a herramientas directas.

### `neon-access-check.yml`

Sólo comprueba conectividad y metadatos básicos.

**OPERATIONS UTILITY.** Útil mientras el acceso directo a Neon no sea fiable; no es deuda prioritaria.

## 6. Hallazgo UI-LEGACY-001 — las generaciones CSS no están muertas: se cargan todas globalmente

`app/layout.js` importa en el root, simultáneamente:

- `globals.css`
- `v1.css`
- `ux.css`
- `v12.css`
- `v2.css`
- `v3-shell.css`
- `people-v2.css`
- `home-dashboard.css`
- `home-dashboard-v2.css`
- `home-dashboard-v4.css`

Por tanto, los nombres `v1/v2/v3/v4` no identifican ficheros muertos; **hoy todos forman parte del cascade global**.

### Consecuencia

Este es un hotspot de deuda real:

- reglas acumuladas de varias generaciones;
- posible dependencia por especificidad/orden de importación;
- riesgo de regresión visual si se borra cualquier capa individual;
- imposibilidad de entender la UI actual mirando sólo el CSS “más nuevo”.

### Acción V3-final

No borrar por nombre. En P8/P2 se debe:

1. inventariar selectores usados;
2. detectar overrides entre generaciones;
3. consolidar por responsabilidad (`shell`, home, personas, etc.);
4. eliminar el versionado histórico de nombres cuando haya una única hoja canónica;
5. validar visualmente las rutas principales después de cada consolidación.

## 7. Sagas: V3 confirmado como implementación viva

Tanto `/sagas` como `/sagas/[name]` importan desde `lib/sagas-v3` (`getSagasDashboard` y `getSagaDetailV3`).

Esto eleva `sagas-v3` a **CANONICAL** para overview y detalle.

`sagas-v2.js` queda como **LEGACY probable**, pero todavía no se borra hasta revisar acciones/tests/consumidores indirectos.

## 8. PikoScore: wrapper público ya apunta a V3

`lib/pikoscore.js` no contiene una fórmula antigua: funciona como fachada de compatibilidad y reexporta PikoScore V3 (`pikoscore-v3` / `pikoscore-v3-core`).

En cambio `lib/pikoscore-core.mjs` contiene explícitamente `PIKOSCORE_VERSION='2.0.0'` y la fórmula antigua de tres fuentes.

La principal referencia confirmada de `pikoscore-core.mjs` está dentro del Lifecycle worker histórico, que usa `freshnessDays` de esa generación.

### Clasificación provisional

- `pikoscore-v3-core.mjs`: CANONICAL
- `pikoscore-v3.js`: CANONICAL
- `pikoscore.js`: COMPATIBILITY FACADE todavía viva
- `pikoscore-core.mjs`: LEGACY probable ligado al Lifecycle antiguo

No borrar hasta completar consumidores.

## 9. Matriz actualizada de seguridad P2

### Alta confianza para borrar tras último chequeo

- `revalidate-mov001-tt8442644.yml`
- `scripts/revalidate-mov001-once.mjs`
- `ops/diagnose/tt8442644.*`
- `ops/revalidate/tt8442644.*`
- `tmp/validate-saga-availability-*`
- `ci/sagas-v2-*.txt` si ningún workflow los usa
- `neon-observability-migration.yml` si DB confirma aplicada
- `drop-legacy-batch-job-steps.yml` si DB confirma tabla retirada
- `railway.api.toml` + `Dockerfile.api` si no hay consumidor externo

### NO borrar

- Batch API/FAST/Plex workers y configs
- Technical worker/config
- `imdb-discovery.yml`
- `ci.yml` (se corrige, no se elimina)
- CSS generacional individual hasta consolidación
- `pikoscore.js` fachada hasta migrar importadores

### Pendientes críticos

- crear/restaurar executor Railway para pool Plex o redefinir arquitectura SER-002;
- mover Technical Snapshot de rama feature a `main`;
- resolver Lifecycle antiguo + CI que todavía lo protege;
- rediseñar apply de migraciones de producción;
- inventario Neon real bloqueado por conector.
