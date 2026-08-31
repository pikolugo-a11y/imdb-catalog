# Batch Engine V1 — piloto DATA-003

- Superficie de lanzamiento: `/calidad/datos`.
- Padre observable: `PROC-DATA-003`, `run_kind=batch`, executor `railway_batch_fast`.
- Cola persistente: `batch_run_items`.
- Control: `batch_run_control`; pausa global: `batch_engine_control`.
- Los child runs individuales nacen sólo al comenzar un item.
- Pausa: deja finalizar in-flight y conserva el mismo parent run.
- Reanudación: mismo parent run y selección original.
- Cancelación: terminal; conserva completados y cancela pendientes no iniciados.
- Lease vencida: cierra child huérfano como fallido y reencola con un nuevo child run, hasta 3 intentos.
- Concurrencia inicial DATA-003: 8; cap del esquema: 32.
- Ejecutor funcional compartido: `lib/data003-canonical.mjs`.
- Worker: `worker/batch-fast-worker.mjs`.
- No se inicia ningún Batch automáticamente tras despliegue; la ejecución piloto requiere acción explícita desde Datos.
