# PA-015 — PikoQuality fase B

## 1. Identidad
- **ID:** PA-015
- **pipeline job:** `pikoquality_b`
- **Backend:** `enrichPending`
- **Tipo:** manual por lotes con consultas Plex

### Puntos de entrada
- Calidad → PikoQuality → fase B recomendada.
- Calidad → PikoQuality → `retry_b` para errores.

## 2. Objetivo
Enriquecer PikoQuality con streams detallados de Plex para elevar confianza y recalcular score con bitrate/bit depth/HDR/audio reales.

## 3. Volumen y concurrencia
- Lote B por defecto: **120**.
- Máximo backend: 250.
- Retry B usa lote **80** e incluye filas `error`.
- Consultas Plex: chunks de **12 concurrentes**.
- Timeout por detalle Plex: **30 s**.

## 4. Flujo
1. Garantiza esquema y PLEX_TOKEN.
2. Recupera runs B stale >15 min.
3. Descubre URL Plex.
4. Selecciona evaluados A sin `enriched_at`; retry incluye errores.
5. Consulta metadata detallada por chunks de 12.
6. Extrae mejor vídeo y mejor audio y recuenta streams.
7. Recalcula score.
8. Éxitos → confidence high/evaluated/enriched.
9. 404 → stale/low.
10. Otros errores → error/low con `last_error`.
11. Cierra run como success incluso si existen errores individuales, contabilizándolos.
12. Runner continúa lotes hasta cambiar de fase o pausar.

## 5. Fuentes
Plex remoto + Neon.

## 6. Controles
- Fallback de descubrimiento Plex.
- Timeout 30 s.
- Error individual aislado: no detiene lote.
- Estados `evaluated`, `stale`, `error`.
- Retry específico para errores.
- Recuperación de run stale.

## 7. Salida visual
Barra/progreso, enriquecidos, stale, errores, pendientes y pausa tras lote.

## 8. Admin
Alta: cada lote registra batch, includeErrors, enriched/stale/errors/remaining y streams inspeccionados.

## 9. Recuperación
Muy buena: persistencia incremental, retry de errores y pausa segura.

## 10. Evaluación
Robusto y bien diseñado para fallos parciales. Punto a revisar: un lote con errores sigue marcado globalmente `success`.

## 11. Pendientes
1. Estado partial/success_with_errors.
2. Retry con backoff para errores transitorios.
3. Exponer lista de elementos fallidos.