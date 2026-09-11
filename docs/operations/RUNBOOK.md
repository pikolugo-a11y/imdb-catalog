# PikoFilm — Runbook operativo

Estado: **canónico**.

## Antes de intervenir

1. leer `AGENTS.md`, `docs/AI_DEVELOPMENT_GUIDE.md`, `docs/PROJECT_RULES.md` y `docs/README.md`;
2. identificar el PROC/servicio/dato afectado;
3. verificar `main` y deployment realmente vigente;
4. no usar conversaciones previas como única fuente;
5. no exponer secretos.

## Plano operativo

- **Vercel:** UI/control plane y deployment de la aplicación.
- **Neon:** PostgreSQL, estado y coordinación compartida.
- **Railway:** workers persistentes API/FAST/Plex/Technical.
- **GitHub Actions:** CI, migraciones controladas y excepciones explícitas como Discovery.

## Incidente funcional tras deploy

1. confirmar commit desplegado antes de atribuir el fallo al cambio;
2. localizar PROC y entrypoint vivo;
3. revisar `process_runs`/eventos/errores y logs del executor;
4. comprobar cambios de esquema/migraciones si el error es SQL;
5. comprobar fuentes externas/rate limits si el error es de integración;
6. corregir en la operación canónica, no sólo en el adapter Batch;
7. añadir contrato de regresión cuando el fallo revele una regla arquitectónica;
8. actualizar documentación en el mismo ciclo.

## Railway

No clasificar un servicio como legacy por nombre, sufijo o posición visual en el canvas. Cruzar siempre servicio -> deployment -> comando -> worker -> consumidores -> PROC.

Servicios auditados vigentes en P4: API, FAST, Plex y Technical. Cambiar variables/configuración puede redeplegar; no hacerlo incidentalmente.

### Mantenimiento PikoQuality / Railway Technical

`/admin/pikoquality` es una **superficie de estado actual y control**, no un segundo historial de ejecuciones. Su cadena de verdad visible es:

```text
archivos físicos activos de Plex -> captura técnica vigente -> C6 vigente
```

Reglas:

- el universo físico se cuenta desde `plex_items` activos (`movie` + `episode`), aunque todavía no exista fila en `plex_technical_state`;
- `process_runs` es la única verdad de ejecución para `PROC-PQ-001` y `PROC-PQ-002`;
- historial, errores, runs terminados y diagnóstico detallado viven en `/admin` y `/admin/runs/[id]`;
- `plex_technical_runs` no es fuente de verdad de UI ni de observabilidad canónica;
- el estado/heartbeat del worker se presenta separado del estado de una ejecución;
- no se inicia `PROC-PQ-002` si Railway Technical no tiene heartbeat reciente;
- cada ejecución manual nueva de `PROC-PQ-002` fuerza una comprobación completa de biblioteca antes de capturar;
- un `snapshot_status='error'` se rearma una sola vez durante esa nueva comprobación; la cola ordinaria no consume `error`, evitando bucles infinitos dentro de la misma ejecución;
- C6 sólo usa capturas técnicas válidas y su denominador debe identificarse como **calculable**, mostrando aparte los archivos todavía pendientes de captura;
- la deuda técnica física actual puede aparecer en la salud de Operaciones aunque sea anterior a `process_run_errors`; no se convierte artificialmente en una incidencia histórica.

## Neon

- cambios destructivos sólo mediante migración revisable/verificable;
- auditar consumidores antes de DROP;
- UNKNOWN bloquea borrado;
- conservar compatibilidades conocidas hasta su gate específico;
- no registrar `DATABASE_URL`, API keys ni secretos.

El workflow branch-first de migraciones valida cambios de `db/migrations/` antes de producción según la configuración vigente del repositorio.

## Vercel

Los deployments de producción los realiza el usuario. Tras un merge, comunicar el HEAD preparado; después de que el usuario confirme el deploy, verificar técnicamente que producción corresponde al commit esperado antes de iniciar aceptación funcional.

## GitHub Actions

GitHub Actions no debe convertirse en worker continuo. Los workflows persistentes deben tener responsabilidad operativa clara. Discovery IMDb es una excepción explícita y observada.

## Validación funcional

La aceptación funcional/visual en producción la ejecuta el usuario, prueba a prueba. Las verificaciones técnicas (commit, deployment, logs, DB, configuración) pueden hacerse antes para preparar o diagnosticar la prueba.

## Rollback

Prioridad:
1. detener/pausar ejecución dañina si existe control seguro;
2. preservar evidencia (`process_runs`, errores, logs);
3. revertir código/configuración por mecanismo de plataforma apropiado;
4. para datos, preferir migración correctiva/reversible frente a manipulación improvisada;
5. verificar fuentes de verdad y read models después de recuperar;
6. documentar causa y contrato preventivo.

## Criterio de cierre

Un incidente no queda cerrado sólo porque el error desaparezca: debe verificarse el comportamiento esperado, las regresiones razonables y la coherencia documental/arquitectónica.
