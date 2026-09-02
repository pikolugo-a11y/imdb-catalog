# PikoFilm — PRE-V4 P7 · limpieza de Issues

Estado: **P7 cerrado funcionalmente, pendiente únicamente de integrar esta evidencia en `main` mediante PR/CI**.

Fecha: 2026-09-02.

## Objetivo

Que las issues abiertas de GitHub representen exclusivamente **trabajo futuro real**. Las issues usadas para descubrir, definir o auditar procesos ya no son fuente de verdad: esa responsabilidad pertenece a la documentación versionada, especialmente `docs/processes/PROCESS_CATALOG.md` y `docs/processes/BATCH_ARCHITECTURE.md`.

## Regla aplicada

Cada issue se clasificó como:
- **completed**: proceso/decisión ya implantado o absorbido por documentación canónica;
- **superseded / not planned**: arquitectura o plan antiguo sustituido;
- **future backlog**: mejora funcional, UX, rendimiento o deuda técnica todavía real;
- **rewrite**: idea futura válida cuyo texto mezclaba estado histórico con trabajo pendiente.

Cerrar una issue de inventario no elimina su historia. GitHub conserva comentarios y trazabilidad; lo que se elimina es su condición de backlog abierto.

## Issues históricas cerradas en P7

Se cerró el índice maestro #273 y las issues PROC cuya función ya está definida en el catálogo canónico, incluyendo Identidad, Validación, Datos, Películas, Series, Novedades/Plex, Sagas, Personas, PikoQuality, Lifecycle excepcional y Operaciones.

Entre las cierres por **completed** quedan: #198, #273, #274, #275, #279, #280, #281, #282, #283, #284, #285, #287, #291, #295, #296, #297, #303, #310, #311, #312, #313, #329, #330, #332, #333, #334, #342 y #349.

Como **superseded/not planned** se cerraron planes o PROC de arquitecturas anteriores: #142 (Batch M46/V1), #197 (plan amplio de migración FA ya superado), #301 (`refreshSeriesV2` legacy), #307 (modelo de exclusión antiguo/aplazado) y #331 (PER-002 como PROC separado; el Batch actual reutiliza PER-001).

## Issues reescritas como backlog real

- #204 queda reducida a retirar de forma segura el legacy residual FilmAffinity/PikoScore 2. PikoScore 3 y `title_ratings` ya existen y no deben reconstruirse.
- #335 deja de definir el proceso HOME-001 y conserva únicamente la optimización de coste/latencia del snapshot diario.
- #52 y #93 se alinearon con ratings normalizados/PikoScore 3 y dejan de presentar FilmAffinity como dependencia funcional.
- #45 y #48 se reformularon como V4 backlog.
- #246 y #272 se identifican explícitamente como trabajo UX V4 pendiente de implementación/decisión.

## Corrección encontrada durante P7

El barrido de issues obligó a contrastar el inventario con el sistema vivo y detectó una omisión real en P5: `vercel.json` mantiene el cron diario `/api/cron/dashboard-snapshot` (`15 2 * * *`).

Se incorpora por tanto `PROC-HOME-001` al `PROCESS_CATALOG.md` como **proceso automático pasivo**:
- executor: Vercel Cron;
- unidad: snapshot global del Dashboard;
- no ejecuta Lifecycle;
- no procesa títulos;
- no pertenece al Batch Engine;
- no contradice que el Batch Engine se inicie sólo de forma explícita.

La issue #335 permanece abierta únicamente para optimizar su coste; la definición del proceso queda versionada en el catálogo.

## Backlog abierto al cerrar P7

Las issues abiertas verificadas tras la limpieza son trabajo futuro real:

| Issue | Tipo | Trabajo pendiente |
|---|---|---|
| #45 | V4 producto | Personas: búsqueda global, biografía/cobertura |
| #46 | V4 producto | Overrides manuales protegidos por campo |
| #47 | V4 producto/UX | ampliar Dashboard y navegación |
| #48 | V4 producto | búsqueda global unificada |
| #51 | V4 producto | filtros/vistas guardadas de Catálogo |
| #52 | V4 UX | completar ficha editorial de película |
| #53 | V4 operación | backup lógico portable/restauración segura |
| #54 | V4 UX | mejorar índice/ficha de Sagas |
| #93 | V4 calidad | procedencia y recuperación granular por campo |
| #204 | deuda técnica | retirar legacy FA/PikoScore 2 tras consumer sweep |
| #246 | V4 UX | Calidad Series detalle operacional |
| #272 | V4 UX/arquitectura | Centro de Operaciones y redistribución de Batch |
| #335 | rendimiento/coste | optimizar PROC-HOME-001 |
| #449 | rendimiento | mover clasificación/paginación de Calidad Datos a PostgreSQL |

No se mantiene abierta ninguna issue únicamente para servir de documentación de un PROC ya conocido.

## Gate P7

P7 puede darse por cerrado cuando:
1. esta evidencia y la corrección de `PROCESS_CATALOG.md` pasan CI;
2. la rama se integra en `main`;
3. una búsqueda final de issues abiertas confirma que sólo permanece el backlog listado arriba o cualquier issue nueva creada después de esta fotografía con trabajo real verificable.

No hay cambio funcional, DDL ni configuración de infraestructura en P7. No requiere deployment de Vercel.