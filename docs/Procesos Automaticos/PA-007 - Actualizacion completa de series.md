# PA-007 — Actualización completa de series

## 1. Identidad
- **ID:** PA-007
- **pipeline job:** `series_v2_refresh`
- **Workflow:** `series-full-refresh.yml`
- **Worker:** `worker/series-full-refresh.mjs`
- **Tipo:** manual, asíncrono GitHub Actions

### Puntos de entrada
- Calidad → Series → **Actualizar todas las series**.
- Calidad → centro de control → Series → **↻ Actualizar todas**.

## 2. Objetivo
Recorrer todo el universo activo de series con TMDb, reconstruir temporadas/episodios oficiales, estimar disponibilidad en España y detectar episodios Plex no mapeados.

## 3. Flujo
1. Comprueba si existe run activo reciente (<2 h); si sí, reutiliza su estado.
2. Cuenta universo elegible y crea run queued.
3. Dispatch a GitHub con `run_id`.
4. Worker carga todas las series elegibles.
5. Captura snapshot de incidencias antes.
6. Procesa con 6 workers concurrentes.
7. Por serie consulta TMDb TV + watch/providers ES.
8. Por temporada consulta TMDb season y guarda disponibilidad/episodios.
9. Episodios se escriben en lotes de 200.
10. Respeta `manual_override` de disponibilidad.
11. Actualiza referencia de serie.
12. Actualiza progreso cada 10 series o al terminar.
13. Captura snapshot final y delta.
14. Cierra run y auditoría.

## 4. Volumen y concurrencia
- Universo completo de `series_reference` activas con `tmdb_id`.
- 6 series concurrentes.
- Episodios: lotes de 200.
- Workflow 30 min; worker 25 min.

## 5. Fuentes
TMDb (metadatos, temporadas, episodios, watch providers ES) + Neon/Plex sincronizado.

## 6. Controles
- Evita segunda ejecución si ya hay una activa reciente.
- TMDb reintenta 429/5xx hasta 4 veces con backoff/retry-after.
- Errores por serie son tolerados y contabilizados; continúa el resto.
- `manual_override` de disponibilidad no se pisa.
- Workflow tiene handler de fallo de infraestructura que fuerza `pipeline_runs=failed` si el worker no lo cerró.
- Concurrency GitHub global, `cancel-in-progress=false`.

## 7. Escrituras
`series_reference`, `series_reference_episodes`, `series_season_availability`, `pipeline_runs`, `admin_events`.

## 8. Salida visual
El centro de Calidad muestra progreso, procesadas/total, porcentaje, temporadas, episodios y errores; se refresca automáticamente cada 5 s mientras hay procesos activos.

## 9. Admin
Muy alta: progreso vivo, métricas before/after/delta, errores, título actual y auditoría.

## 10. Recuperación
Relanzable e idempotente por UPSERT. No hay checkpoint formal, pero los datos completados quedan persistidos. Fallos individuales no detienen el universo.

## 11. Evaluación
Proceso robusto: reintentos TMDb, concurrencia limitada, progreso y fallo de infraestructura cubierto.

## 12. Pendientes
1. Valorar checkpoint/reanudación explícita si supera timeout.
2. Revisar semántica de `success` cuando existen errores parciales.
3. Mostrar detalle de series fallidas para retry selectivo.