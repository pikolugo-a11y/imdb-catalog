# PikoFilm — Roadmap de Migración / Limpieza de legado

**Fecha:** 23/08/2026  
**Objetivo:** inventariar piezas de versiones anteriores que deben eliminarse, adaptarse o confirmarse antes de considerarlas parte de la arquitectura Lifecycle. Cada eliminación debe verificar dependencias y pasar CI.

## P0 — contradicen el modelo unitario actual

### M01–M07 — COMPLETADO 23/08/2026

- **M01 — acciones masivas de `/calidad`:** retiradas. La portada es lectura/navegación de colas Lifecycle y no lanza trabajo pesado.
- **M02 — `QualityRunAutoRefresh`:** eliminado junto con el polling batch.
- **M03 — Series unitario:** `lib/series-unitary.js` + acciones por serie.
- **M04 — análisis masivo antiguo de películas:** retirado `lib/quality-v2.js`; la ruta vigente es `validateMovieFile(imdbId)` por título/fingerprint.
- **M05 — PikoQuality unitario:** operativo mediante `lib/pikoquality-unitary.js`; `lib/pikoquality.js` conserva scoring compartido vigente.
- **M06 — `/api/pikoquality/run`:** eliminado.
- **M07 — `PikoQualityRunner.js`:** eliminado.

La portada ya cuenta `PIKOSCORE_PENDING` dentro de Datos y muestra `MOVIE_FILE_PENDING/REVIEW` como fase propia. Esto adelanta parte de M29/M30.

## P1 — rutas y conceptos antiguos

### M08–M11 y M15 — COMPLETADO 23/08/2026

- **M08 — `/plex`:** sin consumidores internos; se mantiene solo como redirect temporal a `/novedades?source=plex`. CSS Plex huérfano eliminado.
- **M09 — “Mi Biblioteca”:** no queda como concepto funcional activo.
- **M10 — `PlexIntake.js` / `NovedadesPlexShell.js`:** ya no existen en el árbol activo.
- **M11 — Dashboard:** enlaces Plex legacy sustituidos por `/novedades?source=plex`.
- **M15 — pilotos PikoQuality:** eliminados `app/calidad/pikoquality-pilot` y `app/admin/pikoquality-probe`.

### M12–M14 — Documentación histórica — COMPLETADO 22/08/2026
Se retiraron documentos V1/V2/V3 y pilotos obsoletos. `V3_CANONICAL_DATA.md` se sustituyó por `CANONICAL_DATA.md`. El histórico permanece recuperable mediante Git.

## P1 — workflows, APIs y workers heredados

### M16–M27 — COMPLETADO 23/08/2026

Se auditó el árbol completo de GitHub Actions, `app/api` y `worker/` contra los consumidores reales del modelo Lifecycle.

**Retirado:**
- **M16** `identity-full-refresh.yml` y su dispatcher `lib/identity-run-control.js`.
- **M17** `identity-validation-refresh.yml`.
- **M18** `identity-validation-recalculate.yml`.
- **M19** `series-full-refresh.yml`.
- **M20** `catalog-enrichment-test.yml` experimental.
- **M21** `imdb-manual-candidate.yml`, duplicado por Novedades/Server Actions.
- **M24** `app/api/identity/batch`.
- **M25** `app/api/identity-validation/batch`.
- **M26** `app/api/identity/run/[id]`, `wiki-batch` y `brave-probe`.
- **M27** workers de identidad, validación, series y helpers FilmAffinity que solo servían a esos workflows.

Tras la limpieza, `worker/` contiene únicamente:
- `imdb-discovery.mjs` — fuente explícita de Discovery IMDb;
- `update-imdb-ratings.mjs` — mantenimiento offline del dataset IMDb.

**Conservado deliberadamente:**
- **M22** `imdb-ratings-refresh.yml`: mantenimiento offline manual del dataset IMDb; no es el flujo unitario de Datos.
- `imdb-discovery.yml`: Discovery manual con cooldown y límites.
- `manual-maintenance.yml`: comprobaciones acotadas y de solo lectura.
- `ci.yml`: único workflow automático asociado a cambios de código.

**M23:** verificado que los workflows operativos conservados son `workflow_dispatch`; no existe `schedule` ni ejecución masiva automática. CI sigue siendo el único workflow automático.

Las funciones Python productivas `api/fa-search.py` y `api/fa-evidence.py` **no son workers batch**: son endpoints unitarios usados por Identidad/Validación y se conservan.

## P1 — modelo de datos y lifecycle

### M28. Lifecycle 100% event-driven
**Situación:** `getLifecycleForIds()` todavía puede recalcular registros con más de 10 minutos.  
**Acción:** hacer que todas las mutaciones relevantes llamen a `recomputeLifecycleForIds`; las lecturas solo leen materializado. Dejar `reconcileLifecycleBatch` como mantenimiento manual.

### M29. PIKOSCORE_PENDING incluido en todos los contadores correctos
**Situación:** la portada de Calidad ya fue corregida en M01, pero falta auditar el resto de vistas.  
**Acción:** alinear todos los KPIs con la semántica Datos + PikoScore.

### M30. Añadir explícitamente MOVIE_FILE_* a la portada
**Situación:** ya aplicado en la portada durante M01.  
**Acción:** confirmar consistencia con el resto de enlaces/contadores antes de marcar globalmente completado.

### M31. Revisar `TECH_REVIEW`
**Situación:** existe estado para finding técnico heredado tipo `quality`, mientras PikoQuality unitario actualmente genera score y normalmente termina Complete.  
**Acción:** decidir si PikoQuality bajo umbral debe generar revisión funcional. Si no, retirar estado/findings antiguos; si sí, formalizarlo.

### M32. Limpiar valores PikoScore previos sin versión
Todo `final_rating` viejo debe considerarse inválido hasta tener `pikoscore_version=2.0.0` y `pikoscore_calculated_at`.

### M33. Invalidar PikoQuality viejo sin fingerprint/versión actual
No aceptar un score histórico como vigente solo por existir. Debe coincidir `formula_version` + `source_fingerprint`.

### M34. Consolidar `source_status` JSON legado
Migrar valores útiles a columnas escalares y borrar claves ya sustituidas para ahorrar espacio y evitar dos fuentes de verdad.

### M35. Revisar findings antiguos
Auditar/migrar definitivamente estados `waiting_sync`, `exception` o findings `quality` pre-Lifecycle.

## P2 — datos derivados y almacenamiento

### M36. Revisar `series_diagnostics`
Determinar si se necesita histórico completo o solo diagnóstico actual. Diseñar retención/replace en vez de acumulación.

### M37. Retención automática de `admin_events`
Conservar los últimos 1.000 salvo excepciones justificadas.

### M38. Retención automática de `pipeline_runs`
Misma política inicial: últimos 1.000; fallos importantes solo si aportan valor.

### M39. Compactación/espacio físico
Documentar cuándo usar `VACUUM`, `VACUUM FULL` o recreación de índices. No ejecutar compactación bloqueante automáticamente desde la web.

### M40. Auditoría de índices `movie_credits`
Revisar índices duplicados/no usados antes de borrar datos funcionales.

### M41. Limitar snapshots de candidatos
Convertir la limpieza de `source_snapshot` al cerrar candidatos en regla permanente.

### M42. Revisar payloads JSON grandes
Buscar `raw`, `payload`, `summary`, `source_snapshot` y blobs históricos. Guardar solo campos escalares o trazas mínimas salvo necesidad de auditoría.

## P2 — CSS y componentes

### M43. Inventario CSS V1/V2/V3
Determinar qué selectores están realmente usados y consolidar.

### M44. Eliminar layouts vacíos/transitorios
Revisar `layout.js` children-only tras la eliminación de pantallas duplicadas.

### M45. Unificar componentes ActionButton/status/badges
Eliminar variantes antiguas equivalentes.

## Criterios para ejecutar el roadmap

Antes de borrar cualquier elemento:
1. búsqueda de imports/referencias;
2. confirmar que no existe llamada desde Vercel/GitHub workflow;
3. comprobar tablas que escribe/lee;
4. borrar en rama;
5. `npm run build` en CI;
6. merge a `main`;
7. deployment manual cuando el usuario decida;
8. prueba de regresión del flujo completo.

## Orden recomendado

1. **M01–M07 — completado.**
2. **M08–M15 — completado.**
3. **M16–M27 — completado.**
4. **M28–M35 — siguiente bloque:** cerrar arquitectura Lifecycle.
5. M36–M45: optimizar Neon y deuda visual.

El objetivo final es que exista **un solo camino por etapa**, una sola fuente de estado y ninguna operación masiva accidental desde el frontal.
