# PikoFilm — Estado operativo actual

> Documento vivo. Este fichero describe el estado operativo vigente; el detalle de la auditoría previa a V4 vive en `docs/PRE_V4_*.md`.

## Estado

**Fecha:** 02/09/2026 (Europe/Madrid)  
**Fase:** PRE-V4 — consolidación, retirada de legacy y cierre de arquitectura  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Producción:** `main`  
**Rama de auditoría/limpieza:** `pre-v4-readiness`

## Arquitectura operativa vigente

### Frontend / control plane

- Vercel sirve PikoFilm.
- `/admin` es el **Centro de Operaciones canónico**.
- Las páginas funcionales de Calidad contienen los controles de sus procesos y Batch cuando corresponde.
- La primera generación `/admin/batch` ya no forma parte del producto y se ha retirado en `pre-v4-readiness` tras aprobación explícita del usuario.

### Observabilidad y Batch Engine

El modelo vigente es:

- `process_runs`
- `process_run_events`
- `process_run_errors`
- `batch_run_control`
- `batch_run_items`
- `batch_engine_control`

Los Batch actuales crean runs comunes y ejecutan items mediante workers/pools. El Centro de Operaciones observa y gobierna este modelo.

Las tablas de la primera generación (`batch_runs`, `batch_jobs`, `batch_process_state`, `batch_source_limits`, `batch_runtime_control`) son candidatos legacy para P3, pero no se eliminan físicamente hasta completar la comprobación de dependencias y disponer de acceso SQL Neon fiable.

## Railway vigente

Proyecto: `PikoFilm Batch`.

Servicios productivos auditados:

- `pikofilm-batch-fast-worker-v1` — pool FAST actual;
- `pikofilm-worker-api-v3` — pool API actual;
- `pikofilm-batch-plex-worker-v2` — pool Plex actual;
- `pikofilm-technical-snapshot-worker-v1` — captura técnica PikoQuality actual.

**Regla:** no clasificar un servicio como legacy por contener `batch`, `worker` o un sufijo de versión en el nombre. La vigencia se determina por el código que ejecuta y por sus consumidores.

El worker FAST actual usa `lib/batch-worker-runtime.mjs` y el modelo `process_runs/batch_run_items`; por tanto es infraestructura vigente aunque conserve el nombre histórico `batch-fast-worker-v1`.

## PikoQuality Technical Snapshot

- Railway ejecuta el servicio desde `main`.
- `Dockerfile.technical` + `worker/technical-snapshot-worker.mjs` siguen vigentes.
- La antigua rama productiva `feat/pikoquality-technical-snapshot` fue retirada después de migrar el servicio a `main` y verificar arranque correcto.
- El proceso sigue siendo frontend-consumido desde Calidad → PikoQuality y está protegido por el Frontend Safety Gate.

## Batch Plex de Series

El defecto PRE-V4 por ausencia del pool Plex quedó resuelto:

- servicio `pikofilm-batch-plex-worker-v2` activo;
- source `main`;
- `Dockerfile.batch-plex`;
- `npm run worker:batch-plex`;
- adaptador actual para `PROC-SER-002`.

Los hotfixes productivos de arranque del contenedor están en `main` y deben conservarse al integrar PRE-V4.

## GitHub

- PRs abiertos auditados: 0 en el momento del cierre del bloque PRE-V4 correspondiente.
- La cuenta mantiene un gran número de ramas históricas; la limpieza masiva está pendiente de una allowlist y de decisión destructiva específica.
- `pre-v4-readiness` concentra la auditoría y limpieza previa a V4.
- `pre-v4-audit-tmp` está 0 commits por delante de `main` y es candidato de limpieza, pero no se elimina sin el gate de ramas.
- `archive/railway-pikoquality-technical-snapshot-20260901` se conserva de momento como rama de archivo; no debe borrarse sólo por antigüedad.

## Workflows

Canónicos/útiles actualmente:

- `ci.yml`
- `imdb-discovery.yml`
- `manual-maintenance.yml`
- `neon-access-check.yml`
- `neon-branch-first-migrations.yml`

`neon-observability-migration.yml` permanece como workflow manual de migración histórica y requiere cierre de evidencia antes de retirarlo.

El one-shot `drop-legacy-batch-job-steps.yml` fue retirado en PRE-V4 después de confirmarse que `batch_job_steps` ya había sido eliminado y que la única lectura residual pertenecía al antiguo `/admin/batch`.

## Política de migraciones Neon

`neon-branch-first-migrations.yml` **no se dispara por cualquier push a `main`**. Tiene filtro de ruta `db/migrations/*.sql`.

Por tanto los cambios de código, frontend, Dockerfiles o documentación fuera de esa carpeta no activan la aplicación de migraciones. Los cambios dentro de `db/migrations/*.sql` sí requieren revisión específica porque el workflow, tras validación en rama efímera, puede aplicar la migración a producción en el `push` posterior al merge.

## Neon

Proyecto: `pikofilm` (`red-silence-53441102`).

La auditoría SQL destructiva P3 sigue bloqueada por `NEON-001`: el conector disponible presenta una incompatibilidad de esquema de parámetros y no permite usar de forma fiable las operaciones necesarias de inventario/SQL. Mientras ese bloqueo exista:

- no se adivina el estado físico de tablas;
- no se ejecutan DROP/ALTER destructivos;
- se conserva evidencia de código y runtime para preparar candidatos.

## Frontend Safety Gate

Antes de retirar código, rutas, servicios, workers, workflows u objetos de datos se traza:

`pantalla/control → acción → operación canónica → ejecutor/infra → datos`.

Si existe consumidor frontend directo o indirecto, la decisión final es del usuario. Ante duda se conserva/investiga.

## Limpieza PRE-V4 completada relevante

- retirada de execution plane Lifecycle antiguo y workers duplicados aprobados;
- retirada de `Dockerfile.api`, `railway.api.toml` y servicio temporal de backup aprobados;
- retirada de artefactos temporales/revalidaciones;
- cierre de PRs antiguos sin merge cuando su valor útil se rescató en issues vigentes;
- migración Railway Technical Snapshot a `main`;
- creación y estabilización del pool Railway Plex actual;
- retirada de la primera generación `/admin/batch` y sus helpers exclusivos;
- cierre de #190 como diseño ya superado y de #302 como bug histórico ya resuelto por el flujo actual de Novedades.

## Riesgos / pendientes principales antes de V4

1. **P3 Neon:** inventario físico y retirada segura de objetos legacy cuando `NEON-001` se resuelva.
2. **Ramas GitHub:** reducir el gran histórico con allowlist y evidencia de merge/obsolescencia.
3. **Documentación/issues:** seguir eliminando contratos históricos que contradigan el sistema vivo.
4. **Dos raíces de migraciones:** `db/migrations/` es la ruta gobernada por el workflow actual; la raíz `migrations/` contiene migraciones históricas PikoQuality y debe clasificarse antes de consolidarla.
5. **CSS/frontend legacy:** no retirar estilos por nombre sin trazado visual/consumer gate.
6. **Sagas V2/V3 y otras capas de compatibilidad:** conservar hasta demostrar writer/readers y consumidores exactos.
7. **CI final:** la rama PRE-V4 debe pasar tests + build antes de integrarse; el CI oficial se dispara actualmente en pull request.

## Fuentes de verdad PRE-V4

- `docs/PRE_V4_READINESS_PLAN.md`
- `docs/PRE_V4_FRONTEND_SAFETY_GATE.md`
- `docs/PRE_V4_AUDIT.md`
- `docs/PRE_V4_EXECUTION_PLANE_AUDIT.md`
- `docs/PRE_V4_WORKFLOWS_AUDIT.md`
- `docs/PRE_V4_BATCH_UI_GENERATIONS_AUDIT.md`
- `docs/PRE_V4_DBMIG_TRIGGER_AUDIT.md`

## Próximo gate

Continuar cerrando P2/P4/P5/P6 con evidencia de consumidores. P3 permanece bloqueada por el acceso Neon. No hacer limpieza masiva de ramas ni borrados físicos de base de datos sin su gate específico.
