# PikoFilm — PRE-V4 · Vercel y evidencia indirecta de esquema

Fecha: 2026-09-02  
Rama: `pre-v4-readiness`

## 1. Proyecto Vercel canónico

Proyecto auditado: `imdb-catalog` (`prj_iApLZEUtSy3MTd6KT39PvagJrra2`), enlazado al repositorio canónico `pikolugo-a11y/imdb-catalog`.

La última producción observada está READY. La ventana reciente de errores (1 h) no mostraba errores en el momento de la auditoría.

## 2. Cron dashboard-snapshot: mantener

`vercel.json` configura:

- ruta: `/api/cron/dashboard-snapshot`
- horario: `15 2 * * *`

Cadena real:

Vercel Cron → `app/api/cron/dashboard-snapshot/route.js` → `captureDashboardSnapshot()` + `appendDatabaseStorageSnapshot()` → `dashboard_snapshots`.

`captureDashboardSnapshot()` alimenta el histórico usado por `lib/dashboard-v2.js` y, por extensión, por el dashboard/home. `appendDatabaseStorageSnapshot()` añade `db_total_bytes` y `db_operations_bytes` a la instantánea diaria.

Frontend Safety Gate: **INDIRECTO**. No es un botón, pero sus datos alimentan información visible/histórica del frontal. No borrar ni desactivar sin decisión explícita del usuario.

## 3. Hallazgo BATCH-DB-001 — `batch_job_steps` ya no existe, pero el frontend actual todavía lo consulta

Vercel registró en producción un error histórico en `/admin/batch`:

`relation "batch_job_steps" does not exist`

La revisión de código actual confirma que `lib/batch-control.js` todavía consulta `batch_job_steps` en dos puntos:

1. `getBatchControlOverview()` para estadísticas de uso por fuente del día;
2. `getJobDetail()` para mostrar el detalle de pasos de un job.

`/admin/batch` llama directamente a `getBatchControlOverview()` y presenta la sección visible `Fuentes, límites y breakers`.

Conclusión:

- la ausencia de `batch_job_steps` en producción está respaldada por evidencia runtime real;
- `drop-legacy-batch-job-steps.yml` ya no puede cumplir una función útil contra producción si la tabla está ausente;
- PERO todavía existe código frontend-consumed que intenta leer esa tabla.

Por tanto no basta con borrar el workflow: antes de cerrar este bloque hay que corregir la dependencia residual de `lib/batch-control.js` o demostrar que existe una capa de compatibilidad equivalente.

Frontend Safety Gate para `batch_job_steps`: **SÍ / INDIRECTO** porque `/admin/batch` y `/admin/batch/job/[id]` consumen los datos de sus consultas.

Estado:

- workflow `drop-legacy-batch-job-steps.yml`: TEMP/OBSOLETE probable, candidato de borrado posterior;
- referencias de lectura en `lib/batch-control.js`: DEUDA ACTIVA / defecto de compatibilidad;
- no hacer eliminación adicional hasta resolver la lectura residual.

## 4. Error histórico `process_code`

Vercel mostró errores históricos en `/calidad/series` del tipo `column "process_code" does not exist` asociados a un deployment anterior. No había errores recientes en la ventana de 1 h al auditar.

Clasificación: evidencia histórica de desalineación código/esquema; no asumir incidencia actual sin reproducción en el deployment vigente.

## 5. Reset de películas

Vercel mostró errores/mensajes históricos de bloqueo del reinicio por dependencias persistentes (`person_filmography`, `tmdb_movie_cache`). Esa conducta parece corresponder a un preflight defensivo. No clasificar como bug ni relajar el bloqueo sin revisar la cadena de reset y el Frontend Safety Gate.

## 6. Segundo proyecto Vercel

Existe `imdb-catalog2` (`prj_kQwCLBVOiwZVdfQt1RgRxsUYTP6J`). No tiene dominios propios en la metadata del proyecto, pero conserva deployments de producción READY y un historial ligado al repositorio GitHub antiguo `hpf6zr8jw5-sketch/imdb-catalog`.

Clasificación provisional: **LEGACY / MIGRATION REMNANT probable**, no borrar todavía.

Motivo del bloqueo para borrado:

- hay historial de deployments productivos;
- varios deployments usan alias de la familia `imdb-catalog-...-piko-film.vercel.app`;
- se debe comprobar que ningún dominio/alias útil ni flujo de rollback depende todavía de este proyecto.

Frontend Safety Gate: UNKNOWN hasta terminar trazado de dominios/consumo.

## 7. Dos raíces de migraciones

El repositorio contiene:

- `db/migrations/`: raíz canónica usada por el workflow branch-first;
- `migrations/`: contiene dos DDL históricas de PikoQuality Technical.

Los dos ficheros antiguos crean/ajustan objetos que el Technical Snapshot actual sí necesita (`plex_technical_state`, `plex_technical_control`, columnas técnicas de `plex_streams`). Por tanto que el mecanismo de migración actual no lea esa carpeta NO convierte esos ficheros automáticamente en borrables.

Clasificación provisional: **HISTORICAL MIGRATION / COMPATIBILITY EVIDENCE**. Conservar hasta poder verificar en Neon la existencia final de todos los objetos y decidir una política única de histórico de migraciones.

## Decisiones derivadas

1. Mantener el cron de snapshots.
2. No borrar aún `drop-legacy-batch-job-steps.yml`: primero eliminar/corregir las lecturas residuales del frontend.
3. No tocar `imdb-catalog2` hasta terminar auditoría de aliases/domains.
4. No mover/borrar las migraciones Technical antiguas mientras P3/Neon siga bloqueado.
