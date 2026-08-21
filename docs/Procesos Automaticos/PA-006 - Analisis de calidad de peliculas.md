# PA-006 — Análisis de calidad de películas

## 1. Identidad
- **ID:** PA-006
- **Backend:** `analyzeMovieQuality`
- **pipeline job:** `movie_quality_analysis`
- **Tipo:** manual, síncrono

### Puntos de entrada
- Calidad → Películas → Actualizar.
- Calidad (centro de control) → Películas → ↻ Actualizar.

## 2. Objetivo
Analizar películas activas de Plex y detectar incidencias de duración, nombre de fichero, baja PikoQuality y duplicados/versiones.

## 3. Flujo
1. Carga criterios configurables.
2. Crea `pipeline_runs(movie_quality_analysis)` y `movie_quality_runs`.
3. Resuelve incidencias de títulos excluidos.
4. Carga todas las películas activas no excluidas con media/fichero/PikoQuality/Catálogo.
5. Compara duración Plex vs catálogo.
6. Normaliza y compara filename con títulos/año.
7. Genera finding de calidad si PikoQuality está bajo umbral.
8. Detecta IMDb duplicados y carga versiones técnicas.
9. Recomienda versión preferida mediante PikoQuality/ranking técnico cuando son similares.
10. UPSERT de cada finding.
11. Resuelve findings antiguos no encontrados en la ejecución actual.
12. Calcula estadísticas y cierra ambos runs.

## 4. Volumen
Todas las películas activas no excluidas. Los findings se persisten uno a uno; las consultas de versiones se realizan por cada grupo duplicado.

## 5. Fuentes
Neon/Plex ya sincronizado, Catálogo y PikoQuality. No consulta fuentes externas durante el análisis.

## 6. Controles
- Criterios configurables de duración, similitud, PikoQuality y duplicados.
- Preserva `exception` y `waiting_sync` mientras el fingerprint no cambie.
- Findings desaparecidos pasan a `resolved`.
- Run específico + run general.
- Fallo global marca ambos como failed.
- Sin retry automático.

## 7. Escrituras
`movie_quality_findings`, `movie_quality_runs`, `pipeline_runs`; acciones manuales posteriores en `movie_quality_actions`.

## 8. Salida visual
Devuelve número de películas revisadas e incidencias activas. La pantalla muestra findings y permite gestión manual.

## 9. Admin
Alta mediante `movie_quality_analysis`, con criterios, comparables, pendientes, waiting_sync y distribución por tipo.

## 10. Recuperación
Relanzable; el modelo de fingerprint permite conservar excepciones/esperas válidas y resolver incidencias obsoletas.

## 11. Evaluación
Trazabilidad alta, determinismo alto, sin dependencia externa, progreso visual limitado.

## 12. Pendientes
1. Procesamiento/UPSERT por lotes para grandes bibliotecas.
2. Progreso en tiempo real.
3. Revisar coste N+1 en duplicados.