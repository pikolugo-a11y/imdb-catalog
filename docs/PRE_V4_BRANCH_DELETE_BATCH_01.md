# PikoFilm — PRE-V4 · GitHub Branch Cleanup · Lote 01

Fecha: 2026-09-02

## Regla

No borrar ramas por nombre, antigüedad o apariencia. Para este lote sólo se incluyen ramas cuya comparación GitHub contra `main` devuelve:

- `ahead_by = 0`;
- estado `behind`;
- `files = []` en la comparación;
- por tanto no contienen ningún commit exclusivo que no esté ya contenido en `main`.

Este lote no afecta al frontend, Railway, Vercel ni Neon; elimina únicamente referencias de rama Git ya absorbidas por la historia de `main`.

## Lote 01 — seguro para borrar

| Rama | Ahead de main | Behind de main | Clasificación |
|---|---:|---:|---|
| `pre-v4-audit-tmp` | 0 | 2 | TEMP / absorbida |
| `cleanup/drop-batch-job-steps-direct` | 0 | 324 | TEMP one-shot / absorbida |
| `cleanup/retire-legacy-batch-ui` | 0 | 327 | LEGACY cleanup / absorbida |
| `noop` | 0 | 237 | TEMP / absorbida |
| `noop-check` | 0 | 1247 | TEMP / absorbida |
| `tmp-ignore` | 0 | 8 | TEMP / absorbida |
| `tmp-ignore2` | 0 | 8 | TEMP / absorbida |
| `tmp-noop` | 0 | 1117 | TEMP / absorbida |
| `ops/cleanup-id001-readonly-check` | 0 | 144 | TEMP verification / absorbida |
| `ops/verify-id001-batch-readonly` | 0 | 147 | TEMP verification / absorbida |
| `ops/revalidate-tt8442644` | 0 | 201 | diagnóstico título concreto / absorbida |
| `ops/revalidate-tt8442644-rerun` | 0 | 198 | diagnóstico título concreto / absorbida |
| `ops/revalidate-tt8442644-rerun3` | 0 | 195 | diagnóstico título concreto / absorbida |
| `ops/revalidate-tt8442644-rerun4` | 0 | 192 | diagnóstico título concreto / absorbida |

## Frontend Safety Gate

**Frontend = NO.** Son refs Git históricas; el código contenido ya forma parte de `main` y borrar la referencia de rama no cambia el árbol de producción.

## Exclusiones deliberadas

NO incluir en este lote:

- `main` — producción;
- `pre-v4-readiness` — rama activa de auditoría;
- `archive/railway-pikoquality-technical-snapshot-20260901` — diverge de `main`, `ahead_by=20`, `behind_by=705`; conserva commits exclusivos y requiere decisión separada;
- cualquier otra rama con `ahead_by > 0`, estado `diverged` o comparación todavía no realizada.

## Ejecución

El conector GitHub disponible permite comparar/crear/mover refs, pero no expone una operación de borrado de ramas. Por eso la eliminación de este lote requiere intervención manual del usuario en GitHub.

Después del borrado se verificará con `search_branches` que las 14 refs ya no existen y se continuará con el siguiente lote.
