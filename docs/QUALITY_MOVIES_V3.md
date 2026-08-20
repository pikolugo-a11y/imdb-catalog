# Calidad → Películas V3

## Objetivo funcional
La pantalla responde a una única pregunta: qué películas físicas de Plex presentan una incidencia concreta que requiere revisión y qué debe hacer el usuario con cada una.

## Detectores
- **Duración**: compara duración física Plex con runtime de catálogo. Se exige simultáneamente una diferencia absoluta y porcentual configurables.
- **Nombre de archivo**: normaliza tags técnicos y calcula similitud por tokens contra título Plex, español, original y catálogo. Un nombre irreconocible puede alertar aunque no incluya año; un año incompatible aumenta el riesgo.
- **Varias versiones**: agrupa por IMDb. La diferencia de duración permite distinguir duplicado probable de posible montaje distinto. No se borra ningún archivo automáticamente.
- **Calidad técnica**: no existe un segundo motor paralelo. La alerta usa exclusivamente el `score` persistido de PikoQuality cuando está evaluado. El umbral aceptable es configurable.

## Criterios configurables
Se persisten en `app_settings` bajo `movie_quality_v3` y se editan desde la propia pantalla:
- `duration.minMinutes` (default 10)
- `duration.minPercent` (default 15)
- `filename.minSimilarity` (default 0.55)
- `pikoQuality.minScore` (default 60)
- `duplicates.verySimilarPercent` (default 2)
- `duplicates.differentCutPercent` (default 10)

Cambiar criterios no modifica hallazgos inmediatamente. Se aplican en la siguiente ejecución de **Actualizar**. El cambio queda auditado en `admin_events`.

## Riesgo
- 85–100 crítico
- 65–84 alto
- 40–64 medio
- <40 bajo

## Estados
- `pending`: requiere revisión.
- `waiting_sync`: el usuario corrigió el archivo; se espera nueva sincronización/análisis.
- `exception`: el usuario confirma que el archivo es correcto. La excepción se conserva mientras la fingerprint no cambie y la anomalía siga existiendo.
- `resolved`: la anomalía dejó de detectarse. También se resuelven excepciones obsoletas, conservando su historial en `movie_quality_actions`.

## UX V3
Cabecera con última ejecución y Actualizar; resumen de películas afectadas y prioridad; KPIs por detector; filtros de estado/tipo/riesgo; bloque plegable de criterios; tarjetas de diagnóstico en lenguaje humano; PikoQuality visible en alertas técnicas; acciones directas **Es correcta** / **Ya la corregí**; paginación de 10 resultados.

## Trazabilidad
`movie_quality_analysis` queda en `pipeline_runs`. Acciones manuales y cambios de criterios quedan en `admin_events` / `movie_quality_actions` según corresponda.
