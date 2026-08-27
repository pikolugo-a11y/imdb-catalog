# Inventario de procesos — Identidad

Fuente de verdad operativa complementaria a las issues #273 y #274.

## Procesos identificados

| ID | Proceso | Tipo | Disparador conocido | Estado |
|---|---|---|---|---|
| PROC-ID-001 | Obtener identidad TMDb | Unitario + Batch paralelo | Botón `Obtener identidad` / Lifecycle Batch | VIGENTE PERO MEJORABLE / BATCH NO CANÓNICO |
| PROC-ID-002 | Corregir identidad manualmente | Unitario manual | Panel `Corregir` en Calidad → Identidad | VIGENTE, alto impacto |
| PROC-ID-003 | Refrescar datos de identidad conocida | Unitario de refresco | Componente UI huérfano | ELIMINAR · LEGACY · UI HUÉRFANA |
| PROC-ID-004 | Reanalizar todas las identidades pendientes | Global web | Sin consumidor activo confirmado | ELIMINAR · LEGACY · SIN CONSUMIDOR |
| PROC-ID-005 | Retry/reenriquecimiento antiguo de identidad | Unitario legacy | Sin consumidor activo confirmado | ELIMINAR · LEGACY · DUPLICADO |

## Observación transversal
`PROC-ID-003`, `PROC-ID-004` y `PROC-ID-005` usan `enrichTitle()`, que es un enriquecimiento amplio: TMDb, Wikidata, FilmAffinity, metadata, créditos, géneros, colecciones y PikoScore. Su eliminación futura no implica eliminar `enrichTitle()` mientras tenga consumidores vigentes en otros dominios.

## Comparativa de correcciones manuales: PROC-ID-002 vs PROC-IV-003
Ambas rutas comparten el mismo núcleo de persistencia: `lib/identity.js::saveIdentity()`. Por tanto, la migración real de IMDb y la actualización manual de TMDb usan la misma función base.

### Diferencias actuales
- PROC-ID-002 valida TMDb antes de guardar mediante `validateTmdbIdentity()`. Si detecta mismatch, bloquea el guardado. Si la validación falla técnicamente, guarda igualmente y devuelve warning.
- PROC-IV-003 sólo valida formato antes de guardar; no ejecuta `validateTmdbIdentity()` previa. Después invalida la evidencia anterior y lanza `refreshIdentityEvidence()` para comprobar de nuevo la identidad.
- PROC-ID-002 llama a `markIdentityRefreshPending()` y recalcula Lifecycle; no recrea evidencia de validación en ese momento.
- PROC-IV-003 resetea `identity_validation` a `pending_data`, limpia revisión manual Batch, recalcula Lifecycle, intenta inmediatamente obtener nueva evidencia y vuelve a recalcular Lifecycle.
- PROC-IV-003 mantiene los IDs guardados aunque el refresh de evidencia posterior falle.
- Ambas rutas heredan de `saveIdentity()` la migración de referencias cuando cambia IMDb, la marca de identidad manual y el evento `manual_edit`.

### Lectura arquitectónica provisional
No son dos mecanismos de guardado distintos: son dos orquestaciones distintas alrededor del mismo `saveIdentity()`. La futura arquitectura debería compartir una operación canónica segura de corrección de IDs y permitir que la pantalla de Validación añada como post-paso la invalidación/refresco de evidencia.

No modificar hasta decisión con Roberto.
