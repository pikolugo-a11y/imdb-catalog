# PikoFilm — Auditoría PRE-V4 de capas de compatibilidad y legacy

Fecha: 2026-09-02  
Rama: `pre-v4-readiness`

## Regla

Toda clasificación destructiva queda subordinada a `PRE_V4_FRONTEND_SAFETY_GATE.md`. Ante duda: CONSERVAR / INVESTIGAR.

## 1. Sagas: lectura V3, escritura todavía V2

Hallazgo importante: `lib/sagas-v2.js` NO es eliminable.

Cadena frontend confirmada:

`/sagas` → botón visible `Actualizar sagas` → `refreshSagasAction` en `app/actions.js` → import `refreshSagas` desde `@/lib/sagas-v2` → `refreshSagas()` → PROC-SAGA-001 → writes sobre `saga_collections` y `saga_collection_members`.

Mientras tanto, las páginas `/sagas` y `/sagas/[name]` usan `lib/sagas-v3` para lectura/dashboard.

Clasificación:

- `lib/sagas-v3.js`: CANONICAL READ MODEL.
- `lib/sagas-v2.js`: CANONICAL/COMPATIBILITY WRITE PATH, FRONTEND=SÍ.
- No borrar ni renombrar `sagas-v2.js` sin migrar primero `refreshSagasAction` a una implementación equivalente y validar el botón del frontal.

Deuda V4: eliminar la mezcla generacional haciendo que lectura y escritura vivan bajo una capa canónica de Sagas, sin cambiar comportamiento visible.

## 2. Series V2: fichero mixto; parte todavía frontend-consumed

`app/actions.js` importa `setSeasonAvailability` desde `lib/series-v2.js`.

Cadena frontend:

pantallas de Series → acción manual de disponibilidad de temporada → `seasonAvailabilityAction` → `setSeasonAvailability()` → `series_season_availability`.

Por tanto `lib/series-v2.js` NO puede borrarse como unidad aunque su nombre parezca antiguo.

Dentro del mismo fichero existe `refreshSeriesV2()`, una implementación antigua de refresco global. Su consumidor actual no está confirmado; debe auditarse a nivel de función, no asumir que todo el fichero está vivo o muerto.

Clasificación:

- fichero `lib/series-v2.js`: COMPATIBILITY/MIXED, FRONTEND=INDIRECTO.
- `setSeasonAvailability`: VIVA / protegida.
- `refreshSeriesV2`: LEGACY probable / UNKNOWN hasta cerrar consumidores.

## 3. Wrappers extensionless `lib/db` y `lib/process-runtime`

Existen dos ficheros sin extensión:

- `lib/db` → `export * from './db.js'`
- `lib/process-runtime` → `export * from './process-runtime.js'`

No deben borrarse por parecer aliases redundantes.

`lib/series-plex-sync.js`, parte de la cadena SER-002 consumida por el frontend y ejecutada por Batch Plex, usa imports extensionless (`./db`, `./process-runtime`, además de `./runlog` y `./lifecycle`). La incidencia real de Railway demostró que Node ESM no resuelve de forma segura esta cadena igual que Next/Vercel. El Dockerfile productivo normaliza esos imports a `.js` durante la construcción.

Clasificación de los wrappers: COMPATIBILITY, conservar hasta que todos los consumidores Node/Next estén normalizados y probados.

## 4. Batch Plex: sincronización de hotfix productivo en PRE-V4

`pre-v4-readiness` estaba divergiendo de `main` y no contenía los dos ajustes que hicieron arrancar Batch Plex en Railway. Para evitar que una futura integración PRE-V4 reintroduzca el fallo, `Dockerfile.batch-plex` se sincronizó con la versión productiva de `main`:

- `npm install --omit=dev` en lugar de `npm ci --omit=dev` porque el repositorio no tiene lockfile utilizable por `npm ci`;
- normalización de imports extensionless del chain de `series-plex-sync` dentro de la imagen Railway.

Esto es una preservación de un hotfix ya validado en producción; no cambia producción desde la rama PRE-V4.

## 5. Novedades: dos componentes sin montaje actual

`app/novedades/layout.js` devuelve sólo `children`.

No monta:

- `NovedadesPlexShell.js`
- `PlexIntake.js`

La página `/novedades` actual implementa directamente el flujo operativo Plex/Novedades y usa `PlexSyncButton`.

Las búsquedas por nombre de ambos componentes no devolvieron consumidores. Clasificación provisional:

- `NovedadesPlexShell.js`: DEAD probable, FRONTEND=NO probable.
- `PlexIntake.js`: LEGACY probable, FRONTEND=NO probable.

No aprobados para borrar todavía: falta cerrar tests/import dinámico y contraste final del árbol antes del lote destructivo.

## 6. Regla derivada

Los sufijos `v1`, `v2`, `v3` y nombres sin extensión NO son criterio suficiente para borrar. PRE-V4 debe clasificar por función y cadena de consumo real.

Especialmente:

- una página puede ser V3 y seguir llamando una escritura V2;
- un fichero puede contener funciones vivas y funciones legacy simultáneamente;
- aliases aparentemente redundantes pueden existir por compatibilidad de runtime Node/ESM.

## Estado

- SAGAS-V2: protegido, no borrar.
- SERIES-V2: fichero protegido; auditar funciones individualmente.
- `lib/db` y `lib/process-runtime`: conservar por compatibilidad hasta normalización completa.
- Batch Plex hotfix preservado en `pre-v4-readiness`.
- componentes Plex antiguos de Novedades: candidatos, todavía no autorizados para borrar.
