# PikoQuality 2.0 — C6 FINAL (FROZEN)

Status: **DEFINITIVE / APPROVED / FROZEN**
Date: 2026-08-27

> GOLDEN RULE: Do not recalibrate, normalize, tune, or change these formulas merely to obtain a desired mean or distribution. Any future change requires an explicit new formula version and validation against this C6 baseline.

## Decision

PikoQuality 2.0 uses one common technical core with two context-specific calibration models:

- **PQ2-Movie** — movie/cinema expectation.
- **PQ2-Episode-TV** — television/platform expectation; 1080p is a fully valid premium target and 4K is not implicitly required for an excellent score.

Both expose the same user-facing 0–10 PikoQuality scale and category semantics.

## Final category scale

- `< 5.0` — Suspenso / candidate to seek a better copy
- `5.0–5.9` — Suficiente
- `6.0–6.9` — Bien
- `7.0–8.4` — Notable
- `8.5–9.4` — Sobresaliente
- `>= 9.5` — Matrícula de honor

## Common technical core

The model combines:

- video resolution / contextual resolution expectation
- video codec efficiency
- bit depth
- bitrate density per pixel
- video profile
- audio codec, channels and bitrate
- storage efficiency (GB/hour)
- historical/year context

### Critical density correction

Plex bitrate values are in kbps. Density must therefore be calculated in units consistent with the thresholds as Mbps per megapixel:

`density = (video_bitrate_kbps / 1000) / (width * height / 1,000,000) * codec_efficiency_factor`

Equivalent:

`density = video_bitrate_kbps / (width * height) * 1000 * codec_efficiency_factor`

Codec efficiency factor:

- HEVC/H.265/AV1: `1.45`
- H.264/AVC: `1.00`
- Other: `0.75`

Density bands:

- `>= 8`: 100
- `>= 5`: 90
- `>= 3.2`: 78
- `>= 2`: 65
- `>= 1.3`: 52
- otherwise: 36

### Other common component bands retained from C5/C6 validation

Video codec score:
- HEVC/H.265/AV1: 92
- H.264/AVC: 80
- MPEG4/MSMPEG4V3: 42
- other: 58

Bit depth:
- >=10-bit: 92
- otherwise: 72

Video profile:
- high / main10 / main 10: 90
- known other profile: 72
- unknown: 65

Audio quality is composed from codec (45%), channels (35%), bitrate (20%).

Storage efficiency (GB/hour):
- <0.18: 35
- <0.30: 48
- <0.45: 65
- 0.45–2.20: 92
- <=3.50: 80
- <=5.00: 66
- >5.00: 50
- unknown: 60

Historical context:
- <=1959: 95
- <=1979: 90
- <=1999: 85
- <=2009: 68
- >=2010: 55
- unknown: 75

Common weighting architecture:

`video = resolution*0.45 + codec*0.15 + bit_depth*0.10 + density*0.25 + profile*0.05`

`raw = video*0.62 + audio*0.18 + storage_efficiency*0.15 + historical_context*0.05`

## PQ2-Movie FINAL

Movie resolution expectation:
- >=2160p: 100
- >=1080p: 88
- >=720p: 72
- >=576p: 55
- >=400p: 42
- lower: 28

The C6 Movie calibration is frozen from the validated 10,870-movie population. Its calibrated output baseline is:

- Mean: **6.54**
- Suspenso: **622 (5.72%)**
- Suficiente: **1,983**
- Bien: **5,535**
- Notable: **2,186**
- Sobresaliente: **513**
- Matrícula: **31**
- >=9.0: **343**
- Maximum observed: **9.95**

## PQ2-Episode-TV FINAL

Episode/TV contextual resolution expectation:
- >=2160p: 100
- >=1080p: 100
- >=720p: 86
- >=576p: 66
- >=400p: 50
- lower: 32

Principle: a high-quality 1080p platform/TV master can legitimately be exceptional. 4K, lossless cinema audio, etc. are bonuses, not implicit prerequisites for an excellent TV score.

The C6 Episode-TV calibration is frozen from the validated 52,758-episode population. Its calibrated output baseline is:

- Mean: **6.50**
- Suspenso: **2,414 (4.58%)**
- Suficiente: **10,756**
- Bien: **26,151**
- Notable: **10,799**
- Sobresaliente: **2,521**
- Matrícula: **117**
- >=9.0: **1,452**
- Maximum observed: **9.95**

## Full-library validation baseline

Validated ready population: **63,628** technical snapshots.

- Mean: **6.51**
- Suspenso: **3,036 (4.77%)**
- Suficiente: **12,739**
- Bien: **31,686**
- Notable: **12,985**
- Sobresaliente: **3,034**
- Matrícula: **148**
- >=9.0: **1,795**
- Maximum observed: **9.95**

The mean of ~6.5 is intentional and accepted. It must NOT be artificially pushed toward 7.0.

## Interpretation contract

The most important semantic boundary is `<5.0`: it means the copy is a candidate for replacement because its technical quality/efficiency is weak relative to its context. This meaning must remain comparable between Movie and Episode-TV despite their different technical expectations.

## Versioning / preservation

- C5 remains historical and must not be overwritten.
- This document is the authoritative C6 final baseline.
- Implementation code must carry an explicit formula version identifying C6.
- Any future proposal must be C7+ (or another explicit successor), documented separately and compared against this baseline before adoption.
