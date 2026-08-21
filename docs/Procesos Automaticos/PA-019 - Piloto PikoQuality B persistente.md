# PA-019 — Piloto PikoQuality B persistente

## 1. Identidad
- **ID:** PA-019
- **pipeline job:** `pikoquality_b_probe`
- **Backend:** `runPikoQualityBProbe`
- **Tipo:** manual de diagnóstico

### Punto de entrada
- Admin → PikoQuality Probe → ejecutar piloto.

## 2. Objetivo
Probar sobre una muestra representativa qué metadatos de streams devuelve Plex antes/durante la evolución de PikoQuality B.

## 3. Volumen
Selecciona hasta 2 muestras de 6 buckets técnicos (máximo aproximado 12), consultadas secuencialmente. Timeout Plex 30 s por petición.

## 4. Flujo
1. Exige PLEX_TOKEN.
2. Crea `pikoquality_b_probe`.
3. Descubre Plex.
4. Selecciona muestra por buckets (1080 HEVC/H264, SD, episodios por épocas, etc.).
5. Consulta detalle Plex.
6. Resume streams, bitrate, bit depth, color, HDR, audio y subtítulos.
7. Calcula cobertura de campos.
8. Guarda resultados completos en summary del pipeline run.

## 5. Salida visual
Muestra cobertura y último resultado del piloto.

## 6. Admin
Muy alta por definición: el resultado vive en `pipeline_runs` y la pantalla Admin específica.

## 7. Recuperación
Relanzable; solo diagnóstico.

## 8. Evaluación
Proceso seguro y acotado, útil como herramienta técnica; no forma parte del pipeline productivo principal.