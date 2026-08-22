# PA-008 — Reevaluación completa de identidad

## 1. Identidad
- **ID:** PA-008
- **pipeline job:** `identity_scan`
- **Workflow:** `identity-full-refresh.yml`
- **Workers:** `identity-full-refresh-safe.mjs` (full) / `identity-full-refresh.mjs` (brave_test)
- **Tipo:** manual, asíncrono

### Puntos de entrada
- Calidad → Identidad → **Reanalizar todo**.
- Calidad → centro de control → Identidad → **↻ Actualizar todo**.
- Calidad → Identidad → prueba Brave (modo limitado) usa el mismo motor/run con `mode=brave_test`.

## 2. Objetivo
Localizar/completar IDs faltantes (TMDb/FilmAffinity) de títulos del catálogo y actualizar su estado de identidad.

## 3. Alcance
Modo full selecciona títulos no excluidos con IMDb válido y TMDb ausente o FA ausente sin resultado terminal previo. Modo Brave limita a 30 títulos sin FA.

## 4. Ejecución
1. Finaliza cancelaciones antiguas que hayan quedado stale.
2. Reutiliza un `identity_scan` activo (<3 h) en lugar de duplicarlo.
3. Cuenta universo y crea run queued.
4. Si total=0 cierra success inmediatamente.
5. Dispatch a GitHub con run_id y mode.
6. Workflow full prepara Node+Python; brave_test solo Node.
7. Ejecuta worker por bloques.
8. Worker actualiza `pipeline_runs` con progreso/bloque/errores.
9. Puede solicitarse cancelación; se detiene al acabar el bloque actual.
10. Si cancel_requested queda sin worker >2 min, la UI/control lo autofinaliza como failed/cancelled.
11. Fallo de infraestructura del workflow fuerza cierre failed.

## 5. Volumen y límites
- Full: todos los títulos que cumplen condición de IDs faltantes.
- Brave test: máximo 30.
- Workflow: 120 min; worker: 110 min.
- Una ejecución global por grupo GitHub.

## 6. Fuentes
IMDb como identidad base, TMDb, FilmAffinity y mecanismos de resolución implementados por los workers; Neon para estado/progreso.

## 7. Controles
- No duplica ejecución activa.
- Cancelación cooperativa por bloques.
- Auto-finalización de cancelación stale a los 2 min.
- Run vivo con heartbeat `updated_at`.
- Workflow captura fallo de infraestructura.
- Modo seguro separado del Brave test.

## 8. Salida visual
Calidad/Identidad muestra procesados/total, porcentaje, bloque actual, errores y permite detener. Calidad se auto-refresca cada 5 s mientras está activo.

## 9. Admin
Muy alta: `identity_scan`, progreso, updated_count, error_count, summary por bloques y auditoría de dispatch/cancel/fallos.

## 10. Recuperación
Relanzable; cancelación controlada. El trabajo se persiste por bloques, aunque no hay rollback global.

## 11. Evaluación
Arquitectura robusta para procesos largos; buena observabilidad y cancelación. Riesgo principal: dependencia de fuentes externas y duración máxima.

## 12. Pendientes
1. Documentar/mostrar claramente qué bloque/fuente falló por título.
2. Retry selectivo de fallidos.
3. Diferenciar cancelled de failed como estado propio.