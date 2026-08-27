# PikoQuality 2.0 — C6 FINAL (FROZEN)

Status: **DEFINITIVE / APPROVED / FROZEN**
Date: 2026-08-27
Formula version: **2.0.0-c6**

> GOLDEN RULE: Do not recalibrate, normalize, tune, or change these formulas merely to obtain a desired mean or distribution. Any future change requires an explicit new formula version and validation against this C6 baseline.

## Decision
PikoQuality 2.0 uses one common technical core with two context-specific models: **PQ2-Movie** and **PQ2-Episode-TV**. Both expose the same 0–10 scale and category semantics.

## Final category scale
- `< 5.0` — Suspenso / candidate to seek a better copy
- `5.0–5.9` — Suficiente
- `6.0–6.9` — Bien
- `7.0–8.4` — Notable
- `8.5–9.4` — Sobresaliente
- `>= 9.5` — Matrícula de honor

## Common technical core
The model combines contextual resolution, video codec efficiency, bit depth, bitrate density per pixel, video profile, audio codec/channels/bitrate, storage efficiency (GB/hour), and historical/year context.

### Critical density correction
Plex bitrate values are kbps:
`density = video_bitrate_kbps / (width * height) * 1000 * codec_efficiency_factor`

Codec efficiency: HEVC/H265/AV1 `1.45`; H264/AVC `1.00`; other `0.75`.

Density score: >=8 100; >=5 90; >=3.2 78; >=2 65; >=1.3 52; otherwise 36.
Video codec: HEVC/H265/AV1 92; H264/AVC 80; MPEG4/MSMPEG4V3 42; other 58.
Bit depth: >=10 92; otherwise 72.
Video profile: High/Main10/Main 10 90; known other 72; missing 65.

Audio = codec*0.45 + channels*0.35 + bitrate*0.20.
Audio codec: TrueHD/DTS-HD MA/FLAC 95; EAC3/DTS 82; AC3 72; AAC/MP3 58; other 62.
Channels: >=8 100; >=6 88; >=2 65; otherwise 50.
Audio bitrate: >=1000 100; >=640 88; >=384 75; >=192 60; otherwise 45.

Storage efficiency GB/hour: unknown 60; <0.18 35; <0.30 48; <0.45 65; <=2.20 92; <=3.50 80; <=5 66; >5 50.
Historical context: unknown 75; <=1959 95; <=1979 90; <=1999 85; <=2009 68; 2010+ 55.

`video = resolution*0.45 + codec*0.15 + bit_depth*0.10 + density*0.25 + profile*0.05`
`raw = video*0.62 + audio*0.18 + storage_efficiency*0.15 + historical_context*0.05`

## PQ2-Movie FINAL
Resolution: >=2160 100; >=1080 88; >=720 72; >=576 55; >=400 42; lower 28.

### Exact executable calibration
Anchors raw→internal score:
- 59.3226 → 50
- 62.84255 → 60
- 68.27802 → 70
- 76.98375 → 85
- 81.05735 → 95
- 85.331 → 99.5

```text
if raw <= 59.3226: final = 50 + (raw-59.3226)*1.8
elif raw <= 62.84255: final = 50 + (raw-59.3226)*(10/(62.84255-59.3226))
elif raw <= 68.27802: final = 60 + (raw-62.84255)*(10/(68.27802-62.84255))
elif raw <= 76.98375: final = 70 + (raw-68.27802)*(15/(76.98375-68.27802))
elif raw <= 81.05735: final = 85 + (raw-76.98375)*(10/(81.05735-76.98375))
else: final = 95 + (raw-81.05735)*(4.5/(85.331-81.05735))
final = clamp(final,0,99.5)
```

Frozen validation, 10,870 movies: mean ~6.54; Suspenso 622; Suficiente 1,983; Bien 5,535; Notable 2,186; Sobresaliente 513; Matrícula 31; >=9 343; max 9.95.

## PQ2-Episode-TV FINAL
Resolution: >=2160 100; >=1080 100; >=720 86; >=576 66; >=400 50; lower 32.
1080p is a fully valid premium TV/platform target; 4K is not an implicit requirement for an exceptional score.

### Exact executable calibration
Anchors raw→internal score:
- 56.61 → 50
- 59.435 → 60
- 66.02 → 70
- 77.684 → 85
- 83.565 → 95
- 86.929 → 99.5

```text
if raw <= 56.61: final = 50 + (raw-56.61)*1.8
elif raw <= 59.435: final = 50 + (raw-56.61)*(10/(59.435-56.61))
elif raw <= 66.02: final = 60 + (raw-59.435)*(10/(66.02-59.435))
elif raw <= 77.684: final = 70 + (raw-66.02)*(15/(77.684-66.02))
elif raw <= 83.565: final = 85 + (raw-77.684)*(10/(83.565-77.684))
else: final = 95 + (raw-83.565)*(4.5/(86.929-83.565))
final = clamp(final,0,99.5)
```

Frozen validation, 52,758 episodes: mean ~6.50; Suspenso 2,414; Suficiente 10,756; Bien 26,151; Notable 10,799; Sobresaliente 2,521; Matrícula 117; >=9 1,452; max 9.95.

## Full-library validation baseline
63,628 snapshots: mean 6.51; Suspenso 3,036 (4.77%); Suficiente 12,739; Bien 31,686; Notable 12,985; Sobresaliente 3,034; Matrícula 148; >=9 1,795; max 9.95.
The mean ~6.5 is intentional and accepted. It must NOT be artificially pushed toward 7.0.

## Interpretation contract
`<5.0` means the copy is a candidate for replacement because its technical quality/efficiency is weak relative to its context. This meaning remains comparable between Movie and Episode-TV despite their different technical expectations.

## Persistence / validity
- Canonical formula version: `2.0.0-c6`.
- A result is current only when `status=evaluated`, `formula_version=2.0.0-c6`, and `source_fingerprint` equals the current `plex_technical_state.technical_fingerprint`.
- A physical-file change automatically invalidates the old result.
- Precise score is retained in `components.score100/score10`; the legacy integer `score` field remains compatibility-only.
- C5 remains historical and must not be overwritten.
- Any future formula change must be C7+ and explicitly approved.

## Executable source of truth
`lib/pikoquality-c6-core.mjs` must match this document exactly. Individual and Batch must use the same shared scoring core; independent formula copies are prohibited.
