# PikoQuality 2.0 — fórmula congelada y reproducible

Estado: **FROZEN CANDIDATE**
Fecha de congelación: 2026-08-27
Issue de decisión: #264

> Este documento existe para que la calibración no vuelva a depender del contexto de un chat. Cualquier cambio futuro debe incrementar la versión y validarse explícitamente antes de sustituir esta referencia.

## Objetivos de calibración

- Media aproximada de la biblioteca: ~7,0/10.
- Suspensos (<5,0): aproximadamente 5–7%, interpretados como candidatos claros a buscar otra copia.
- 9+ alcanzable pero selectivo; Matrícula (>=9,5) excepcional.
- Medir calidad útil del archivo, no tamaño bruto.
- Premiar eficiencia de almacenamiento sin permitir que un archivo pequeño compense una imagen objetivamente mala.
- Contextualizar el año sin regalar puntos por antigüedad.
- Ser codec-aware: HEVC/AV1 pueden conseguir calidad equivalente con menor bitrate que H.264.

## Escala visible

- <5,0: Suspenso — buscar otra copia
- 5,0–5,9: Suficiente
- 6,0–6,9: Bien
- 7,0–8,4: Notable
- 8,5–9,4: Sobresaliente
- 9,5–10: Matrícula de honor

Mantener precisión interna 0–100 y mostrar preferentemente /10.

## Score técnico base (0–100)

La referencia congelada parte de cuatro componentes:

- vídeo: 62%
- audio: 18%
- eficiencia: 15%
- contexto histórico: 5%

### Vídeo

`video = resolution*0.55 + codec*0.15 + bitDepth*0.10 + bitrate*0.20`

Resolución por altura:
- >=2160: 100
- >=1080: 88
- >=720: 72
- >=576: 55
- >=400: 42
- resto: 28

Códec:
- HEVC/H265/AV1: 92
- H264/AVC: 80
- MPEG4/MSMPEG4V3: 42
- otros/desconocido: 58

Bit depth:
- >=10 bit: 92
- resto: 72

Bitrate de vídeo (usar bitrate del stream de vídeo y, si falta, bitrate de media):
- >=15000 kbps: 100
- >=8000: 90
- >=4000: 78
- >=2000: 65
- >=1000: 52
- resto: 38

### Audio

`audio = codec*0.45 + channels*0.35 + bitrate*0.20`

Códec:
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

Bitrate audio:
- >=1000 kbps: 100
- >=640: 88
- >=384: 75
- >=192: 60
- resto: 45

### Eficiencia de almacenamiento

Primero calcular `gbPerHour = sizeGiB / durationHours`.

`efficiency = clamp(105 - gbPerHour*8, 40, 95)`

El tamaño se interpreta como coste de almacenamiento, nunca como señal directa de calidad. El componente de vídeo conserva prioridad suficiente para impedir que una copia SD diminuta sea premiada por ocupar poco.

### Contexto histórico

No es un bonus directo de calidad ni sustituye resolución. Es una corrección pequeña de contexto:
- año <=1959: 95
- 1960–1979: 90
- 1980–1999: 85
- 2000–2009: 68
- 2010+: 55
- año desconocido: 75

`raw = video*0.62 + audio*0.18 + efficiency*0.15 + historical*0.05`

## Calibración final reproducible

La reconstrucción conservadora del score técnico anterior sobre 1.894 películas dio media 6,41/10 y 5,4% de suspensos. El suelo era correcto pero el centro estaba ~0,5 puntos demasiado bajo.

Para preservar el umbral inferior y recuperar una media próxima a 7 se congela una transformación **por tramos**, no un +0,5 global:

```
if raw < 50:
    final = raw
else:
    final = raw + 8
```

Después:

```
final = clamp(final, 0, 100)
score10 = final / 10
```

Razón: no mover el grupo de recaptura (<5) y elevar el cuerpo de la distribución aproximadamente 0,8 puntos. Con 5,4% de elementos bajo 50 en la muestra de 1.894, la media esperada pasa de ~6,41 a ~7,17, dentro del objetivo de 'rondando 7'.

### Regla premium

El 9+ no debe obtenerse solo por una suma accidental. Al implementar la fórmula productiva, conservar el gate premium ya acordado: un único atributo (por ejemplo 4K) no basta. El score >=90 requiere combinación de vídeo alto, audio sólido y eficiencia razonable. Antes de producción se debe codificar este gate en la misma función compartida y cubrirlo con fixtures; no mantener una variante independiente en Batch.

## Baseline de validación

Referencia previa aceptada (1.607 películas):
- media 6,87/10
- suspenso: 89 (5,5%)
- suficiente: 459
- bien: 299
- notable: 385
- sobresaliente: 372
- matrícula: 3

Última muestra observada antes de esta congelación (1.894 películas), reconstrucción sin ajuste final:
- media 6,41/10
- suspenso: 103 (5,4%)

Con la transformación congelada se espera ~7,17 de media manteniendo exactamente esos 103 suspensos, sujeto a validación SQL exacta sobre la muestra vigente.

## Implementación obligatoria

1. Implementar y validar primero en análisis INDIVIDUAL.
2. Persistir `formula_version` nueva y fingerprint técnico.
3. Crear fixtures/casos de regresión que congelen entradas y outputs.
4. Solo después trasladar la misma implementación al Batch/Railway.
5. Individual y Batch deben importar/usar una única función compartida; no duplicar la fórmula.
6. Test de paridad obligatorio: mismos datos => mismo score, categoría y versión.

## Identificador

Nombre de trabajo: `PikoQuality 2.0 Frozen Candidate`
Calibración: `PQ2-FROZEN-2026-08-27-A`

No modificar este documento en silencio. Cualquier recalibración debe crear una nueva revisión/identificador y conservar trazabilidad de esta versión.