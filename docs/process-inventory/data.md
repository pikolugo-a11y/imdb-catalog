# Inventario de procesos — Datos

Fuente complementaria a las issues maestras de inventario.

## Procesos activos localizados

- PROC-DATA-001 — Actualizar datos estructurales
- PROC-DATA-002 — Refrescar ratings por título vía MDBList
- PROC-DATA-003 — Calcular/recalcular PikoScore
- PROC-DATA-004 — Editar campos manualmente
- PROC-DATA-005 — Aceptar datos incompletos manualmente
- PROC-DATA-006 — Guardar rating manual
- PROC-DATA-007 — Fijar PikoScore manualmente en 5,0
- PROC-DATA-008 — Refresh global manual de ratings IMDb desde dataset oficial

## Hallazgos transversales

- El Batch Lifecycle actual de DATA implementa lógica funcional propia (`dataTmdb`, `dataOmdb`, `dataFilmAffinity`, `finalizeDataStage`) y no ejecuta los unitarios canónicos. La lógica funcional Batch es candidata a ELIMINAR cuando se reconstruya el Batch común.
- El Batch DATA mezcla datos estructurales y ratings, mientras el frontal moderno los separa explícitamente.
- El proceso global IMDb ratings usa GitHub Actions `workflow_dispatch`, por tanto es manual, no automático. Actualiza masivamente `catalog_candidates` y `movies` desde `title.ratings.tsv.gz`.
- La topología futura de workers y el reparto de Batch simultáneos queda PENDIENTE hasta finalizar el inventario completo.

No implementar cambios durante esta fase.
