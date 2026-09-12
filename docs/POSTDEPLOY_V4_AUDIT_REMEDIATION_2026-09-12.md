# PikoFilm V4 — Auditoría post-deploy y remediación · 2026-09-12

Estado: **auditoría técnica persistida**. Este documento registra hallazgos observados tras desplegar PR #529 y las correcciones preparadas en la ronda post-deploy. La arquitectura canónica sigue en `V4_ARCHITECTURE.md` y los procesos en `docs/processes/`.

## Alcance

Contraste de:

- deployment Vercel y runtime logs;
- `main` y contratos CI;
- Neon vivo;
- configuración/deployments Railway;
- funcionalidad y UX transversal V4;
- arquitectura Git ↔ Vercel ↔ Railway ↔ Neon.

No se realizó deploy de producción Vercel ni reparación histórica directa de Neon.

## Hallazgos confirmados

### 1. PLAN-002 no alcanzaba su route

Vercel invocaba `/api/cron/activity-planner` cada hora, pero el middleware privado sólo permitía el cron de snapshot. Resultado observado: 404 horario, cero `PROC-PLAN-002` en Neon y tres planes vencidos sin `dispatch_run_id`.

Impactos:

- planificación automática sin ejecución real;
- UX decía “Planificación automática activa” sin evidencia;
- la purga terminal de 30 días, alojada en el mismo ciclo, tampoco podía ejecutarse.

Remediación:

- allowlist explícita de ambos crons en middleware;
- helper común `isCronAuthorized` fail-closed;
- Activity deriva salud desde el último PLAN-002 y deja de afirmar “activo” si no hay ciclo reciente sano.

### 2. Worker Railway API en drift

FAST/Plex/Technical estaban alineados con el código reciente; `pikofilm-worker-api-v3` ejecutaba un commit anterior. Además tenía auto-deploy desactivado.

El drift era funcionalmente peligroso porque su versión de Lifecycle/PikoQuality era anterior a la regla C6/fingerprint vigente.

La configuración productiva contenía además un `startCommand` no versionado que ejecutaba SQL de requeue de `PROC-LC-001` antes de arrancar el worker.

Remediación aplicada ya en Railway:

- `startCommand` devuelto a `npm run worker:batch-api`;
- eliminado el SQL de arranque oculto;
- redeploy del servicio realizado con éxito.

Gate todavía necesario antes del deploy Vercel de esta ronda:

- Railway debe ejecutar **Deploy Latest Commit** del `main` resultante;
- activar auto-deploy del servicio API;
- verificar que el SHA realmente ejecutado coincide con `main`;
- opcional/recomendado: habilitar `Wait for CI` ahora que CI corre también en `push` a `main`.

No se debe desplegar en Vercel la corrección que desbloquea PLAN-002 antes de ese gate, porque los planes vencidos pueden despachar SER-003/SER-004 al pool API.

### 3. SER-002 manual podía agotar Vercel

Logs Vercel mostraron cuatro timeouts de 60 s en refrescos manuales de detalle Plex de Series.

Remediación:

- el control manual conserva semántica individual;
- Vercel valida y encola un SER-002 dirigido a un único `ratingKey`;
- Railway Plex ejecuta `syncPlexSeriesDetailCore` de forma durable;
- un Batch activo se reutiliza y la entidad se añade/idempotentiza;
- el selector automático ordinario no cambia.

No existe una segunda receta funcional.

### 4. Paginadores disabled todavía interactivos

Identidad, Datos, Series y Personas mantenían `NoPrefetchLink` con clase `disabled`. El contrato anterior sólo cubría algunas superficies.

Remediación:

- `NoPrefetchLink` convierte de forma transversal enlaces con token `disabled` o `aria-disabled=true` en `<span aria-disabled="true">`;
- el contrato de regresión recorre las superficies que usan ambos patrones.

### 5. Búsqueda global de Personas costosa

La consulta previa materializaba un semi-join amplio con `movie_credits` en cada búsqueda. Medición comparable con `ana`:

- camino previo: ~297 ms;
- camino acotado por candidatos: ~94 ms con caché caliente comparable.

Remediación:

- texto normal requiere 3 caracteres antes de consultar;
- IMDb/números exactos siguen permitiendo acceso temprano;
- Personas acota primero los candidatos de nombre y sólo después comprueba crédito en catálogo.

No se añadió ningún índice ni se modificó esquema Neon.

### 6. Lambdas FilmAffinity legacy todavía desplegadas

`api/fa-search.py` y `api/fa-evidence.py` dependían de `batch_jobs`, relación V1 ya retirada, y el consumer sweep no encontró callers vivos. `requirements.txt` sólo mantenía sus dependencias Python.

Remediación:

- retiradas ambas rutas;
- retiradas las dependencias Python;
- contrato de CI impide su reaparición.

### 7. CI y protección de main

GitHub mostraba `main` sin branch protection/required checks. El workflow CI sólo corría en PR.

Remediación en repo:

- CI también corre tras cada `push` integrado en `main`;
- la disciplina rama -> PR -> CI -> merge queda documentada como obligatoria.

La activación de branch protection/required checks depende de la configuración/permisos de GitHub y no se fuerza desde código.

## Datos vivos durante la remediación

Tras los cambios de código, antes de abrir PR:

- Batch abiertos: 0;
- procesos raíz `queued|running`: 0;
- ejecuciones PLAN-002: 0;
- planes vencidos sin dispatch: 3.

Esto confirma que la implementación no lanzó trabajo productivo de forma accidental.

## Orden de despliegue obligatorio

1. PR/CI/merge de esta ronda.
2. Railway API: **Deploy Latest Commit** al SHA de `main` y activar auto-deploy.
3. Verificar logs de arranque sin SQL oculto y SHA correcto.
4. Sólo entonces el usuario despliega Vercel producción.
5. Verificar que `/api/cron/activity-planner` deja de devolver 404 y aparece PLAN-002.
6. Verificar que los tres planes vencidos se reconcilian/despachan con workers alineados.
7. Validación funcional/visual por el usuario.

## Criterio de cierre

La ronda se cierra cuando Git/CI estén verdes, Railway API esté alineado con `main`, Vercel produzca PLAN-002 horario y Actividad muestre la salud del planificador a partir de evidencia real.
