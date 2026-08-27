# Inventario de procesos — Identidad

Fuente de verdad operativa complementaria a las issues #273 y #274.

## Procesos identificados

| ID | Proceso | Tipo | Disparador conocido | Estado provisional |
|---|---|---|---|---|
| PROC-ID-001 | Obtener identidad TMDb | Unitario + Batch paralelo | Botón `Obtener identidad` / Lifecycle Batch | VIGENTE PERO MEJORABLE / BATCH NO CANÓNICO |
| PROC-ID-002 | Corregir identidad manualmente | Unitario manual | Panel `Corregir` en Calidad → Identidad | VIGENTE, pendiente revisión profunda |
| PROC-ID-003 | Refrescar datos de identidad conocida | Unitario de refresco | Acción `refreshIdentityDataAction()`; consumidor UI pendiente de confirmar | DUDOSO hasta confirmar consumidor y alcance |
| PROC-ID-004 | Reanalizar todas las identidades pendientes | Global web | `reanalyzeIdentityAction()` → `reanalyzeIdentity()`; consumidor UI actual no confirmado | CANDIDATO LEGACY / NO CANÓNICO |
| PROC-ID-005 | Retry/reenriquecimiento antiguo de identidad | Unitario legacy | `retryIdentityAction()` → `retryIdentity()`; consumidor UI actual no confirmado | CANDIDATO LEGACY / DUPLICADO |

## Observación transversal
`PROC-ID-003`, `PROC-ID-004` y `PROC-ID-005` usan `enrichTitle()`, que es un enriquecimiento amplio: TMDb, Wikidata, FilmAffinity, metadata, créditos, géneros, colecciones y PikoScore. Por tanto, su nombre histórico de “Identidad” es engañoso: hacen mucho más que resolver identidad y pueden invadir responsabilidades de Datos/PikoScore.

No modificar hasta revisión con Roberto.
