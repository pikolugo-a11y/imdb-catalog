# Operaciones V4 — auditoría de usabilidad 2026-09-12

Estado: **corrección funcional/UX aprobada por el usuario**. Complementa la especificación canónica V4 sin convertir Operaciones en un historial masivo de ejecuciones.

## Problemas confirmados

1. La portada mostraba sólo `long_running > 2h`, ocultando ejecuciones `running` reales. En el caso auditado había 4 runs activos pero la cabecera mostraba 2.
2. Los filtros `status`, `kind`, `process`, `entity`, `source` y `period` sólo ejecutaban consulta si `q` tenía texto. Filtrar por `running` con búsqueda vacía devolvía cero resultados.
3. Los filtros vivían dentro de `<details>` y se cerraban después de cada submit, perdiendo contexto visual.
4. La salud superior contaba errores individuales mientras el listado inferior agrupaba incidencias. El caso auditado era 6 errores = 1 grupo de incidencia, por lo que las cifras parecían contradictorias.
5. Las ejecuciones atascadas no tenían control contextual desde Operaciones.
6. El descarte de grupos de incidencias reutilizaba una idempotency key estable por grupo; una recurrencia posterior del mismo grupo podía reutilizar la acción antigua y aparentar que el botón no funcionaba.
7. Las acciones nativas no daban feedback consistente de pendiente/éxito/error.

## Comportamiento aprobado

### Estado vivo siempre visible

Operaciones sigue siendo `search-first, exception-first, detail-on-demand`, pero `queued/running` no es historial: es estado operativo presente. Por tanto:

- existe una sección permanente **Ejecuciones activas**;
- muestra todos los runs `queued/running` actuales, con límite defensivo de 25;
- una ejecución se marca **Atascada** si no registra actividad (`last_heartbeat_at`, `started_at` o `requested_at`) durante 15 minutos;
- se muestra identidad funcional cuando puede resolverse (p. ej. título de serie), además del PROC y executor;
- una ejecución activa tiene acceso directo a Diagnosticar.

### Cancelación/reconciliación

- Batch: usa `cancelBatch()` y su cancelación cooperativa canónica; no se inventa una segunda receta.
- Individual `running`: sólo se permite cerrar como cancelada cuando lleva al menos 15 minutos sin actividad. Esto evita marcar como cancelado un proceso que todavía parece vivo.
- `queued`: puede cancelarse desde Operaciones.
- cerrar un run atascado conserva el historial y añade un evento `run_cancelled`; no borra observabilidad.
- la UI explica la diferencia entre cancelación Batch y cierre de un run individual atascado.

### Búsqueda y filtros

- texto libre y filtros funcionan por separado o combinados;
- aplicar `status=running` sin `q` debe devolver resultados;
- los filtros permanecen visibles y etiquetados después del submit;
- el estado sigue persistido en URL;
- existe una acción clara para restablecer filtros.

### Incidencias

La UI distingue explícitamente:

- **grupo de incidencia**: agrupación conservadora por proceso, paso, clave de error y fuente;
- **ocurrencias**: errores individuales dentro de los grupos;
- ejecuciones y entidades afectadas.

La salud y el encabezado del listado deben usar las mismas unidades. Ejemplo auditado: `1 grupo · 6 errores · 6 ejecuciones · 2 entidades`.

### Acciones

- las acciones interactivas usan feedback visible de pendiente, éxito y error;
- el descarte de incidencia incluye `sample_error_id` en la idempotency key para permitir recurrencias reales del mismo grupo sin ejecutar dos veces el mismo clic;
- el historial técnico nunca se elimina al descartar una incidencia.

## Caso real que motivó la corrección

Neon mostraba cuatro `PROC-SER-002` individuales en `running`, todos sin heartbeat:

- 2 × The Rookie (`entity_id=125184`);
- 2 × S.W.A.T.: Los hombres de Harrelson (`entity_id=135578`).

Las cuatro cumplen el criterio de atasco. La UI anterior sólo presentaba `2 ejecuciones largas` porque ese indicador contaba únicamente runs de más de 2 horas.

## No cambia

- no se introduce una lista de 100 ejecuciones recientes como contenido principal;
- el historial terminado sigue siendo buscable, no protagonista;
- no se despliega producción desde ChatGPT;
- no se cambia la semántica funcional de los procesos de dominio.
