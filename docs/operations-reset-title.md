# PROC-OPS-001 — Reiniciar título desde Novedades

Operación manual de mantenimiento desde Centro de Operaciones.

Semántica:
- requiere IMDb válido y confirmación explícita repitiendo el ID;
- realiza preflight de tablas con `imdb_id` y bloquea dependencias no contempladas;
- elimina el estado derivado del título y la fila `movies` dentro de una transacción;
- recrea `catalog_candidates` como candidato manual `eligible` en la misma transacción;
- no dispara enriquecimiento ni procesamiento posterior automáticamente;
- conserva el historial de `process_runs`, `process_run_events` y `process_run_errors`;
- deja traza before/after y pasos de preflight, reset y verificación.

Uso principal: reiniciar de forma controlada un título para volver a recorrer Novedades → Catálogo → Calidad/Lifecycle sin fabricar estados intermedios.
