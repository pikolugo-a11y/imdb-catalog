# PikoFilm — PRE-V4 · Registro acumulativo de ramas GitHub

Fecha de inicio: 2026-09-02
Rama: `pre-v4-readiness`

## Regla

Este documento acumula la clasificación de ramas mientras se auditan. No se elimina ninguna rama desde este registro; la eliminación manual se hará más adelante, agrupada, cuando Roberto pueda hacerlo cómodamente.

Criterios:

- **BORRAR**: comparación contra `main` con `ahead_by = 0`; la ref no conserva commits exclusivos.
- **CONSERVAR**: rama activa/protegida o con valor operativo explícito.
- **INVESTIGAR**: `ahead_by > 0`, divergencia o contenido exclusivo que requiere revisar antes de decidir.
- **PROTEGIDA**: `main` y ramas activas de trabajo PRE-V4.

## PROTEGIDAS / CONSERVAR

| Rama | Estado | Motivo |
|---|---|---|
| `main` | PROTEGIDA | Producción |
| `pre-v4-readiness` | PROTEGIDA | Rama activa PRE-V4 |
| `archive/railway-pikoquality-technical-snapshot-20260901` | INVESTIGAR | 20 commits ahead / 705 behind; conserva trabajo exclusivo PikoQuality/Technical |

## BORRAR — confirmado por comparación con main

| Rama | Ahead | Behind | Motivo |
|---|---:|---:|---|
| `pre-v4-audit-tmp` | 0 | 2 | temporal absorbida |
| `cleanup/drop-batch-job-steps-direct` | 0 | 324 | one-shot absorbida |
| `cleanup/retire-legacy-batch-ui` | 0 | 327 | cleanup absorbida |
| `noop` | 0 | 237 | temporal absorbida |
| `noop-check` | 0 | 1247 | temporal absorbida |
| `tmp-ignore` | 0 | 8 | temporal absorbida |
| `tmp-ignore2` | 0 | 8 | temporal absorbida |
| `tmp-noop` | 0 | 1117 | temporal absorbida |
| `ops/cleanup-id001-readonly-check` | 0 | 144 | verificación absorbida |
| `ops/verify-id001-batch-readonly` | 0 | 147 | verificación absorbida |
| `ops/revalidate-tt8442644` | 0 | 201 | diagnóstico absorbido |
| `ops/revalidate-tt8442644-rerun` | 0 | 198 | diagnóstico absorbido |
| `ops/revalidate-tt8442644-rerun3` | 0 | 195 | diagnóstico absorbido |
| `ops/revalidate-tt8442644-rerun4` | 0 | 192 | diagnóstico absorbido |
| `ops/vercel-deploy-iv-batch` | 0 | 120 | despliegue/verificación absorbida |
| `validate-people-v2` | 0 | 954 | validación absorbida |
| `validation-lifecycle-only` | 0 | 1420 | validación absorbida |
| `test/brave-throttle-30` | 0 | 1473 | test histórico absorbido |
| `perf/identity-minimal-resolution` | 0 | 1291 | optimización absorbida |
| `perf/identity-minimal-resolution-v2` | 0 | 1288 | optimización absorbida |
| `perf/vercel-frankfurt` | 0 | 320 | configuración/perf absorbida |
| `fix/api-worker-dockerfile` | 0 | 1217 | fix absorbido |
| `fix/api-worker-entrypoint` | 0 | 1207 | fix absorbido |
| `fix/batch-error-observability-ser003` | 0 | 57 | fix absorbido |
| `fix/batch-error-visibility` | 0 | 1096 | fix absorbido |
| `fix/batch-external-calls-counter` | 0 | 150 | fix absorbido |
| `fix/batch-partial-status` | 0 | 33 | fix absorbido |
| `fix/batch-preview-context-signature` | 0 | 1103 | fix absorbido |

## INVESTIGAR — contiene commits exclusivos

| Rama | Ahead | Behind | Contenido exclusivo observado |
|---|---:|---:|---|
| `validate-identity-throughput` | 3 | 1028 | cambios CI + triggers temporales |
| `validate-mdblist-only-pikoscore` | 2 | 1025 | cambio CI + trigger temporal |
| `validate-movie-detail-v3` | 1 | 1002 | fichero `.ci/validate-movie-detail-v3.txt` |
| `validate-movie-quality-saga` | 1 | 999 | trigger CI temporal |
| `validate-people-v2-final` | 1 | 949 | fichero de validación |
| `validate-people-v2-final2` | 1 | 948 | fichero de validación |
| `validate-pikoscore3-rollout` | 1 | 1034 | cambio CI histórico |
| `validate-runtime-perf` | 2 | 1018 | triggers temporales de CI/perf |
| `validate-sagas-redesign` | 1 | 991 | trigger CI temporal |
| `validate-sagas-v2` | 3 | 985 | sólo artefactos de validación/CI observados |
| `validate-series-detail-v3-fa-clean` | 1 | 1004 | fichero de validación CI |
| `validate-series-detail-v3` | 1 | 1007 | fichero de validación CI |
| `verify-identity-runtime-fix-2` | 1 | 838 | fichero de verificación CI |
| `verify-identity-ui` | 5 | 841 | ficheros de verificación/notas históricas |
| `diag/brave-single` | 1 | 1471 | endpoint de diagnóstico Brave exclusivo; revisar antes de descartar |
| `experiment/identity-unit-fa-search-lab` | 1 | 1482 | cambia acción de Identidad; requiere revisión funcional |
| `test/fa-python-5` | 7 | 1503 | workflow/probes Python/Vercel exclusivos; posible laboratorio histórico |
| `test/fa-resolver-benchmark` | 3 | 1544 | workflow benchmark FA exclusivo |
| `fix/batch-outcomes-compact-ui` | 5 | 1103 | cambios exclusivos de la antigua `/admin/batch`; probable legacy, pero revisar antes de clasificar para borrado |

## Nota

Una rama en INVESTIGAR puede terminar siendo BORRAR aunque tenga commits exclusivos si esos commits sólo son artefactos temporales/CI sin valor funcional; pero no se promueve a BORRAR hasta revisar su contenido y confirmar que no conserva implementación útil.
