# PikoQuality 2.0 — C5 unified candidate

Status: FROZEN CANDIDATE FOR REVALIDATION
Calibration ID: PQ2-C5-UNIFIED-2026-08-27
Date: 2026-08-27

This revision is preserved independently from PQ2 A/B. Do not overwrite it silently. Future changes must create a new calibration ID/revision.

## Goal
One homogeneous PikoQuality formula for movie and episode files. Same technical meaning for the same score regardless of content type.

Targets:
- global mean around 7/10
- approximately 5–7% Suspenso globally
- 9+ reachable but selective
- >=9.5 Matrícula exceptional
- no direct scoring by duration or item_type

## Common technical core

### Video
Video weight inside total: 62%.

Video component:
`video = resolution*0.45 + codec*0.15 + bitDepth*0.10 + density*0.25 + profile*0.05`

Resolution score by height:
- >=2160: 100
- >=1080: 88
- >=720: 72
- >=576: 55
- >=400: 42
- otherwise: 28

Codec score:
- HEVC/H265/AV1: 92
- H264/AVC: 80
- MPEG4/MSMPEG4V3: 42
- other/unknown: 58

Bit depth:
- >=10: 92
- otherwise: 72

Codec-adjusted bitrate density:
`density = videoBitrateKbps / (width*height) * 1,000,000 * codecEfficiency`

codecEfficiency:
- HEVC/H265/AV1: 1.45
- H264/AVC: 1.00
- other: 0.75

Density score:
- >=8: 100
- >=5: 90
- >=3.2: 78
- >=2: 65
- >=1.3: 52
- otherwise: 36

Video profile:
- profile matching High/Main10/Main 10: 90
- known other profile: 72
- missing: 65

FPS has 0 direct weight. Tests found no useful anomaly signal in the current sample.

### Audio
Audio weight inside total: 18%.

`audio = codec*0.45 + channels*0.35 + bitrate*0.20`

Codec:
- TrueHD/DTS-HD MA/FLAC: 95
- EAC3/DTS: 82
- AC3: 72
- AAC/MP3: 58
- other/unknown: 62

Channels:
- >=8: 100
- >=6: 88
- >=2: 65
- otherwise: 50

Audio bitrate:
- >=1000 kbps: 100
- >=640: 88
- >=384: 75
- >=192: 60
- otherwise: 45

### Storage efficiency
Efficiency weight inside total: 15%.

Duration has no direct score. It is used to normalize storage:
`gbPerHour = sizeGiB / durationHours`

Optimal-zone efficiency score:
- missing: 60
- <0.18 GB/h: 35
- <0.30: 48
- <0.45: 65
- <=2.20: 92
- <=3.50: 80
- <=5.00: 66
- >5.00: 50

This deliberately avoids the rule 'smaller is always better'. Extremely small files can be penalized for probable overcompression; oversized files lose storage efficiency.

### Historical context
Historical context weight: 5%.
- unknown year: 75
- <=1959: 95
- <=1979: 90
- <=1999: 85
- <=2009: 68
- 2010+: 55

Historical context does not rescue objectively poor resolution; it only moderates expectations.

### Raw score
`raw = video*0.62 + audio*0.18 + efficiency*0.15 + historical*0.05`

## C5 final unified calibration

The exact final transformation used for C5 is piecewise linear:

- raw <= 60.88: `50 + (raw-60.88)*1.8`
- 60.88 < raw <= 64: interpolate from 50 to 60
- 64 < raw <= 70: interpolate from 60 to 74
- 70 < raw <= 80: interpolate from 74 to 88
- 80 < raw <= 85: interpolate from 88 to 93.5
- raw > 85: premium tail, deliberately compressed so >=95 is exceptional; C5 validation max was 9.56 and only 3/10,870 movies reached Matrícula.

Clamp final score to 0–99.9. Persist internally on 0–100 precision and display preferably /10.

NOTE: The C5 SQL calibration is the canonical executable reference used in the validation run associated with this document. Before production implementation, encode the piecewise function once in shared application code and add regression fixtures reproducing the validation counts below. Do not create separate movie/episode implementations.

## Display categories
- <5.0: Suspenso / buscar otra copia
- 5.0–5.9: Suficiente
- 6.0–6.9: Bien
- 7.0–8.4: Notable
- 8.5–9.4: Sobresaliente
- >=9.5: Matrícula de honor

## Calibration baseline — movies only
10,870 ready movies:
- mean: 6.91
- Suspenso: 720 (6.6%)
- Suficiente: 859
- Bien: 5,131
- Notable: 2,512
- Sobresaliente: 1,645
- Matrícula: 3
- max: 9.56

## Blind validation — same formula, no recalibration
At validation time 15,733 ready files were available:

Combined:
- mean: 6.89
- Suspenso: 925 (5.9%)
- Suficiente: 1,193
- Bien: 8,230
- Notable: 2,775
- Sobresaliente: 2,606
- Matrícula: 4

Movies (10,870):
- mean 6.91
- Suspenso 6.6%
- Matrícula 3

Episodes (4,863):
- mean 6.82
- Suspenso 4.2%
- Suficiente 334
- Bien 3,099
- Notable 263
- Sobresaliente 961
- Matrícula 1

Interpretation: unified C5 generalized well globally. Episode distribution remains more clustered in Bien and had a lower failure rate; this is to be rechecked as Phase 1 captures more episodes. Do not recalibrate yet.

## Revalidation rule
When Phase 1 has materially advanced, rerun this exact C5 formula unchanged first. Compare:
- mean overall, movie, episode
- Suspenso % overall/movie/episode
- complete category distribution
- 9+ and >=9.5 tails

Only create C6 if the larger sample shows meaningful drift. Preserve C5 permanently.

## Production rule
Individual first -> regression validation -> Batch/Railway. Individual and Batch must use the same shared function and formula version. Persist formula version with each calculated result.