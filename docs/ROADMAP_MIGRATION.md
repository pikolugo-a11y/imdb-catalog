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

## P1 — rutas y conceptos antiguos

### M08–M11 y M15 — COMPLETADO 23/08/2026

- **M08 — `/plex`:** sin consumidores internos; se mantiene solo como redirect temporal a `/novedades?source=plex`. CSS Plex huérfano eliminado.
- **M09 — “Mi Biblioteca”:** no queda como concepto funcional activo.
- **M10 — `PlexIntake.js` / `NovedadesPlexShell.js`:** ya no existen en el árbol activo.
- **M11 — Dashboard:** enlaces Plex legacy sustituidos por `/novedades?source=plex`.
- **M15 — pilotos PikoQuality:** eliminados rutas y librerías de prueba/probe sin consumidores.

### M12–M14 — Documentación histórica — COMPLETADO 22/08/2026
Se retiraron documentos V1/V2/V3 y pilotos obsoletos. `V3_CANONICAL_DATA.md` se sustituyó por `CANONICAL_DATA.md`. El histórico permanece recuperable mediante Git.

## P1 — workflows, APIs y workers heredados

### M16–M27 — COMPLETADO 23/08/2026

Se retiraron workflows/APIs/workers batch de identidad, validación, Series, pruebas de enriquecimiento y candidato manual. También se retiraron los dispatchers internos que dependían de ellos.

Tras la limpieza, `worker/` contiene únicamente:
- `imdb-discovery.mjs` — fuente explícita de Discovery IMDb;
- `update-imdb-ratings.mjs` — mantenimiento offline del dataset IMDb.

Se conservan deliberadamente:
- `ci.yml` — único workflow automático;
- `imdb-discovery.yml`, `imdb-ratings-refresh.yml` y `manual-maintenance.yml` — exclusivamente `workflow_dispatch`;
- `api/fa-search.py` y `api/fa-evidence.py` — endpoints Python unitarios productivos.

## P1 — modelo de datos y Lifecycle

### M28–M35 — COMPLETADO 23/08/2026

- **M28 — Lifecycle 100% materializado/event-driven:** `getLifecycleForIds()` queda estrictamente de lectura y ya no recalcula por antigüedad. Las mutaciones unitarias relevantes recalculan el título en la misma operación. `Actualizar Plex`, como mutación global explícita, reconcilia únicamente los estados que pueden verse afectados por presencia/fingerprint Plex, en lotes pequeños. `reconcileLifecycleBatch()` queda reservado a mantenimiento/backfill explícito.
- **M29 — `PIKOSCORE_PENDING`:** auditado y alineado en la portada canónica de Calidad; forma parte de Datos y se contabiliza separadamente dentro de esa etapa.
- **M30 — `MOVIE_FILE_*`:** `MOVIE_FILE_PENDING` y `MOVIE_FILE_REVIEW` quedan explícitos como etapa de película y con navegación propia.
- **M31 — `TECH_REVIEW`:** retirado del Lifecycle. PikoQuality es una puntuación técnica informativa; una nota baja no genera por sí misma revisión funcional. Las incidencias accionables del archivo pertenecen a `MOVIE_FILE_REVIEW`.
- **M32 — PikoScore antiguo:** un `final_rating` no es vigente sin `pikoscore_version='2.0.0'` y `pikoscore_calculated_at`. Auditoría Neon: 20.444 de 20.446 valores existentes eran legado/no vigente. No se borran a ciegas: se consideran pendientes y las lecturas canónicas de Catálogo no los presentan/ordenan como PikoScore actual hasta su recálculo.
- **M33 — PikoQuality antiguo:** la vigencia exige `formula_version=QUALITY_VERSION` + `source_fingerprint` coincidente. Auditoría Neon: 63.834 registros evaluados y 0 evaluados sin fórmula/fingerprint.
- **M34 — `source_status`:** queda formalmente como metadato auxiliar/transitorio, nunca como segunda fuente de verdad de Lifecycle/PikoScore/IDs/campos escalares. No se hace borrado masivo sin auditar consumidores; la poda física de JSON histórico se integra en M42, donde corresponde por almacenamiento.
- **M35 — findings antiguos:** auditoría actual de `movie_quality_findings` = 0 filas. No existe migración de `waiting_sync`, `exception` o `quality` pendiente. El Lifecycle ya no depende de findings técnicos heredados.

Durante este bloque también se retiraron restos internos huérfanos detectados: `identity-validation-run-control.js`, `pikoquality-b-probe.js` y `pikoquality-pilot.js`.

## P0 estratégico — automatización masiva segura

### M46 — Batch Engine / Autopilot Lifecycle — DISEÑO APROBADO 23/08/2026

Lifecycle unitario se mantiene como unidad canónica de trabajo, pero deja de interpretarse como prohibición de automatización masiva. El objetivo es poder procesar grandes backlogs mediante muchas operaciones unitarias, idempotentes y reanudables, sin mantener requests largos de Vercel ni usar GitHub Actions como infraestructura batch continua.

Arquitectura completa: `docs/BATCH_AUTOPILOT_ARCHITECTURE.md`.

Subfases:
- **M46-A — Control y cola:** `batch_runs`, `batch_jobs`, leases, checkpoints, pausa/cancelación y Admin; sin tráfico externo todavía.
- **M46-B — FAST worker:** PikoScore, Lifecycle, diagnósticos y agregados locales seguros.
- **M46-C — API worker:** TMDb/Wikidata/OMDb/Plex con rate limits, presupuestos y circuit breaker.
- **M46-D — CAUTIOUS worker:** FilmAffinity/fallback web con concurrencia 1, jitter, backoff fuerte y presupuesto diario.
- **M46-E — Autopilot:** encadenar fases según Lifecycle y detenerse automáticamente ante Review/Excluded/error persistente.
- **M46-F — tareas offline:** evaluar migrar Discovery IMDb y ratings dataset fuera de GitHub Actions al worker común.

Decisión pendiente antes de M46-B: seleccionar host del worker dedicado. Vercel queda como control plane y GitHub como CI/tareas manuales acotadas; ninguno será el motor batch continuo.

Protecciones obligatorias: idempotencia, concurrencia limitada, rate limit por fuente, backoff, circuit breaker, presupuestos, kill switch, checkpoints, leases y métricas. Un estado `*_REVIEW*` nunca se autoacepta.

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
Buscar `raw`, `payload`, `summary`, `source_snapshot`, `source_status` y blobs históricos. Guardar solo campos escalares o trazas mínimas salvo necesidad de auditoría.

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

Para cualquier automatización M46 además:
1. probar primero con lote pequeño;
2. demostrar idempotencia/reanudación;
3. demostrar pausa y circuit breaker;
4. medir tráfico por fuente;
5. ampliar límites solo con métricas estables.

## Orden recomendado

1. **M01–M07 — completado.**
2. **M08–M15 — completado.**
3. **M16–M27 — completado.**
4. **M28–M35 — completado.**
5. **M46-A — siguiente bloque:** construir control/cola y panel sin ejecutar todavía scraping o APIs masivas.
6. seleccionar runtime del worker antes de M46-B.
7. M46-B/C/D/E de forma incremental y con pilotos.
8. M36–M45: optimizar Neon y deuda visual/técnica, pudiendo intercalarse con M46 cuando no interfiera.

El objetivo final es que exista **un solo camino por etapa**, una sola fuente de estado y automatización masiva segura construida sobre operaciones unitarias, nunca procesos masivos accidentales desde el frontal.
