# PikoFilm — Auditoría PRE‑V5 · Anexo runtime Railway

Estado: **AUDITORÍA / CANDIDATOS PENDIENTES — NO ES ROADMAP V5**.

Complementa `docs/PRE_V5_DEEP_AUDIT.md` con evidencia directa del entorno Railway de producción.

## Estado observado

- Proyecto vivo: `PikoFilm Batch`.
- Servicios detectados: API worker, FAST worker, Plex worker y Technical Snapshot worker.
- Los cuatro últimos deployments consultados están en estado `SUCCESS`.
- El API worker arrancó con `capacity=3` y adaptadores para `PROC-ID-001`, `PROC-IV-001`, `PROC-DATA-001`, `PROC-DATA-002`, `PROC-SER-003`, `PROC-SER-004`, `PROC-PER-001`, `PROC-SAGA-001` y `PROC-LC-001`.
- El entorno de producción reportó 30 cambios `STAGED` pendientes en el momento de la auditoría. No se ha aplicado ninguno.
- Railway confirmó que el merge documental PR #512 (`a99378efd999283f0f5e5636a9da371435bacec2`) provocó un deployment nuevo de los cuatro workers aunque el cambio era documental.

## Candidatos adicionales

### V5-C091 — Evitar redeploy de todos los workers por cambios sólo documentales — P1 · EFICIENCIA/FIABILIDAD
**Evidencia:** los cuatro servicios Railway desplegaron el commit `a99378...`, cuyo PR #512 fue consolidación documental sin cambio de runtime.
**Mejora:** configurar watch paths/root directories o gate de deployment por servicio para que un worker sólo se reconstruya si cambian sus fuentes, dependencias o configuración relevante.
**Impacto usuario:** menos reinicios innecesarios, menos coste de build y menor riesgo de interrumpir trabajo persistente por editar documentación.

### V5-C092 — Controlar y hacer visible el drift de cambios staged en Railway — P1 · HARDENING
**Evidencia:** producción reportó `changeCount=30` y `patchStatus=STAGED`.
**Mejora:** auditar qué representan esos cambios, documentar su origen y crear una regla: producción no debe acumular configuración staged sin una intención explícita conocida. No aplicar automáticamente.
**Impacto usuario:** evita que un futuro “Deploy” incluya accidentalmente 30 cambios de infraestructura que no estaban relacionados con la tarea actual.

### V5-C093 — Añadir procedencia/versionado visible de cada worker en Operaciones — P2 · OBSERVABILIDAD
**Mejora:** mostrar por servicio commit desplegado, hora de arranque, capacidad, versión del catálogo de adapters y estado de heartbeat.
**Impacto usuario:** comprobar rápidamente que Vercel, código y workers están realmente alineados después de un cambio.

### V5-C094 — Evitar reinicios coordinados innecesarios de todos los pools — P2 · FIABILIDAD
**Evidencia:** varios merges recientes provocaron deployments casi simultáneos de API, FAST, Plex y Technical, incluso cuando no todos necesitaban cambios.
**Mejora:** despliegues selectivos por responsabilidad y, cuando haya cambio compartido real, estrategia que preserve leases/reconciliación sin reiniciar más servicios de los necesarios.
**Impacto usuario:** menos ventanas en las que todos los executors están arrancando a la vez y mayor continuidad del procesamiento.

## Regla

Estos cuatro puntos, igual que C001–C090, son sólo candidatos. Se decidirán uno por uno y sólo los aprobados entrarán en el roadmap V5.