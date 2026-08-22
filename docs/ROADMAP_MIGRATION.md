# PikoFilm — Roadmap de Migración / Limpieza de legado

**Fecha:** 22/08/2026  
**Objetivo:** inventariar piezas de versiones anteriores que deben eliminarse, adaptarse o confirmarse antes de considerarlas parte de la arquitectura Lifecycle. Cada eliminación debe verificar dependencias y pasar CI.

## P0 — contradicen el modelo unitario actual

### M01. Retirar acciones masivas de `/calidad`
**Situación:** la portada todavía ofrece “Actualizar todo” de Identidad, “Actualizar validación”, “Actualizar todas” de Series y “Analizar películas”.  
**Acción:** eliminar esos botones y los estados de progreso asociados. La portada debe limitarse a lectura/navegación de colas lifecycle.

### M02. Eliminar `QualityRunAutoRefresh`
**Situación:** componente creado para refrescar procesos masivos en curso.  
**Acción:** retirar cuando M01 esté cerrada. Los procesos unitarios actualizan la ruta tras cada acción.

### M03. Convertir Series a unitario
**Situación:** `/calidad/series` usa `refreshSeriesFromQuality` / “Actualizar todas las series”.  
**Acción:** crear acción por serie para construir/refrescar referencia oficial y diagnóstico; después eliminar el masivo del frontal.

### M04. Retirar análisis masivo antiguo de películas
**Situación:** existen `analyzeMovieQuality`, `refreshMoviesFromQuality` y motores anteriores además de `validateMovieFile(imdbId)`.  
**Acción:** confirmar qué piezas siguen alimentando findings vigentes y conservar solo el motor unitario por fingerprint.

### M05. Consolidar PikoQuality en el motor unitario
**Situación:** `lib/pikoquality.js` aún contiene procesamiento A/B, batches, retries y agregados históricos; películas usan `lib/pikoquality-unitary.js`.  
**Acción:** separar claramente funciones de scoring reutilizables de runners masivos. Eliminar runners de película que ya no se usan.

### M06. Retirar API `/api/pikoquality/run` si queda sin consumidores
**Situación:** pertenecía al `PikoQualityRunner` por lotes.  
**Acción:** buscar consumidores; borrar ruta al quedar huérfana.

### M07. Eliminar `PikoQualityRunner.js` si ya no se importa
**Situación:** el frontal nuevo usa `analyzeOnePikoQualityAction`.  
**Acción:** confirmar con búsqueda estática y borrar componente legado.

## P1 — rutas y conceptos antiguos

### M08. Retirar `/plex` como pantalla conceptual
**Situación:** ahora solo redirige a `/novedades?source=plex`.  
**Acción:** cambiar todos los enlaces internos al destino nuevo; mantener redirect temporal una versión y después valorar eliminarlo.

### M09. Eliminar terminología “Mi Biblioteca”
**Situación:** puede persistir en componentes o textos heredados. La entrada Plex ya vive en Novedades.  
**Acción:** sustituir por “Novedades · origen Plex” donde corresponda.

### M10. Revisar `PlexIntake.js` y `NovedadesPlexShell.js`
**Situación:** componentes nacidos durante la transición de Plex a Novedades.  
**Acción:** confirmar si `page.js` actual los importa. Si no, borrar junto a CSS específico huérfano.

### M11. Corregir enlaces antiguos del Dashboard
**Situación:** KPIs todavía enlazan a `/plex?mode=uncatalogued`.  
**Acción:** apuntar a `/novedades?source=plex` y eliminar parámetros legacy.

### M12–M14. Documentación histórica — COMPLETADO 22/08/2026
Se retiraron de la rama activa los documentos de versiones anteriores y pilotos obsoletos:
- `V1_SCOPE.md`;
- `NOVEDADES_V1_FUNCTIONAL.md`;
- `NOVEDADES_V1_TECHNICAL.md`;
- `V2_ACCEPTANCE_TESTS.md`;
- `V3_IMPLEMENTATION_PLAN.md`;
- `QUALITY_MOVIES_V3.md`;
- `PikoQuality_B_PILOT.md`.

`V3_CANONICAL_DATA.md` se sustituyó por `CANONICAL_DATA.md`, eliminando referencias de versión y conservando únicamente las reglas vigentes de países y géneros. El histórico completo permanece recuperable mediante Git.

### M15. Revisar `pikoquality-pilot` y `admin/pikoquality-probe`
**Situación:** rutas de pruebas conservadas.  
**Acción:** si no son necesarias para diagnóstico productivo, borrarlas y sus Server Actions.

## P1 — workflows GitHub heredados

### M16. Retirar `identity-full-refresh.yml`
El flujo objetivo de identidad es unitario. Mantener solo si existe un mantenimiento excepcional documentado; en caso contrario eliminar.

### M17. Retirar `identity-validation-refresh.yml`
Mismo criterio: validación operativa unitaria.

### M18. Retirar `identity-validation-recalculate.yml`
Era un recalculado masivo de cache. Sustituir por lifecycle/eventos y mantenimiento explícito si alguna vez se necesita.

### M19. Retirar `series-full-refresh.yml`
Después de M03, no debe quedar un proceso masivo normal de Series en GitHub.

### M20. Retirar `catalog-enrichment-test.yml`
Workflow experimental con referencias históricas. No debe formar parte del set productivo.

### M21. Revisar `imdb-manual-candidate.yml`
El alta manual ya se procesa desde Novedades/Server Actions. Confirmar si todavía se despacha; borrar si está duplicado.

### M22. Revisar `imdb-ratings-refresh.yml`
Ratings se actualizan unitariamente desde Calidad → Datos. Conservar únicamente si se decide que el dataset IMDb necesita mantenimiento offline explícito.

### M23. Mantener CI como único automático
Verificar periódicamente que ningún workflow operativo tenga `schedule`, `push` masivo, encadenamientos o reintentos infinitos.

## P1 — APIs y workers batch

### M24. Auditar `app/api/identity/batch`
Ruta heredada del análisis masivo. Borrar si ningún componente/worker la consume.

### M25. Auditar `app/api/identity-validation/batch`
Mismo objetivo para validación.

### M26. Auditar `app/api/identity/run/[id]`, `wiki-batch` y `brave-probe`
Separar herramientas de diagnóstico realmente útiles de infraestructura abandonada. Las probes no deberían permanecer expuestas sin necesidad.

### M27. Auditar workers antiguos
Revisar `worker/` para identificar enriquecimientos/series/identidad sustituidos por Server Actions unitarias. Mantener `imdb-discovery` y cualquier worker que siga siendo fuente explícita real.

## P1 — modelo de datos y lifecycle

### M28. Lifecycle 100% event-driven
**Situación:** `getLifecycleForIds()` todavía puede recalcular registros con más de 10 minutos.  
**Acción:** hacer que todas las mutaciones relevantes llamen a `recomputeLifecycleForIds`; las lecturas solo leen materializado. Dejar `reconcileLifecycleBatch` como mantenimiento manual.

### M29. PIKOSCORE_PENDING incluido en todos los contadores correctos
**Situación:** algunas vistas de Calidad calculan “Datos” solo con `DATA_INCOMPLETE`.  
**Acción:** alinear todos los KPIs con la nueva semántica Datos + PikoScore.

### M30. Añadir explícitamente MOVIE_FILE_* a la portada
Evitar que `MOVIE_FILE_PENDING/REVIEW` desaparezcan dentro de una categoría técnica antigua.

### M31. Revisar `TECH_REVIEW`
**Situación:** existe estado para finding técnico heredado tipo `quality`, mientras PikoQuality unitario actualmente genera score y normalmente termina Complete.  
**Acción:** decidir si PikoQuality bajo umbral debe generar revisión funcional. Si no, retirar estado/findings antiguos; si sí, formalizarlo.

### M32. Limpiar valores PikoScore previos sin versión
Todo `final_rating` viejo debe considerarse inválido hasta tener `pikoscore_version=2.0.0` y `pikoscore_calculated_at`.

### M33. Invalidar PikoQuality viejo sin fingerprint/versión actual
No aceptar un score histórico como vigente solo por existir. Debe coincidir `formula_version` + `source_fingerprint`.

### M34. Consolidar `source_status` JSON legado
**Situación:** hubo metadatos temporales en `source_status`, incluidos scores externos.  
**Acción:** migrar valores útiles a columnas escalares y borrar claves ya sustituidas para ahorrar espacio y evitar dos fuentes de verdad.

### M35. Revisar findings antiguos
Ya se limpiaron alertas de película no pertenecientes a la fase actual. Añadir auditoría/migración definitiva para estados `waiting_sync`, `exception` o findings `quality` pre-lifecycle.

## P2 — datos derivados y almacenamiento

### M36. Revisar `series_diagnostics`
Ocupa espacio significativo y parece derivable. Determinar si se necesita histórico completo o solo diagnóstico actual. Diseñar retención/replace en vez de acumulación.

### M37. Retención automática de `admin_events`
Actualmente se podó manualmente a 1.000. Implementar mantenimiento seguro que conserve los últimos 1.000 sin crecimiento ilimitado.

### M38. Retención automática de `pipeline_runs`
Misma política inicial: últimos 1.000. Mantener fallos importantes más tiempo solo si aporta valor.

### M39. Compactación/espacio físico
Documentar cuándo usar `VACUUM`, `VACUUM FULL` o recreación de índices. No ejecutar compactación bloqueante automáticamente desde la web.

### M40. Auditoría de índices `movie_credits`
La tabla e índices ocupan una parte grande de Neon. Revisar índices duplicados/no usados antes de borrar datos funcionales.

### M41. Limitar snapshots de candidatos
La limpieza de `source_snapshot` para candidatos `catalogued` ya se aplicó. Convertirlo en regla de cierre del candidato para impedir que vuelva a crecer.

### M42. Revisar payloads JSON grandes
Buscar `raw`, `payload`, `summary`, `source_snapshot` y blobs históricos. Guardar solo campos escalares o trazas mínimas salvo necesidad de auditoría.

## P2 — CSS y componentes

### M43. Inventario CSS V1/V2/V3
Hay estilos globales y específicos creados por sucesivas reconstrucciones. Determinar qué selectores están realmente usados y consolidar.

### M44. Eliminar layouts vacíos/transitorios
Después de eliminar las tablas duplicadas de Películas/PikoQuality, revisar si los `layout.js` children-only son necesarios o se pueden borrar.

### M45. Unificar componentes ActionButton/status/badges
Eliminar variantes antiguas que hagan lo mismo con estilos diferentes.

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

1. M01–M07: eliminar duplicidad operativa más peligrosa.
2. M08–M11 y M15: limpiar conceptos/rutas/pilotos restantes.
3. M16–M27: reducir GitHub Actions/APIs legacy y riesgo operativo.
4. M28–M35: cerrar arquitectura lifecycle.
5. M36–M45: optimizar Neon y deuda visual.

El objetivo final es que exista **un solo camino por etapa**, una sola fuente de estado y ninguna operación masiva accidental desde el frontal.