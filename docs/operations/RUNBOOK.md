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

Servicios vigentes: API, FAST, Plex y Technical. Cambiar variables/configuración puede redeplegar; no hacerlo incidentalmente.

### Paridad Git ↔ Railway

Un contenedor `online` no garantiza que el worker sea correcto. Antes de considerar sano un servicio:

1. comprobar el commit realmente desplegado y compararlo con `main`;
2. comprobar que el `startCommand` sólo arranca el worker canónico del repo;
3. rechazar SQL de reparación/requeue incrustado en `startCommand` o cualquier receta productiva que exista sólo en la configuración de Railway;
4. mantener el servicio siguiendo `main` y auto-deploy habilitado cuando la integración GitHub lo permita;
5. si existe drift, usar **Deploy Latest Commit** y volver a verificar el SHA ejecutado;
6. cuando esté disponible, habilitar **Wait for CI** para que Railway no despliegue un commit cuyo workflow de GitHub haya fallado.

El workflow CI corre tanto en PR como en cada `push` integrado en `main`, requisito para poder usar `Wait for CI` de Railway.

### Gate antes de activar productores automáticos

Antes de habilitar/desbloquear un productor automático que vaya a crear trabajo Railway —especialmente `PROC-PLAN-002`— verificar que **todos los pools consumidores implicados ejecutan el mismo `main` validado**. No desbloquear un cron que pueda despachar trabajo a un worker conocido como desactualizado.

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

### Cron canónico

`/api/cron/activity-planner` y `/api/cron/dashboard-snapshot` deben atravesar explícitamente el middleware privado y autenticar después con `CRON_SECRET` de forma **fail-closed**. Un secreto ausente nunca convierte el endpoint en público.

`CRON_SECRET` es **obligatorio en el entorno Production de Vercel**. Vercel Cron adjunta automáticamente `Authorization: Bearer <CRON_SECRET>` cuando la variable está configurada. El valor real nunca se versiona ni se registra.

Ante un `401` de un cron:

1. confirmar primero que el deployment productivo contiene la ruta esperada;
2. revisar el log seguro `[cron-auth] request rejected`;
3. `secretConfigured=false` significa que el deployment no ve `CRON_SECRET`;
4. `authorizationPresent=false` significa que la llamada no llegó con cabecera Authorization;
5. si ambos son `true`, comprobar que el secreto configurado corresponde al deployment/entorno Production actual;
6. no aceptar headers alternativos ni hacer fallback público para «arreglar» el cron.

`PROC-PLAN-002` corre cada hora. Su ausencia o falta de una ejecución `succeeded|running` reciente es una degradación visible de Actividad; no debe mostrarse “planificación automática activa” por configuración estática. El mismo ciclo ejecuta la purga segura del histórico terminal de 30 días, por lo que un cron roto también afecta la retención.

El calendario de **Actividad** ofrece además `Ejecutar ciclo automático ahora`. Ese control manual está protegido por la sesión privada de PikoFilm y ejecuta el mismo núcleo canónico `PROC-PLAN-002` que el cron —incluidas planificación y purgas—, pero con `trigger_source='activity_manual'`. Sirve para diagnóstico/operación inmediata cuando se necesita forzar el ciclo; **no sustituye** la obligación de que Vercel Cron funcione con `CRON_SECRET`.

El gate operativo de PLAN-002 sólo se considera cerrado después de observar **una ejecución real** `succeeded|running` creada por Vercel Cron en `process_runs`; un `200` aislado, una ejecución manual o una configuración visual de Vercel no bastan.

## Observabilidad de Series

`process_runs` es también la única fuente de ejecución presentada por la UI de Series, tanto en `/calidad/series` como en `/calidad/series/[ratingKey]`. `series_quality_runs` puede conservarse temporalmente por compatibilidad interna mientras existan escritores legacy, pero no se usa como historial canónico ni como verdad visible.

## GitHub Actions

GitHub Actions no debe convertirse en worker continuo. Los workflows persistentes deben tener responsabilidad operativa clara. Discovery IMDb es una excepción explícita y observada.

CI se ejecuta en PR y sobre `main` tras merge. La protección de `main`/required checks es una configuración de GitHub y debe mantenerse activa cuando la cuenta/repositorio lo permita; si no está activa, la disciplina rama -> PR -> CI -> merge sigue siendo obligatoria a nivel de proceso.

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