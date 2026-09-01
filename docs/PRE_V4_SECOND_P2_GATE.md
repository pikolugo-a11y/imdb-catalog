# PRE-V4 — Segundo gate P2

Fecha: 2026-09-01
Rama: `pre-v4-readiness`

Este documento prepara y registra el segundo lote destructivo PRE-V4.

## 1. Railway vivo revalidado

Proyecto `PikoFilm Batch`, entorno `production`.

Servicios canónicos observados antes del lote:

- `pikofilm-batch-fast-worker-v1` → repo `pikolugo-a11y/imdb-catalog`, rama `main`, `Dockerfile.batch-fast`, start `node worker/batch-fast-worker.mjs`.
- `pikofilm-worker-api-v3` → rama `main`, `Dockerfile.batch-api`, config `railway.batch-api.toml`, start `npm run worker:batch-api`.
- `pikofilm-technical-snapshot-worker-v1` → rama `feat/pikoquality-technical-snapshot`, `Dockerfile.technical`, config `railway.technical.toml`, start `node worker/technical-snapshot-worker.mjs`.
- `pikofilm-backup-temp` → imagen `postgres:18`, comando puramente diagnóstico que imprime disponibilidad de utilidades y duerme 300 segundos; restart `NEVER`.

No existía servicio vivo que usara:

- `railway.api.toml`
- `Dockerfile.api`
- `railway.lifecycle.toml`
- `Dockerfile.lifecycle`
- `Dockerfile.worker`
- `worker/entrypoint.mjs`

## 2. `railway.api.toml` + `Dockerfile.api`

Clasificación: `DEAD/LEGACY`, confianza muy alta.

`railway.api.toml` ordenaba arrancar `node worker/batch-api.mjs`, fichero inexistente en la rama PRE-V4.

`Dockerfile.api` tampoco arrancaba el Batch API actual: usaba `worker/entrypoint.mjs`. El Batch API productivo usa `Dockerfile.batch-api` + `railway.batch-api.toml` + `worker/batch-api-worker.mjs`.

Frontend gate: `NO`.

### Ejecución

Aprobado por el usuario y eliminado físicamente en `pre-v4-readiness`:

- `railway.api.toml` → commit de borrado `d137946eb44c07380cf04d724ac2755fd6ee557b`.
- `Dockerfile.api` → commit de borrado `521ef99381fddb3f65284a388f34232cbc2bdef9`.

Estado: **P2 COMPLETADO para esta pareja**.

## 3. Generic `Dockerfile.worker` + `worker/entrypoint.mjs`

Clasificación actual: `LEGACY/COMPATIBILITY`, todavía NO incluido en el lote ejecutado.

`Dockerfile.worker` arranca `worker/entrypoint.mjs`.

El entrypoint contiene una afirmación obsoleta: bloquea `PIKOFILM_WORKER_KIND=fast|api` como retirados y recomienda `lifecycle`, aunque los workers Batch FAST/API son precisamente los ejecutores canónicos productivos actuales.

También puede arrancar Lifecycle y People históricos.

No hay servicio Railway vivo que use `Dockerfile.worker`, pero antes de retirarlo se comprobarán referencias adicionales de scripts/CI/historia útil y se coordinará con la retirada del Lifecycle clásico.

Estado frontend: `NO DIRECTO`; dependencia indirecta antigua aún se limpia como bloque Lifecycle.

## 4. Lifecycle clásico

`railway.lifecycle.toml` apunta a `Dockerfile.lifecycle` y arranca `worker/combined-worker.mjs`.

No existe servicio Railway vivo usando este config. El read-model `catalog_lifecycle` NO forma parte de este lote y está expresamente protegido por frontend.

Aun con fuerte evidencia de legacy, no se incluyó en P2-B porque:

- `package.json` mantiene `worker:lifecycle`;
- CI todavía hace syntax-check de `worker/lifecycle-worker.mjs` y `worker/lifecycle-pikoscore-executor.mjs`;
- retirar físicamente el bloque exige actualizar CI/scripts en la misma operación y preservar únicamente los cores de Lifecycle que sí son canónicos.

## 5. `pikofilm-backup-temp`

Clasificación: `TEMP`, confianza muy alta. Frontend gate: `NO`.

Fuente: imagen `postgres:18`, comando diagnóstico y `sleep 300`, restart `NEVER`.

### Ejecución

Aprobado por el usuario. Railway Agent ejecutó la eliminación del servicio ID `c01346c5-9919-452a-9ec0-486e4367214a` y devolvió `status=applied`, indicando que el servicio fue **marked for removal** y que ningún otro servicio fue modificado.

La lectura inmediata posterior de `list-services` todavía devolvió el servicio en el inventario, por lo que la eliminación se considera **solicitada/aplicada pero pendiente de desaparición observable**. PRE-V4 deberá volver a verificar Railway antes de cerrar definitivamente este punto.

Estado: `REMOVAL IN PROGRESS / VERIFY`.

## 6. Technical Snapshot

No se incluyó en borrado.

El servicio está protegido por frontend y su código es canónico. La deuda consiste exclusivamente en que Railway sigue usando la rama histórica `feat/pikoquality-technical-snapshot` en vez de `main`.

## 7. Batch Plex

No se incluyó en borrado.

Sigue siendo el problema operacional crítico: frontend SER-002 encola al pool `plex`, pero Railway vivo no contiene servicio Batch Plex.

## 8. PRs de validación #211–#218

Aprobadas para cierre sin merge y ejecutadas.

En cada PR se añadió el comentario PRE-V4:

> Cierre PRE-V4: esta PR era de validación CI-only y ha quedado superseded por la evolución posterior de main y por la consolidación actual de CI/arquitectura. Se cierra sin merge para preservar el historial sin mantenerla como backlog activo.

Después se cerraron las PR:

- #211 → `closed`, `merged=false`.
- #212 → `closed`, `merged=false`.
- #213 → `closed`, `merged=false`.
- #214 → `closed`, `merged=false`.
- #215 → `closed`, `merged=false`.
- #216 → `closed`, `merged=false`.
- #217 → `closed`, `merged=false`.
- #218 → `closed`, `merged=false`.

Estado: **P7/P2 cleanup COMPLETADO para #211–#218**. El historial permanece intacto.

## 9. PR #261 / #258

No se tocaron.

#261 contiene una optimización valiosa no absorbida completamente: llevar clasificación/paginación de Calidad → Datos a PostgreSQL en vez de cargar el universo y paginar en Node. No mergear la rama antigua; rescatar la idea en implementación actual tras PRE-V4 o como deuda V4 explícita.

#258 contiene una optimización SQL menos completa y una propuesta de logging de bodies HTTP completos. No se rescata el logging completo por defecto; requiere política explícita de observabilidad/retención.

## 10. Resultado del segundo lote P2

Ejecutado con aprobación explícita:

1. `railway.api.toml` — eliminado.
2. `Dockerfile.api` — eliminado.
3. `pikofilm-backup-temp` — eliminación aplicada en Railway, pendiente de verificación de desaparición.
4. PR #211 — cerrada sin merge.
5. PR #212 — cerrada sin merge.
6. PR #213 — cerrada sin merge.
7. PR #214 — cerrada sin merge.
8. PR #215 — cerrada sin merge.
9. PR #216 — cerrada sin merge.
10. PR #217 — cerrada sin merge.
11. PR #218 — cerrada sin merge.

## 11. Fuera de este lote y no tocado

- `railway.lifecycle.toml`
- `Dockerfile.lifecycle`
- `Dockerfile.worker`
- `worker/entrypoint.mjs`
- `worker/combined-worker.mjs`
- workers/executors Lifecycle/People antiguos
- `catalog_lifecycle`
- Batch API/FAST/Plex
- Technical Snapshot
- Neon
- #258/#261/#99
- rama `feat/pikoquality-technical-snapshot`

**Estado:** SEGUNDO LOTE P2 EJECUTADO — código legacy retirado, PRs históricas cerradas, servicio Railway temporal en proceso de eliminación y pendiente de verificación final.
