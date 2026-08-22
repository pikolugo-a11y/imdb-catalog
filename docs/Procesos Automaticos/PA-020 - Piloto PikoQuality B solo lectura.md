# PA-020 — Piloto PikoQuality B solo lectura

## 1. Identidad
- **ID:** PA-020
- **Backend:** `runPikoQualityBPilot`
- **Tipo:** manual, diagnóstico solo lectura

### Punto de entrada
- Calidad → `/calidad/pikoquality-pilot` → **Ejecutar piloto B** (`?run=1`).

## 2. Objetivo
Comparar metadatos A ya persistidos con streams B obtenidos en vivo de Plex sin modificar Plex ni Neon.

## 3. Volumen
Hasta **16 elementos**: máximo 2 por cada uno de 8 buckets técnicos. Consultas Plex secuenciales; timeout 30 s.

## 4. Flujo
1. Exige PLEX_TOKEN y descubre Plex.
2. Selecciona muestra de películas/episodios por resolución, codec y época.
3. Consulta `/library/metadata/{ratingKey}`.
4. Extrae streams vídeo/audio/subtítulos, bitrate, bit depth, HDR/DV, color, etc.
5. Compara A vs B.
6. Devuelve resultados únicamente a la página.

## 5. Persistencia
Ninguna. Es explícitamente read-only.

## 6. Salida visual
Muy alta: tabla A→B y KPIs de cobertura.

## 7. Admin
Ninguna: a diferencia de PA-019, no crea `pipeline_runs`.

## 8. Recuperación
No necesaria; puede relanzarse.

## 9. Evaluación
Seguro para pruebas, pero existen dos pilotos B similares (PA-019 y PA-020) con trazabilidad distinta; conviene revisar duplicidad.