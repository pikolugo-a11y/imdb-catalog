# PikoQuality 2.0 — fórmula congelada revisión B

Estado: **FROZEN CANDIDATE B**
Fecha: 2026-08-27
Issue: #264
Identificador: **PQ2-FROZEN-2026-08-27-B**

La revisión A (`PQ2-FROZEN-2026-08-27-A`) se conserva intacta como referencia histórica. Esta revisión B sustituye a A como candidata preferente porque ha sido calibrada sobre una muestra mayor y cumple simultáneamente los objetivos de distribución.

## Objetivos cumplidos en la muestra de validación

Muestra real: **2.324 películas** con snapshot técnico `ready`.

Resultados:
- Media: **6,91 / 10**
- Suspenso (<5,0): **135 (5,8%)**
- Suficiente (5,0–5,9): **555**
- Bien (6,0–6,9): **562**
- Notable (7,0–8,4): **581**
- Sobresaliente (8,5–9,4): **488**
- Matrícula (>=9,5): **3**
- Mínimo observado: **4,3**
- Máximo observado: **9,9**

Objetivos de calibración:
1. Media alrededor de 7/10.
2. Suspensos / recaptura entre 5% y 7%.
3. Rango 9+ alcanzable y significativo.
4. Matrícula excepcional.
5. Mantener la filosofía técnica, histórica y de eficiencia de almacenamiento.

## Score técnico bruto (raw)

Se conserva la base de la revisión A.

### Vídeo

`video = resolution*0.55 + codec*0.15 + bitDepth*0.10 + bitrate*0.20`

Resolución por altura:
- >=2160: 100
- >=1080: 88
- >=720: 72
- >=576: 55
- >=400: 42
- resto: 28

Códec vídeo:
- HEVC/H265/AV1: 92
- H264/AVC: 80
- MPEG4/MSMPEG4V3: 42
- otros/desconocido: 58

Bit depth:
- >=10: 92
- resto: 72

Bitrate vídeo (kbps):
- >=15000: 100
- >=8000: 90
- >=4000: 78
- >=2000: 65
- >=1000: 52
- resto: 38

### Audio

`audio = codec*0.45 + channels*0.35 + bitrate*0.20`

Códec audio:
- TrueHD / DTS-HD MA / FLAC: 95
- EAC3 / DTS: 82
- AC3: 72
- AAC / MP3: 58
- otros/desconocido: 62

Canales:
- >=8: 100
- >=6: 88
- >=2: 65
- mono/otro: 50

Bitrate audio (kbps):
- >=1000: 100
- >=640: 88
- >=384: 75
- >=192: 60
- resto: 45

### Eficiencia de almacenamiento

`gbPerHour = sizeGiB / durationHours`

`efficiency = clamp(105 - gbPerHour*8, 40, 95)`

La eficiencia nunca reemplaza la calidad visual: un archivo muy pequeño con vídeo pobre sigue penalizado por el componente de vídeo.

### Contexto histórico

- <=1959: 95
- 1960–1979: 90
- 1980–1999: 85
- 2000–2009: 68
- 2010+: 55
- año desconocido: 75

No es un premio por antigüedad; solo contextualiza expectativas.

### Composición raw

`raw = video*0.62 + audio*0.18 + efficiency*0.15 + historical*0.05`

## Transformación final B — EXACTA

La revisión B usa una transformación lineal por tramos. Es la parte que no debe perderse.

```text
if raw <= 53.7:
    final = 50 + (raw - 53.7) * 2.2
elif raw <= 60:
    final = 50 + (raw - 53.7) * (20.0 / 6.3)
elif raw <= 70:
    final = 70 + (raw - 60) * 1.15
elif raw <= 80:
    final = 81.5 + (raw - 70) * 1.0
elif raw <= 85:
    final = 91.5 + (raw - 80) * (3.5 / 5.0)
else:
    final = 95 + (raw - 85) * (4.5 / 2.1)

final = clamp(final, 0, 99.5)
score10 = final / 10
```

### Interpretación de los anclajes

- raw 53,7 ≈ 5,0/10. En la muestra de calibración deja 5,8% de suspensos.
- raw 60 = 7,0/10.
- raw 70 = 8,15/10.
- raw 80 = 9,15/10.
- raw 85 = 9,5/10.
- máximo limitado a 9,95/10 para mantener excepcionalidad y evitar 10 automáticos.

## Escala visible

- <5,0 — Suspenso / buscar otra copia
- 5,0–5,9 — Suficiente
- 6,0–6,9 — Bien
- 7,0–8,4 — Notable
- 8,5–9,4 — Sobresaliente
- 9,5–10 — Matrícula de honor

Mantener precisión interna 0–100 y mostrar preferentemente /10.

## Reglas de producto

- El score no debe depender de etiquetas de calidad derivadas de Plex si hay datos técnicos observables del archivo.
- Tamaño = eficiencia/coste de almacenamiento, nunca `más GB = más calidad`.
- HEVC/AV1 se tratan como códecs más eficientes que H.264.
- El año contextualiza; no convierte una copia mala en buena.
- Una resolución/imagen pobre no puede ser salvada por ocupar poco.

## Implementación obligatoria

1. Implementar primero en análisis INDIVIDUAL.
2. Persistir `formula_version = PQ2-FROZEN-2026-08-27-B` (o equivalente versionado estable).
3. Añadir fixtures/regresión con entradas técnicas y outputs exactos.
4. Validar el individual con casos reales.
5. Solo después trasladar al Batch/Railway.
6. Individual y Batch deben usar la misma función compartida; prohibido duplicar fórmulas independientes.
7. Test de paridad obligatorio: mismos datos => mismo score, categoría y versión.

## Trazabilidad

- Revisión anterior: `docs/pikoquality-2-formula-frozen.md` — `PQ2-FROZEN-2026-08-27-A`.
- Revisión actual preferente: este documento — `PQ2-FROZEN-2026-08-27-B`.
- No sobrescribir ni borrar A.
- Toda futura recalibración debe crear revisión C, D, etc., preservando esta B.