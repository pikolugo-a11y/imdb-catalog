# PROC-PQ-002 — Captura técnica incremental

Contrato tras la integración con Centro de Operaciones:

- la orden manual desde Calidad crea una única ejecución `PROC-PQ-002`;
- el ejecutor real es Railway;
- pausa y reanudación continúan la misma ejecución;
- detener cierra la ejecución como cancelada;
- Railway registra los hitos de comprobación de biblioteca, progreso de captura y errores;
- el algoritmo incremental y las tablas técnicas existentes no cambian;
- no se añade esquema Neon: la correlación usa la unicidad funcional de una única captura técnica global activa.
