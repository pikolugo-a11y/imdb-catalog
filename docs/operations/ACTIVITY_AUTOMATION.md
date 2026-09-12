# PikoFilm — Automatización de Actividad / PLAN-002

Estado: **contrato operativo vivo de V4**. Complementa el catálogo de procesos, la arquitectura V4 y el runbook.

## Propósito

`PROC-PLAN-002` convierte `process_plans` en trabajo real sin exigir que el usuario entre en PikoFilm ni pulse un botón. El botón de Actividad es únicamente control manual/diagnóstico y **no cuenta como prueba de salud automática**.

## Fuente y seguridad

- Productor: Vercel Cron sobre `/api/cron/activity-planner`.
- Autenticación: `CRON_SECRET`, fail-closed.
- Nunca se registra el valor del secreto ni la cabecera Authorization.
- El sync Plex global (`PROC-NOV-009`) sigue fuera de esta automatización.
- Los consumidores persistentes siguen siendo los pools Railway canónicos según el PROC despachado.

## Cadencia

El endpoint se invoca cada **5 minutos** (`*/5 * * * *`). Para no ejecutar las consultas pesadas de previsión 288 veces al día, el mismo PROC tiene dos modos observados en `process_runs.context.mode`:

- `dispatch`: minutos 05, 10, 15, …, 55. Reconciliación ligera + despacho de planes `planned` ya vencidos. No recalcula demanda futura, no replanifica errores y no ejecuta retención.
- `full`: minuto 00 de cada hora. Ejecuta el ciclo completo: reconciliación, replanificación segura, demanda actual/futura, reparto, despacho y retención de 30 días.

La idempotencia usa una clave por slot de 5 minutos. Una repetición de Vercel dentro del mismo slot no duplica el ciclo.

## Por qué el tick ligero no reintenta `delayed`

El tick frecuente sólo despacha filas `planned`. Un fallo de dispatch deja la fila `delayed`; su replanificación/reintento pertenece al ciclo completo horario. Así se conserva un backoff natural y se evita un bucle de reintento cada cinco minutos.

## Salud visible en Actividad

La UI declara `Automatización activa` únicamente cuando se cumplen **las tres** condiciones:

1. el deployment ve `CRON_SECRET`;
2. existe un `PROC-PLAN-002` automático (`trigger_source=activity_planner`) `succeeded|running` en los últimos 15 minutos;
3. existe un ciclo automático `mode=full` `succeeded|running` en los últimos 75 minutos.

Un `PROC-PLAN-002` con `trigger_source=activity_manual` nunca pone la automatización en verde.

Estados intermedios útiles:

- `Automatización bloqueada`: el deployment no ve `CRON_SECRET`;
- `Despacho automático activo · falta recálculo horario`: los ticks de 5 minutos funcionan pero aún no se ha observado un `full` reciente;
- `Automatización sin ciclo reciente`: el cron no está dejando evidencia reciente suficiente.

## Prueba de aceptación productiva

1. Confirmar Production en el SHA esperado y los cuatro workers Railway sanos/alineados.
2. Elegir un plan seguro `planned`, sin `dispatch_run_id`, y moverlo a unos minutos en el futuro.
3. **No pulsar el botón manual**.
4. Esperar al primer slot de cron de 5 minutos posterior a `planned_at`.
5. Verificar en Vercel un `GET /api/cron/activity-planner` 2xx.
6. Verificar en Neon un `PROC-PLAN-002` con `trigger_source=activity_planner`, `context.mode=dispatch` y estado sano.
7. Verificar que el plan pasa a `dispatched` o `completed` y conserva vínculo `dispatch_run_id` cuando exista Batch real.
8. Verificar la ejecución funcional hija con `trigger_source=quality_scheduler` y el worker Railway correspondiente.
9. En el siguiente minuto 00, verificar también un `PROC-PLAN-002` automático `context.mode=full` para cerrar la salud completa.

## Coste y retención

La frecuencia de cinco minutos genera observabilidad ligera, pero el detalle técnico sigue bajo la política canónica de **30 días**. El trabajo pesado de detección/proyección continúa limitado a una vez por hora; los ticks intermedios no barren selectores de demanda ni previsión futura.
