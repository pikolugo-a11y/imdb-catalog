# PROC-SER-008 — Cuadrar serie manualmente

Estado: proceso manual excepcional de Calidad · Series.

## Objetivo

Permite aceptar manualmente la cobertura completa de una serie cuando la numeración o distribución real no puede reconciliarse de forma fiable con la referencia oficial, sin falsificar la evidencia física de Plex.

## Semántica

- La decisión se guarda en `series_quality_overrides` con `decision='manual_complete'`.
- Mientras esté activa, todos los episodios oficiales de esa serie se consideran `present` a efectos de Calidad y dejan de aparecer como faltantes o pendientes.
- La evidencia física original (`plex_items`, `plex_files`, `series_diagnostics`) no se modifica ni se borra.
- La ficha distingue explícitamente cobertura efectiva por ajuste manual de cobertura física encontrada en Plex.
- La decisión es reversible: al volver al diagnóstico automático reaparecen los faltantes/anomalías que sigan existiendo.
- El proceso se observa como `PROC-SER-008`, se ejecuta en Vercel porque es una decisión humana corta y no tiene Batch.

## Ubicación física de Series

La ficha de una serie muestra la carpeta física usando datos ya persistidos en Neon. `PROC-SER-002` conserva desde ahora la ruta completa que devuelve Plex en `plex_files.file_path`; no se consulta Plex durante el render. Las filas históricas que sólo conservan el nombre de archivo se completan cuando el usuario ejecuta una vez `Actualizar Plex` para esa serie. No se hace un backfill global de decenas de miles de episodios.
