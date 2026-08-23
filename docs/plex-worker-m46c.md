# M46-C — Plex en Railway

El sync Plex canónico se ejecuta como trabajo `maintenance` dentro del API worker de Railway, no en Vercel ni en GitHub Actions.

## Reglas

- Fuente: `plex`.
- Stage batch: `PLEX_SYNC`.
- Job de prueba: `plex-library-sections` (solo conectividad).
- Job de sync completo: `plex-full-sync`.
- Concurrencia: 1.
- Kill switch: `batch_runtime_control.paused`.
- Breaker y presupuesto: `batch_source_limits` para `plex`.
- El sync conserva la lógica canónica existente: películas, series, GUIDs, media, ficheros, altas/cambios/bajas, `plex_catalog_status` y reconciliación de referencias de series.

## Checkpoints

El trabajo completo guarda en `batch_jobs.result_summary.completed_sections` las secciones Plex terminadas. Si el worker se interrumpe, el retry reutiliza ese checkpoint y no vuelve a procesar las secciones ya confirmadas.

Durante la fase de detalle el worker renueva el lease del job y consulta el kill switch. Si se pausa globalmente, el job pasa a retry y queda reanudable cuando se abra de nuevo el motor.

## Seguridad operativa

Antes de cualquier primera ejecución completa:

1. probar conectividad con `plex-library-sections`;
2. mantener `max_concurrency=1`;
3. usar un presupuesto explícito;
4. ejecutar un único `plex-full-sync`;
5. volver a PAUSAR el motor y deshabilitar Plex al finalizar la validación;
6. no desplegar Vercel como parte de esta operación.
