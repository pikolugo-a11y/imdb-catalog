# PA-011 — Recálculo de validación cacheada

## 1. Identidad
- **ID:** PA-011
- **pipeline job:** `identity_validation` (source/mode distingue recálculo)
- **Workflow:** `identity-validation-recalculate.yml`
- **Worker:** `identity-validation-recalculate.mjs`
- **Tipo:** manual, asíncrono, sin fuentes externas

### Punto de entrada
- Calidad → Validación de Identidad → **Recalcular cacheadas**.

## 2. Objetivo
Volver a ejecutar el algoritmo de validación usando exclusivamente evidencia ya almacenada, sin consultar IMDb, TMDb ni FilmAffinity.

## 3. Flujo
1. Bloquea si existe validación en curso.
2. Marca como `revalidation_pending` las filas con evidencia completa y IDs aún coincidentes.
3. Audita número preparado.
4. Cuenta universo cacheado.
5. Crea `identity_validation` con `mode=cache_only`, `external_sources=false`.
6. Dispatch workflow específico.
7. Worker recalcula resultados sin red externa.
8. Comparte grupo de concurrencia con PA-010.

## 4. Volumen
Todas las validaciones con evidencia completa cacheada. Workflow timeout 10 min.

## 5. Fuentes
Solo Neon/cache local.

## 6. Controles
- Incompatible con PA-010 simultáneo.
- Verifica que IDs cacheados coincidan con `movies`.
- No usa fuentes externas.
- `pipeline_runs` y auditoría.

## 7. Salida visual
Informa cuántas validaciones fueron preparadas y que no se consultarán fuentes externas.

## 8. Admin
Alta; comparte job type con PA-010 pero se distingue por source, stage `queued_recalculation`, mode `cache_only` y `external_sources=false`.

## 9. Recuperación
Relanzable y barato al no depender de fuentes externas.

## 10. Evaluación
Muy seguro y determinista. Debe mantenerse claramente separado en UI/Admin de una validación que sí repesca fuentes.

## 11. Pendientes
1. Valorar job_type propio para distinguirlo mejor de PA-010.
2. Mostrar comparación antes/después del algoritmo.