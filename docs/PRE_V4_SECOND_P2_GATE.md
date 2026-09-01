# PRE-V4 — Segundo gate P2

Fecha: 2026-09-01
Rama: `pre-v4-readiness`

Este documento prepara el segundo lote destructivo. No autoriza por sí mismo ningún borrado.

## 1. Railway vivo revalidado

Proyecto `PikoFilm Batch`, entorno `production`.

Servicios actuales:

- `pikofilm-batch-fast-worker-v1` → repo `pikolugo-a11y/imdb-catalog`, rama `main`, `Dockerfile.batch-fast`, start `node worker/batch-fast-worker.mjs`.
- `pikofilm-worker-api-v3` → rama `main`, `Dockerfile.batch-api`, config `railway.batch-api.toml`, start `npm run worker:batch-api`.
- `pikofilm-technical-snapshot-worker-v1` → rama `feat/pikoquality-technical-snapshot`, `Dockerfile.technical`, config `railway.technical.toml`, start `node worker/technical-snapshot-worker.mjs`.
- `pikofilm-backup-temp` → imagen `postgres:18`, comando puramente diagnóstico que imprime disponibilidad de utilidades y duerme 300 segundos; restart `NEVER`.

No existe servicio vivo que use:

- `railway.api.toml`
- `Dockerfile.api`
- `railway.lifecycle.toml`
- `Dockerfile.lifecycle`
- `Dockerfile.worker`
- `worker/entrypoint.mjs`

## 2. `railway.api.toml` + `Dockerfile.api`

Clasificación: `DEAD/LEGACY`, confianza muy alta.

`railway.api.toml` ordena arrancar:

`node worker/batch-api.mjs`

Ese fichero no existe en la rama PRE-V4.

`Dockerfile.api` no arranca el Batch API actual: usa `worker/entrypoint.mjs`. El Batch API productivo usa `Dockerfile.batch-api` + `railway.batch-api.toml` + `worker/batch-api-worker.mjs`.

Frontend gate:

- ningún control frontend trazado termina en `railway.api.toml` o `Dockerfile.api`;
- los controles que necesitan pool API llegan al servicio productivo `pikofilm-worker-api-v3` y al worker `batch-api-worker.mjs`;
- estado frontend para esta pareja: `NO`.

**Candidato P2-B:** borrar `railway.api.toml` y `Dockerfile.api`.

## 3. Generic `Dockerfile.worker` + `worker/entrypoint.mjs`

Clasificación actual: `LEGACY/COMPATIBILITY`, todavía NO incluido en el lote.

`Dockerfile.worker` arranca `worker/entrypoint.mjs`.

El entrypoint contiene una afirmación obsoleta: bloquea `PIKOFILM_WORKER_KIND=fast|api` como retirados y recomienda `lifecycle`, aunque los workers Batch FAST/API son precisamente los ejecutores canónicos productivos actuales.

También puede arrancar Lifecycle y People históricos.

No hay servicio Railway vivo que use `Dockerfile.worker`, pero antes de retirarlo se comprobarán referencias adicionales de scripts/CI/historia útil y se coordinará con la retirada del Lifecycle clásico.

Estado frontend: `NO DIRECTO`; dependencia indirecta antigua aún se limpia como bloque Lifecycle.

## 4. Lifecycle clásico

`railway.lifecycle.toml` apunta a `Dockerfile.lifecycle` y arranca `worker/combined-worker.mjs`.

No existe servicio Railway vivo usando este config. El read-model `catalog_lifecycle` NO forma parte de este lote y está expresamente protegido por frontend.

Aun con fuerte evidencia de legacy, no se incluye todavía en P2-B porque:

- `package.json` mantiene `worker:lifecycle`;
- CI todavía hace syntax-check de `worker/lifecycle-worker.mjs` y `worker/lifecycle-pikoscore-executor.mjs`;
- retirar físicamente el bloque exige actualizar CI/scripts en la misma operación y preservar únicamente los cores de Lifecycle que sí son canónicos.

## 5. `pikofilm-backup-temp`

Clasificación: `TEMP`, confianza muy alta.

Fuente: imagen `postgres:18`.

Start command actual:

- imprime si existen `pg_dump`, `python3`, `busybox`, `perl`, `nc`;
- `sleep 300`;
- restart policy `NEVER`.

Sólo tiene `DATABASE_URL` como variable listada. No corresponde a ningún flujo frontend ni a ningún executor Batch actual.

Frontend gate: `NO`.

**Candidato P2-B infra:** eliminar el servicio Railway `pikofilm-backup-temp`, pero sólo con aprobación explícita porque es una mutación de infraestructura productiva.

## 6. Technical Snapshot

No se incluye en borrado.

El servicio está protegido por frontend y su código es canónico. La deuda consiste exclusivamente en que Railway sigue usando la rama histórica `feat/pikoquality-technical-snapshot` en vez de `main`.

El cambio de source debe tratarse como operación separada y verificable, sin modificar el comportamiento visible.

## 7. Batch Plex

No se incluye en borrado.

Sigue siendo el problema operacional crítico: frontend SER-002 encola al pool `plex`, pero Railway vivo no contiene servicio Batch Plex.

## 8. PRs de validación

Las PR #211–#218 son históricas/CI-only. La mayoría sólo añade marcadores de validación. #212 declara expresamente que el cambio funcional ya estaba aplicado en main; #213–#218 son validaciones de UI/funcionalidad ya evolucionada; #211 sí tocó un CI antiguo además de un marcador, pero su objetivo también era forzar CI sobre una generación previa.

Propuesta P7: cerrarlas sin merge con explicación `superseded by current main/PRE-V4 canonical CI`. No borrar historial.

No cerrar aún #258, #261 ni #99.

## 9. PR #261 / #258

#261 contiene una optimización valiosa no absorbida completamente: llevar clasificación/paginación de Calidad → Datos a PostgreSQL en vez de cargar el universo y paginar en Node. No mergear la rama antigua; rescatar la idea en implementación actual tras PRE-V4 o como deuda V4 explícita.

#258 contiene una optimización SQL menos completa y una propuesta de logging de bodies HTTP completos. No se rescata el logging completo por defecto; requiere política explícita de observabilidad/retención.

## 10. Segundo lote candidato P2

### Código — frontend=`NO`

1. `railway.api.toml`
2. `Dockerfile.api`

### Infraestructura — frontend=`NO`

3. servicio Railway `pikofilm-backup-temp`

### PRs históricas — cerrar, no borrar

4. #211
5. #212
6. #213
7. #214
8. #215
9. #216
10. #217
11. #218

## 11. Fuera de este lote

No tocar todavía:

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

**Estado:** SEGUNDO LOTE P2 PREPARADO — requiere aprobación explícita antes de ejecutar las mutaciones anteriores.
