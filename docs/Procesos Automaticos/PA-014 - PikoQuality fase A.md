# PA-014 — PikoQuality fase A

## 1. Identidad
- **ID:** PA-014
- **pipeline job:** `pikoquality_a`
- **Backend:** `processABatch`
- **Fórmula:** 1.0.0
- **Tipo:** manual por lotes desde UI

### Punto de entrada
- Calidad → PikoQuality → ejecutar acción recomendada cuando fase=A.

## 2. Objetivo
Calcular una primera puntuación técnica usando exclusivamente metadatos ya persistidos de Plex, sin llamadas externas por elemento.

## 3. Volumen
- Lote por defecto: **5.000**.
- Máximo aceptado por backend: **10.000**.
- El runner repite lotes automáticamente mientras la recomendación siga siendo A y la pestaña permanezca ejecutando.

## 4. Flujo
1. Garantiza esquema PikoQuality.
2. Recupera stale runs A >15 min como failed.
3. Crea run `pikoquality_a`.
4. Selecciona movie/episode nuevos, con fórmula antigua o fingerprint cambiado.
5. Calcula mediana bitrate de temporada para episodios.
6. Calcula score 0-100 y banda.
7. UPSERT masivo en `piko_quality`, confidence medium, status evaluated.
8. Cuenta pendientes y cierra run.
9. UI vuelve a llamar al siguiente lote mientras continúe fase A.

## 5. Criterios técnicos
Resolución, bitrate frente a objetivo por codec/resolución, codec vídeo, bit depth, HDR, codec/canales/bitrate audio, integridad y extras; episodios ajustan por mediana de temporada.

## 6. Controles
- Fingerprint evita recalcular sin cambios.
- Versión de fórmula fuerza recálculo cuando cambia.
- Recuperación de runs colgados >15 min.
- Cada lote deja `pipeline_runs` independiente.
- Botón Pausar detiene después del lote actual.

## 7. Salida visual
Excelente: barra de progreso, porcentaje, procesados del lote, pendientes, botón de pausa y mensajes de error. Puede cerrarse y continuar posteriormente.

## 8. Admin
Alta: cada lote queda registrado con fórmula, batch y remaining.

## 9. Recuperación
Muy buena: trabajo persistido por lote y selección basada en pendientes/fingerprint.

## 10. Evaluación
Proceso robusto, incremental y reanudable. El principal riesgo es el coste de lotes grandes dentro del límite de ejecución HTTP.

## 11. Pendientes
1. Ajuste dinámico de lote según tiempos.
2. Métricas de duración por lote en UI/Admin.