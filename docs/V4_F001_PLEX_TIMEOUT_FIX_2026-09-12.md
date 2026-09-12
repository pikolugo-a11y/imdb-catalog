# Cierre V4 — F-001 timeout Plex de solo lectura

**Fecha:** 2026-09-12  
**Origen:** `docs/V4_FINAL_PRE_V5_AUDIT_2026-09-12.md`  
**Estado:** CORREGIDO

## Problema

`PROC-NOV-009` podía sustituir el error real de timeout por `TypeError: Cannot set property message ... which has only a getter` porque `lib/plex-sync.js` mutaba directamente `error.message`, `error.source` y `error.retryable` sobre el error recibido de `fetch`/`AbortSignal.timeout()`.

## Corrección

- Se deja de mutar cualquier error externo recibido.
- Los timeouts reconocidos (`TimeoutError`, `AbortError` o `code === 23`) se envuelven en un `Error` propio `PlexTimeoutError`.
- El error normalizado conserva `cause`, `source='plex'`, `retryable=true`, ruta Plex, número de intentos y `code` cuando existe.
- La política de reintentos de `PROC-NOV-009` no cambia: siguen existiendo hasta dos reintentos antes del error final.

## Regresión protegida

`test/plex-timeout-error.test.mjs` reproduce explícitamente un objeto de timeout cuyo `message` sólo tiene getter y además está marcado como no extensible. El test verifica que la normalización no lo modifica y conserva el objeto original como `cause`.

El test forma parte de `npm run test:quality`.

## Alcance

Corrección dirigida únicamente al tratamiento de errores HTTP/timeout de la sincronización global Plex. No cambia reconciliación de Series, identidades, Lifecycle, planificación ni datos históricos.
