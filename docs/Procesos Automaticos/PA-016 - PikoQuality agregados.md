# PA-016 — PikoQuality agregados

## 1. Identidad
- **ID:** PA-016
- **pipeline job:** `pikoquality_aggregates`
- **Backend:** `rebuildAggregates`
- **Tipo:** manual, fase final PikoQuality

### Punto de entrada
- Calidad → PikoQuality → acción recomendada `aggregate`.

## 2. Objetivo
Reconstruir puntuaciones agregadas de PikoQuality por temporada y serie a partir de episodios evaluados vigentes.

## 3. Flujo
1. Garantiza esquema.
2. Crea run.
3. Borra `piko_quality_aggregates` completo.
4. Calcula por temporada score = 75% mediana + 25% percentil 10.
5. Inserta agregados de temporada.
6. Calcula la misma agregación por serie.
7. Inserta agregados de serie.
8. Cierra run con número de temporadas y shows.

## 4. Volumen
Todo el universo de episodios activos con PikoQuality evaluado/fingerprint vigente. Sin lotes visibles; operación SQL global.

## 5. Fuentes
Solo Neon/PikoQuality persistido.

## 6. Controles
Run success/failed. La tabla se reconstruye desde cero; no hay transacción global explícita alrededor de delete + ambos inserts.

## 7. Salida visual
Indica número de temporadas y series agregadas; al terminar PikoQuality pasa a Todo al día.

## 8. Admin
Alta mediante `pikoquality_aggregates`.

## 9. Recuperación
Relanzable, pero un fallo tras DELETE podría dejar agregados incompletos hasta relanzar.

## 10. Evaluación
Cálculo simple y determinista; principal mejora necesaria: transacción global/estrategia swap para reconstrucción segura.

## 11. Pendientes
1. Hacer reconstrucción atómica.
2. Registrar duración y recuentos antes/después.