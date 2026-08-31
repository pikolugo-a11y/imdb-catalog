# PROC-PQ-001 — C6 Batch canónico

Decisión aprobada: PikoQuality mantiene su Batch C6 como excepción al patrón general individual → Batch.

## Ejecución
- El cálculo funcional sigue en `scorePikoQualityC6` y no se modifica.
- La UI inicia una única ejecución común `PROC-PQ-001` de tipo `batch`.
- Esa misma ejecución sobrevive a todos los bloques C6 y queda visible en Centro de Operaciones.
- Los bloques quedan limitados a 1.000 elementos para dar progreso al frontend y reducir el riesgo de una petición Vercel excesivamente larga.
- Un run activo puede reutilizarse para continuar tras una recarga/interrupción del navegador.
- `pipeline_runs` por bloque se mantiene temporalmente como compatibilidad interna; no es la identidad canónica de la ejecución del usuario.

## Legacy retirado
La entrada individual `Analizar` y su Server Action se retiran. PikoQuality no expone cálculo individual por película.

## Fuera de alcance
- fórmula C6;
- fingerprint técnico;
- captura técnica incremental `PROC-PQ-002`;
- esquema Neon o migraciones.
