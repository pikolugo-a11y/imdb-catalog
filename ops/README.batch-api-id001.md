# Batch API V1 · ID-001

- Pool: `api`
- Adapter inicial: `PROC-ID-001`
- Concurrencia por proceso: 3
- Fuente usada: TMDb
- TMDb no tiene cuota diaria inventada; usa concurrencia y breaker.
- OMDb: 100000/día, 90% Batch.
- MDBList: 25000/día, 90% Batch.
- Ningún Batch se inicia automáticamente.
- Validación funcional prevista: 1 → 5 → 25 → lote mayor.
