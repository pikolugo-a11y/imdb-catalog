# PikoFilm — PRE-V4 · Auditoría documental

Fecha: 2026-09-02  
Rama: `pre-v4-readiness`

## 1. `PROJECT_STATUS.md` está materialmente desactualizado

El documento se autodefine como bitácora viva, pero su estado registrado es 23/08/2026 y contiene afirmaciones incompatibles con el sistema actual.

Ejemplos claros:

- afirma que `worker/` queda reducido a `imdb-discovery.mjs` y `update-imdb-ratings.mjs`; hoy existen workers Batch FAST/API/Plex y Technical Snapshot;
- describe M46-A como cola sin worker consumidor; hoy Railway ejecuta workers productivos;
- dice que el execution plane dedicado está pendiente de seleccionar; hoy Railway es execution plane real;
- afirma que CI es el único workflow automático y que el resto es manual; hoy existe el workflow branch-first de migraciones con trigger por cambios SQL;
- presenta PikoScore 2.0 como implantado, mientras el sistema actual expone PikoScore V3 como implementación canónica y mantiene 2.0 sólo como deuda/compatibilidad en ciertas capas.

Clasificación: **STALE / HIGH RISK DOCUMENTATION**.

No conviene editarlo parcialmente: antes de V4 debe reconstruirse a partir del inventario PRE-V4 vivo y reducirse a hechos actuales verificables.

## 2. Regla documental propuesta para V4

Separar tres categorías:

1. **Estado vivo:** arquitectura y servicios actuales; debe ser corto y fecharse.
2. **Especificación canónica:** contratos y reglas funcionales/técnicas que deben seguir siendo verdad aunque cambie un deployment.
3. **Historia:** hitos Mxx, decisiones antiguas y migraciones; conservar como histórico, no como fuente de verdad operativa.

Esto evita que un único fichero mezcle decisiones históricas con una descripción supuestamente vigente.

## 3. Documentación PRE-V4 como fuente provisional

Mientras dure la auditoría, los documentos `PRE_V4_*` son la fuente provisional para discrepancias entre docs antiguas y sistema vivo. La verdad final se valida contra GitHub, Railway, Vercel y Neon (cuando P3 vuelva a ser accesible).

## 4. Acción antes del gate V4

- rehacer `PROJECT_STATUS.md` desde cero o convertirlo en un resumen actual con fecha;
- marcar explícitamente documentos históricos que no deben gobernar decisiones actuales;
- comprobar enlaces/índices para que el usuario no llegue primero a una descripción obsoleta;
- reconciliar `BATCH_AUTOPILOT_ARCHITECTURE.md`, especificaciones V2 y roadmaps con el execution plane Railway ya existente.

Estado: auditoría iniciada; actualización definitiva diferida hasta cerrar P4/P5 para no volver a generar documentación obsoleta durante la propia limpieza.
