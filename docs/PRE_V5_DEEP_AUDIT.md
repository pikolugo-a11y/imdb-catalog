# PikoFilm — Auditoría profunda PRE‑V5

Estado: **AUDITORÍA / CANDIDATOS PENDIENTES — NO ES ROADMAP V5**.

Baseline auditado: `main` posterior al cierre documental V4 (`a99378efd999283f0f5e5636a9da371435bacec2`).

Este documento inventaría hallazgos y oportunidades detectados al cruzar código vivo, documentación canónica V4, tests/CI, configuración Vercel, ejecución y estadísticas de Neon. Ningún punto se considera aprobado por aparecer aquí. Sólo pasará a `V5_ROADMAP.md` después de decisión explícita del usuario, una por una.

## Método

Se ha revisado la arquitectura canónica (Vercel/Next.js, Neon, Railway, GitHub Actions), las superficies funcionales, navegación, CSS, búsqueda, catálogo, home, Actividad, Operaciones, Batch, gobierno API, observabilidad, crons, middleware, CI y datos reales de producción disponibles. Para rendimiento se han usado además señales de Vercel Runtime Logs y estadísticas de Neon (`table-sizes`, `seq-scans`, `index-sizes`, `unused-indexes`, `vacuum-stats`).

La auditoría diferencia:
- **DEFECTO**: comportamiento que contradice el contrato o tiene evidencia de fallo/coste inútil.
- **HARDENING**: hoy puede funcionar, pero existe una fragilidad demostrable.
- **EFICIENCIA**: reduce latencia, tráfico, CPU, DB o complejidad.
- **UX**: mejora comprensión, navegación, accesibilidad o consistencia.
- **FUNCIÓN**: nueva capacidad de producto potencial.
- **CALIDAD**: pruebas, observabilidad o disciplina de entrega.

Prioridad preliminar: P0 crítica, P1 alta, P2 media, P3 oportunidad. La prioridad definitiva sólo se fijará al aprobar el candidato.

---

# Inventario de candidatos

## A. Defectos, seguridad y fiabilidad

### V5-C001 — Retirar por completo el polling legado de Lifecycle — P1 · DEFECTO/EFICIENCIA
**Evidencia:** producción registró aproximadamente 3.670 solicitudes en 24 h a `/api/lifecycle-activity`; el componente legado contiene polling cada 4 s, aunque V4 sustituyó ese popover por Actividad. El endpoint y `LifecycleActivity.js` siguen en el árbol.
**Mejora:** localizar cualquier consumidor real/stale, retirar componente y ruta legacy, y añadir contrato que impida su reaparición.
**Impacto usuario:** menos trabajo inútil, menos consumo Vercel/Neon y menos ruido técnico sin perder ninguna función V4.

### V5-C002 — Verificar y corregir el paso del cron de Activity Planner por el middleware privado — P0 potencial · DEFECTO
**Evidencia:** `vercel.json` programa `/api/cron/activity-planner` cada hora; la ruta exige `CRON_SECRET`, pero `middleware.js` sólo exceptúa explícitamente `/api/cron/dashboard-snapshot`. El planner puede ser interceptado con 404 antes de llegar a su auth; falta confirmación concluyente de logs.
**Mejora:** prueba de producción + contrato de middleware; si está bloqueado, permitir exclusivamente cron autenticado sin abrir la app.
**Impacto usuario:** garantiza que la planificación automática realmente se ejecuta.

### V5-C003 — Sustituir el acceso privado por token en query/cookie de un año por un mecanismo más robusto — P1 · SEGURIDAD
**Evidencia:** `middleware.js` acepta `?access=...`, compara SHA-256 contra hash hardcodeado y guarda el valor suministrado en cookie HTTP-only durante 365 días.
**Mejora:** sesión firmada/rotatoria o secret server-side, caducidad razonable, revocación y sin secreto reutilizable en URL.
**Impacto usuario:** misma entrada privada, con menos riesgo si se filtra historial, log, captura o enlace.

### V5-C004 — Añadir revocación/rotación del acceso privado sin redeploy de código — P2 · SEGURIDAD
**Evidencia:** el hash autorizado está embebido en `middleware.js`.
**Mejora:** mover credencial/versión a configuración segura; permitir invalidar sesiones anteriores.
**Impacto usuario:** recuperar control de acceso inmediatamente si alguna vez hay duda sobre el enlace/clave.

### V5-C005 — Endurecer el orden migración→deploy para evitar incompatibilidad de esquema — P1 · HARDENING
**Evidencia:** historial de Runtime Errors de Vercel mostró despliegues con relaciones/columnas aún inexistentes (`process_plans`, `dashboard_snapshots`, `batch_api_source_limits`, columnas PikoQuality, etc.).
**Mejora:** patrón expand/contract, chequeo de schema readiness y gate CI/deploy antes de exponer código que depende de una migración.
**Impacto usuario:** elimina ventanas donde una versión nueva da errores aunque el código sea correcto.

### V5-C006 — Hacer idempotente ante carrera la creación de un Batch — P1 · HARDENING
**Evidencia:** historial Vercel contiene una violación de `batch_run_control_process_code_one_active_uidx` al iniciar Batch.
**Mejora:** tratar el conflicto de unicidad como “ya existe Batch activo” y devolver/reusar su estado, nunca 500.
**Impacto usuario:** doble clic o dos lanzamientos cercanos no producen error.

### V5-C007 — Introducir un chequeo de salud de esquema/aplicación visible en Operaciones — P2 · FUNCIÓN/HARDENING
**Mejora:** una comprobación de sólo lectura que confirme tablas, columnas, funciones críticas, versión de migración, workers y crons esperados.
**Impacto usuario:** saber en segundos si “la aplicación está correctamente montada” tras un deploy.

### V5-C008 — Validar automáticamente que todos los crons declarados son alcanzables y autenticables — P1 · CALIDAD
**Mejora:** test de contrato middleware+`vercel.json`+route auth para cada cron.
**Impacto usuario:** evita automatismos “configurados” que en realidad nunca llegan a ejecutarse.

### V5-C009 — Añadir CSP y cabeceras de seguridad explícitas — P2 · SEGURIDAD
**Evidencia:** `next.config.mjs` sólo desactiva `poweredByHeader`; no define CSP/Referrer-Policy/Permissions-Policy explícitas.
**Mejora:** política compatible con imágenes/APIs reales, HSTS si corresponde y referrer restrictivo.
**Impacto usuario:** endurecimiento sin cambio visual.

### V5-C010 — Registrar las acciones administrativas sensibles con actor/sesión más explícitos — P2 · SEGURIDAD/OBSERVABILIDAD
**Mejora:** distinguir de forma durable intervención manual, origen, confirmación y superficie, sin guardar secretos.
**Impacto usuario:** cuando algo cambia desde Operaciones, queda claro quién/qué lo hizo y por qué.

## B. Rendimiento de frontend y navegación

### V5-C011 — Consolidar el CSS global histórico — P1 · EFICIENCIA/UX
**Evidencia:** `app/layout.js` importa globalmente `globals.css`, `v1.css`, `ux.css`, `v12.css`, `v2.css`, `v3-shell.css`, `activity.css`, `v4-search.css`, `people-v2.css`, tres generaciones de home y `home-v4.css`.
**Mejora:** tokens/base global mínimos + CSS por superficie/componentes, retirando reglas sin consumidores tras auditoría.
**Impacto usuario:** menos CSS descargado/evaluado y menos efectos visuales accidentales por cascadas antiguas.

### V5-C012 — Eliminar hojas CSS de generaciones antiguas que ya no tengan consumidores — P1 · EFICIENCIA/MANTENIBILIDAD
**Evidencia:** múltiples rutas conservan `*-v3.css`, `*-v4.css`, “modern”, “tweak”, “editorial”, etc. simultáneamente.
**Mejora:** consumer sweep + consolidación segura.
**Impacto usuario:** aspecto más consistente y menor riesgo de que un cambio arregle una pantalla y rompa otra.

### V5-C013 — Introducir un sistema de tokens de diseño canónico — P2 · UX/MANTENIBILIDAD
**Mejora:** espaciado, tamaños, radios, tipografía, estados, capas y densidad definidos una sola vez.
**Impacto usuario:** PikoFilm se siente una sola aplicación y no un conjunto de pantallas creadas en momentos distintos.

### V5-C014 — Añadir loading/skeleton granular a todas las rutas pesadas — P1 · UX/VELOCIDAD PERCIBIDA
**Evidencia:** sólo algunas áreas tienen `loading.js`; Inicio, Personas, Sagas, Novedades, Actividad y Admin carecen de boundary propio visible en el árbol.
**Mejora:** Suspense/loading por bloques útiles, no spinner global.
**Impacto usuario:** al cambiar de pantalla aparece estructura inmediata en vez de esperar una página en blanco.

### V5-C015 — Añadir error boundaries locales donde hoy un fallo secundario puede tumbar toda la pantalla — P1 · UX/FIABILIDAD
**Mejora:** separar estadísticas, históricos, detalles secundarios y controles, permitiendo mostrar el resto si un bloque falla.
**Impacto usuario:** una pieza averiada no convierte toda PikoFilm en un error.

### V5-C016 — Reducir páginas `force-dynamic` donde partes de lectura puedan cachearse de forma segura — P2 · EFICIENCIA
**Mejora:** separar datos ultradinámicos de diccionarios/read models cacheables y usar revalidation/tag invalidation.
**Impacto usuario:** navegación más rápida sin mostrar datos obsoletos relevantes.

### V5-C017 — Evitar duplicar en HTML la vista desktop y móvil de listas grandes — P2 · EFICIENCIA/ACCESIBILIDAD
**Evidencia:** Catálogo renderiza tabla desktop y lista móvil para el mismo conjunto de hasta 50 filas.
**Mejora:** markup compartido/adaptativo o render responsable por estructura.
**Impacto usuario:** menos DOM, menos transferencia y lectura más limpia por tecnologías de asistencia.

### V5-C018 — Corregir controles de paginación deshabilitados semánticamente — P3 · UX/ACCESIBILIDAD
**Evidencia:** Catálogo mantiene `Link` aun cuando visualmente el control está deshabilitado.
**Mejora:** botón/texto no accionable y `aria-disabled` correcto.
**Impacto usuario:** evita clics engañosos y mejora navegación por teclado/lector.

### V5-C019 — Añadir medición de Web Vitals/RUM real — P1 · CALIDAD/RENDIMIENTO
**Mejora:** capturar TTFB, LCP, INP y CLS por ruta en producción con una solución compatible con privacidad/coste.
**Impacto usuario:** V5 optimiza lo que de verdad tarda en su dispositivo, no sólo lo que parece lento leyendo código.

### V5-C020 — Introducir presupuesto de rendimiento en CI — P2 · CALIDAD
**Mejora:** límites para bundle/HTML/CSS y smoke Lighthouse o equivalente en rutas críticas.
**Impacto usuario:** una nueva función no puede degradar silenciosamente la velocidad.

### V5-C021 — Revisar `next/image`/componente Poster y tamaños responsivos de imágenes — P2 · EFICIENCIA/UX
**Mejora:** asegurar `sizes`, dimensiones, lazy loading y calidad apropiada por lista/ficha.
**Impacto usuario:** pósters cargan antes y consumen menos ancho de banda.

### V5-C022 — Cache cliente breve para la búsqueda global — P3 · EFICIENCIA
**Evidencia:** cada término de ≥2 caracteres vuelve a `/api/global-search` con `no-store`; sólo hay debounce de 180 ms.
**Mejora:** cache de sesión por query y reutilización al borrar/repetir.
**Impacto usuario:** resultados instantáneos al repetir búsquedas y menos consultas.

## C. Búsqueda global y descubrimiento

### V5-C023 — Indexar búsqueda textual normalizada en PostgreSQL — P1 · VELOCIDAD
**Evidencia:** búsqueda global y Catálogo usan `%LIKE%`/`translate(lower(...))`; `people` ronda 145k filas y filmografía/créditos son mucho mayores.
**Mejora:** columnas/expresiones normalizadas + `pg_trgm` o índice adecuado tras EXPLAIN real.
**Impacto usuario:** buscar títulos/personas sigue siendo rápido al crecer la base.

### V5-C024 — Evitar la doble subconsulta correlacionada de miembros en búsqueda de Sagas — P2 · EFICIENCIA
**Evidencia:** la consulta de búsqueda de Sagas calcula el count de miembros para selección y filtro.
**Mejora:** agregado/lateral único o read model.
**Impacto usuario:** búsqueda más barata y predecible.

### V5-C025 — Optimizar la comprobación de relevancia de Personas en búsqueda — P2 · EFICIENCIA
**Evidencia:** búsqueda combina nombre con `EXISTS` sobre `movie_credits` y catálogo; `movie_credits` supera 340k filas.
**Mejora:** read model/índice específico de personas relevantes.
**Impacto usuario:** el buscador responde igual de rápido con una filmografía mucho mayor.

### V5-C026 — Añadir navegación completa por teclado al buscador global — P1 · UX/ACCESIBILIDAD
**Evidencia:** no hay índice activo, flechas, Enter/Escape ni `aria-activedescendant` en `GlobalSearch`.
**Mejora:** patrón combobox accesible.
**Impacto usuario:** buscar y abrir sin tocar el ratón.

### V5-C027 — Mejorar semántica accesible del overlay de búsqueda — P2 · ACCESIBILIDAD
**Evidencia:** resultados usan `role="dialog"` sin comportamiento completo de diálogo/combobox.
**Mejora:** roles, foco, etiquetas y cierre coherentes.
**Impacto usuario:** mejor accesibilidad y comportamiento menos extraño en teclado.

### V5-C028 — Añadir “Ver todos los resultados” con búsqueda federada — P2 · FUNCIÓN
**Mejora:** página/resultados completos agrupados por Títulos, Personas y Sagas cuando 6+6+6 no basta.
**Impacto usuario:** no perder coincidencias válidas por el límite del popup.

### V5-C029 — Resaltar por qué coincide un resultado — P3 · UX
**Mejora:** indicar “título original”, “IMDb”, “persona”, “saga”, etc.
**Impacto usuario:** entender inmediatamente por qué apareció algo.

### V5-C030 — Añadir recientes/favoritos de búsqueda sólo locales y opcionales — P3 · FUNCIÓN
**Mejora:** accesos recientes sin crear un nuevo dominio servidor.
**Impacto usuario:** volver rápido a fichas consultadas habitualmente.

## D. Catálogo y ficha

### V5-C031 — Reescribir la consulta de Catálogo para paginar antes de joins caros — P1 · VELOCIDAD
**Evidencia:** la query base une catálogo, Plex, technical state, PikoQuality y agregados antes de ordenar/paginar.
**Mejora:** seleccionar IDs/fila base primero y enriquecer sólo los 50 visibles cuando semánticamente sea posible.
**Impacto usuario:** filtros y cambios de página más rápidos.

### V5-C032 — Evitar repetir el mismo grafo de joins para resumen y filas del Catálogo — P1 · EFICIENCIA
**Evidencia:** `getCatalogV4` calcula counts y luego filas sobre una base similar.
**Mejora:** CTE/window/read model o resumen mínimo que no una tablas irrelevantes.
**Impacto usuario:** menos tiempo y DB por cada visita al catálogo.

### V5-C033 — Sacar géneros agregados por fila de una subconsulta correlacionada — P2 · EFICIENCIA
**Evidencia:** cada fila visible agrega géneros mediante subquery sobre `movie_genres_canonical`.
**Mejora:** preagregado/read model o join posterior a IDs paginados.
**Impacto usuario:** especialmente útil en filtros/ordenaciones repetidas.

### V5-C034 — Cachear el diccionario de 31 géneros — P2 · EFICIENCIA
**Evidencia:** Neon registra >3,2 M sequential scans sobre `genres`, una tabla de sólo 31 filas; el scan es barato, la frecuencia es la señal.
**Mejora:** cache/tag explícito y evitar lecturas redundantes.
**Impacto usuario:** pequeño ahorro por visita, gran ahorro acumulado.

### V5-C035 — Crear estrategia de búsqueda/ordenación normalizada indexable para Catálogo — P1 · VELOCIDAD
**Evidencia:** `translate(lower(...)) LIKE '%...%'` y tie-breaks normalizados son difíciles de indexar tal como están.
**Mejora:** campos normalizados generados/materializados e índices probados por EXPLAIN.
**Impacto usuario:** filtros de texto no se degradan al crecer de 20k a 100k+ títulos.

### V5-C036 — Evaluar cursor pagination para navegaciones profundas — P3 · ESCALABILIDAD
**Mejora:** mantener URL/orden estable y sustituir OFFSET sólo si métricas muestran páginas profundas frecuentes.
**Impacto usuario:** página 200 tan ágil como página 2 en un catálogo futuro mucho mayor.

### V5-C037 — Añadir presets de filtros útiles en Catálogo — P3 · FUNCIÓN
**Ejemplos:** “Sin Plex con PikoScore ≥8”, “En Plex sin PikoQuality”, “Series recientes”, sin convertirlos en estados funcionales.
**Impacto usuario:** consultas frecuentes en un toque.

### V5-C038 — Permitir guardar vistas/filtros del Catálogo — P3 · FUNCIÓN
**Mejora:** favoritos de filtros personales reutilizando la URL canónica.
**Impacto usuario:** volver a selecciones habituales sin reconstruir filtros.

### V5-C039 — Comparador ligero de títulos — P3 · FUNCIÓN
**Mejora:** seleccionar 2–4 títulos y comparar PikoScore, ratings, datos editoriales y calidad/Plex disponible.
**Impacto usuario:** explorar la colección de forma más analítica sin exportar datos.

### V5-C040 — Historial contextual de cambios importantes en la ficha — P2 · FUNCIÓN/UX
**Mejora:** acceso compacto a Actividad filtrada por IMDb/persona desde la ficha.
**Impacto usuario:** saber “qué cambió en esta película” sin buscar manualmente en Actividad.

## E. Inicio y estadísticas

### V5-C041 — Reducir el coste del Home desacoplando agregados — P1 · VELOCIDAD
**Evidencia:** `getDashboardV2Raw` lanza en paralelo múltiples agregados completos (KPI, décadas, géneros, países, perfil, bandas, genre×decade) más Calidad y Sagas.
**Mejora:** snapshot/read models de agregados y actualización incremental/tagged donde corresponda.
**Impacto usuario:** Inicio abre más rápido y con menos picos de DB.

### V5-C042 — Evitar consultar tablas de compatibilidad para “última sync Plex” si existe una fuente canónica mejor — P2 · ARQUITECTURA
**Evidencia:** Home aún consulta `plex_sync_runs`, mientras observabilidad V4 converge en `process_runs`; la tabla puede ser compatibilidad real.
**Mejora:** consumer sweep y, si procede, derivar de `PROC-NOV-009`/estado canónico.
**Impacto usuario:** menos fuentes de verdad dobles y menos riesgo de fechas discrepantes.

### V5-C043 — Cachear señales de atención del Home de forma coherente con Operaciones — P2 · EFICIENCIA/CONSISTENCIA
**Evidencia:** Home calcula errores técnicos directamente desde `process_run_errors`, con semántica más simple que Operaciones V4.
**Mejora:** reutilizar un modelo de incidencias operativas común.
**Impacto usuario:** Inicio y Operaciones muestran el mismo número real de problemas activos.

### V5-C044 — Convertir los agregados diarios en una capa analítica canónica — P2 · ARQUITECTURA
**Mejora:** snapshots versionados para estadísticas costosas, con freshness visible y fallback a cálculo vivo cuando sea necesario.
**Impacto usuario:** estadísticas rápidas y comparables en el tiempo.

### V5-C045 — Hacer “Lo que dice tu filmoteca” más accionable sin recomendaciones algorítmicas — P3 · FUNCIÓN
**Mejora:** tendencias temporales, cambios de composición, coberturas que suben/bajan y enlaces a conjuntos explicativos.
**Impacto usuario:** Inicio cuenta qué está cambiando, no sólo cuál es el género más numeroso.

### V5-C046 — Añadir comparación temporal configurable en estadísticas — P3 · FUNCIÓN
**Mejora:** “vs hace 30 días/1 año” para tamaño, Plex, PikoScore conocido, etc.
**Impacto usuario:** interpretar evolución sin leer la gráfica a ojo.

## F. Actividad, Operaciones y observabilidad

### V5-C047 — Sustituir `router.refresh()` completo cada 30 s en Actividad por actualización incremental — P1 · EFICIENCIA
**Evidencia:** `ActivityRefresh` refresca toda la ruta cada 30 s mientras está visible y también al recuperar foco.
**Mejora:** endpoint/stream ligero o refresh sólo si hay cambio/version stamp.
**Impacto usuario:** Actividad sigue viva sin recalcular/reenviar toda la pantalla periódicamente.

### V5-C048 — Unificar exactamente la semántica “incidencia activa” entre Inicio y Operaciones — P1 · CONSISTENCIA
**Mejora:** una función/query canónica de ciclo de vida de incidencias.
**Impacto usuario:** no ver “3 errores” en Inicio y “0 incidencias” en Operaciones.

### V5-C049 — Medir coste y frecuencia de consultas de Operaciones — P2 · OBSERVABILIDAD/VELOCIDAD
**Mejora:** instrumentation de duración/filas para búsqueda técnica, salud e incidencias.
**Impacto usuario:** Operaciones no se vuelve lenta a medida que crece `process_runs`.

### V5-C050 — Índices específicos de búsqueda de observabilidad basados en uso real — P2 · VELOCIDAD
**Mejora:** analizar consultas del buscador por run/process/entity/error y crear sólo índices que EXPLAIN demuestre útiles.
**Impacto usuario:** encontrar un fallo concreto de hace semanas rápidamente.

### V5-C051 — Evitar almacenar/mostrar payloads técnicos excesivos por defecto — P2 · EFICIENCIA/UX
**Mejora:** contextos compactos, truncado seguro y detalle bajo demanda sin perder diagnóstico.
**Impacto usuario:** páginas de run más legibles y menor crecimiento de observabilidad.

### V5-C052 — Añadir correlación visual completa de cadena padre→hijos→continuaciones — P2 · UX/FUNCIÓN
**Mejora:** árbol/flujo compacto de una operación compuesta.
**Impacto usuario:** entender “esto empezó aquí y desencadenó estas 4 cosas” sin abrir runs uno por uno.

### V5-C053 — Añadir búsqueda directa desde una entidad hacia sus últimas ejecuciones — P2 · FUNCIÓN
**Mejora:** desde ficha/persona/saga, “Actividad técnica” contextual.
**Impacto usuario:** diagnóstico mucho más rápido.

### V5-C054 — Incorporar un estado explícito de frescura de workers/cron en salud operativa — P1 · FUNCIÓN
**Mejora:** última ejecución esperada vs real de planner/snapshot y heartbeats de workers.
**Impacto usuario:** detectar que una automatización “se ha parado” antes de notar datos atrasados.

### V5-C055 — Alertar por anomalía de volumen, no sólo error individual — P2 · FUNCIÓN
**Mejora:** detectar crecimiento inusual de cola/retries/errores repetidos o ausencia de ejecuciones esperadas.
**Impacto usuario:** Operaciones avisa del problema sistémico, no de 300 síntomas.

## G. Neon, SQL y almacenamiento

### V5-C056 — Activar/usar estadísticas de consultas tipo `pg_stat_statements` si el entorno lo permite — P1 · OBSERVABILIDAD
**Evidencia:** el intento de listar slow queries indicó que la extensión no está instalada, por lo que hoy falta evidencia SQL agregada de producción.
**Mejora:** habilitarla sólo tras evaluar coste/plan; usarla para V5 y Operaciones.
**Impacto usuario:** optimizaciones basadas en las consultas que realmente consumen tiempo.

### V5-C057 — Auditar y retirar índices realmente inutilizados tras ventana representativa — P2 · EFICIENCIA
**Evidencia:** Neon reporta varios índices con `idx_scan=0`, algunos grandes (p. ej. fingerprint técnico ~12 MB, freshness ratings ~5,8 MB). Una lectura puntual no basta para borrarlos.
**Mejora:** medir tras stats reset conocido, revisar planes/constraints y retirar sólo los demostrablemente redundantes.
**Impacto usuario:** menos almacenamiento y menos coste de escritura sin perder velocidad.

### V5-C058 — Detectar índices duplicados/solapados — P2 · EFICIENCIA
**Mejora:** comparar columnas, orden, predicados y constraints de índices de tablas grandes.
**Impacto usuario:** actualizaciones más ligeras y DB más limpia.

### V5-C059 — Revisar estrategia de churn en tablas con muchos dead tuples — P2 · EFICIENCIA
**Evidencia:** `series_reference_episodes`, `plex_files`, `plex_media`, `series_diagnostics`, `catalog_candidates` y `process_runs` muestran porcentajes apreciables de tuplas muertas.
**Mejora:** identificar delete+insert masivos, valorar upserts/deltas y autovacuum por tabla sólo donde la evidencia lo justifique.
**Impacto usuario:** menos bloat y rendimiento más estable.

### V5-C060 — Optimizar `person_filmography` y `movie_credits`, las tablas de relación más grandes — P1 · ESCALABILIDAD
**Evidencia:** ~521k filas/64 MB y ~345k filas/61 MB respectivamente en la inspección.
**Mejora:** revisar índices según queries reales, anchura de filas, deduplicación y read models de relevancia.
**Impacto usuario:** Personas y búsqueda siguen ágiles al crecer.

### V5-C061 — Revisar almacenamiento de `process_run_events` bajo retención de 30 días — P2 · EFICIENCIA
**Evidencia:** ~47 MB y ~129k filas en inspección.
**Mejora:** asegurar purga efectiva, payload compacto e índices alineados a consultas.
**Impacto usuario:** Operaciones mantiene detalle sin que la observabilidad crezca de forma innecesaria.

### V5-C062 — Cerrar compatibilidades persistentes demostrablemente huérfanas — P2 · ARQUITECTURA
**Ejemplos a auditar, no borrar a ciegas:** `pipeline_runs`, `plex_sync_runs`, `series_quality_runs`, `admin_events` y otras estructuras históricas.
**Impacto usuario:** menos fuentes paralelas y menos mantenimiento mental/técnico.

### V5-C063 — Versionar explícitamente el esquema de DB esperado por la aplicación — P1 · HARDENING
**Mejora:** tabla/version de migración o fingerprint comprobable en healthcheck.
**Impacto usuario:** saber si código y base de datos pertenecen a la misma versión antes de usar funciones nuevas.

## H. Batch, APIs y automatización

### V5-C064 — Mostrar utilización real de capacidad por pool — P2 · FUNCIÓN
**Mejora:** API/FAST/Plex: capacidad efectiva, ocupada, cola y saturación, no sólo límites configurados.
**Impacto usuario:** saber si algo tarda porque falla o simplemente porque está esperando turno.

### V5-C065 — Estimar tiempo restante de Batch a partir de historial reciente — P2 · FUNCIÓN
**Mejora:** ETA conservadora con rango/confianza.
**Impacto usuario:** “quedan ~12 min” es más útil que “384/1000”.

### V5-C066 — Simular antes de lanzar un Batch grande — P3 · FUNCIÓN
**Mejora:** dry-run de cuántos items serían elegibles, fuentes necesarias, cuota/carga estimada y bloqueos.
**Impacto usuario:** saber qué va a ocurrir antes de pulsar “todas”.

### V5-C067 — Hacer visible la causa exacta de una espera de API governance — P2 · UX
**Mejora:** distinguir cuota, concurrency, breaker, reserva Batch/manual y `blocked_until` con texto humano.
**Impacto usuario:** entender por qué un proceso está parado sin leer logs.

### V5-C068 — Auditor automático de bypasses de fuentes gobernadas — P1 · CALIDAD/ARQUITECTURA
**Mejora:** test estático/contract que detecte `fetch` directo a TMDb/OMDb/MDBList fuera de wrappers permitidos.
**Impacto usuario:** protege permanentemente el fail-closed conseguido en V4.

### V5-C069 — Revisar si Watchmode debe incorporarse a gobierno común — P2 · ARQUITECTURA, DECISIÓN
**Evidencia:** actualmente está fuera deliberadamente del set gobernado y SER-004 lo usa como fallback.
**Mejora potencial:** límites/breaker/observabilidad homogéneos si su volumen/rate limit lo requiere.
**Impacto usuario:** menos fallos opacos de disponibilidad España. No se debe incorporar automáticamente sin decisión.

### V5-C070 — Añadir prueba periódica de conectividad de fuentes sin consumir innecesariamente cuota — P3 · FUNCIÓN
**Mejora:** health derivado de llamadas reales recientes + probe sólo cuando falte evidencia.
**Impacto usuario:** Operaciones puede decir “TMDb está bien / bloqueado / sin evidencia reciente”.

## I. Tests, CI y mantenibilidad

### V5-C071 — Dejar de mantener manualmente la lista de tests en `test:quality` — P1 · CALIDAD
**Evidencia:** `package.json` enumera fichero por fichero; ya hubo riesgo de “verde falso” al añadir tests sin incorporarlos. Además existen tests del árbol que se ejecutan fuera del script o pueden quedar fuera.
**Mejora:** descubrimiento automático o test que compare manifiesto vs filesystem.
**Impacto usuario:** una protección nueva no puede quedarse sin ejecutar por olvido.

### V5-C072 — Añadir tests E2E reales de los flujos críticos — P1 · CALIDAD
**Evidencia:** la suite es principalmente contractual/regex; no se observa Playwright/Cypress en dependencias.
**Mejora:** smoke browser de Inicio→Catálogo→Ficha, Novedades, Calidad, Actividad, Operaciones y acciones seguras.
**Impacto usuario:** CI comprueba que la aplicación funciona de verdad, no sólo que el código contiene ciertas cadenas.

### V5-C073 — Añadir accesibilidad automatizada a CI — P2 · CALIDAD/UX
**Mejora:** axe/Playwright + reglas mínimas de teclado, labels, contraste y landmarks.
**Impacto usuario:** evita regresiones invisibles de interacción.

### V5-C074 — Añadir visual regression de las superficies canónicas — P2 · CALIDAD/UX
**Mejora:** capturas de rutas clave a anchos desktop/móvil comparadas en PR.
**Impacto usuario:** detectar antes del deploy que un CSS antiguo rompió una tabla, badge o navegación.

### V5-C075 — Introducir lint real en CI — P2 · CALIDAD
**Evidencia:** CI no ejecuta el script `lint`; sólo syntax checks parciales, tests y build.
**Mejora:** configurar lint compatible con Next actual y hacerlo gate.
**Impacto usuario:** menos bugs pequeños y código más uniforme.

### V5-C076 — Añadir type checking gradual con TypeScript/JSDoc para fronteras críticas — P3 · MANTENIBILIDAD
**Mejora:** empezar por process runtime, Batch, API governance y modelos de resultados sin reescribir toda la app de golpe.
**Impacto usuario:** menos errores por objetos/propiedades `undefined` como los vistos históricamente.

### V5-C077 — Partir módulos de 15–27 KB por responsabilidad canónica — P2 · MANTENIBILIDAD
**Evidencia:** varios cores/workers/queries concentran grandes bloques (`data001-canonical`, `pikoquality`, `process-planning`, `series-plex-sync`, `batch-api-worker`, etc.).
**Mejora:** separar selección, proveedor, persistencia, mapping y observabilidad sin duplicar lógica.
**Impacto usuario:** cambios futuros más seguros y rápidos de implementar.

### V5-C078 — Añadir test de “documentación vs rutas/procesos vivos” más amplio — P2 · CALIDAD
**Mejora:** comprobar que cada PROC del catálogo tiene display, entrypoint/executor esperado y que no aparecen PROC vivos sin documentación.
**Impacto usuario:** V5 no vuelve a acumular contradicciones como la detectada en SAGA-001.

### V5-C079 — Crear una política automática de deuda legacy — P3 · MANTENIBILIDAD
**Mejora:** todo módulo/table/endpoint marcado compatibilidad debe tener propietario, motivo y gate de retirada, sin fechas inventadas.
**Impacto usuario:** la aplicación no acumula piezas antiguas indefinidamente.

### V5-C080 — Separar tests de contrato estático, unitarios, integración y E2E — P2 · CALIDAD
**Mejora:** suites con propósito claro, tiempos independientes y fallos diagnosticables.
**Impacto usuario:** CI más fiable y errores más fáciles de corregir.

## J. UX global, accesibilidad y nuevas capacidades

### V5-C081 — Rehacer navegación de teclado/foco del menú móvil “Más” — P2 · UX/ACCESIBILIDAD
**Evidencia:** popup usa `role=menu` pero no implementa un patrón completo de foco/teclas.
**Mejora:** foco inicial/retorno, Escape, flechas/tab coherentes y backdrop no ambiguo.
**Impacto usuario:** navegación móvil más sólida y accesible.

### V5-C082 — Sustituir iconos Unicode inconsistentes por un sistema iconográfico coherente — P3 · UX
**Mejora:** SVG/iconos internos con tamaño, stroke y significado uniforme, sin depender de cómo renderice cada SO.
**Impacto usuario:** apariencia más profesional y estable.

### V5-C083 — Añadir Command Palette global — P3 · FUNCIÓN
**Mejora:** Cmd/Ctrl+K para buscar y saltar a Catálogo, Persona, Saga, Calidad, Actividad u Operaciones y ejecutar sólo acciones seguras.
**Impacto usuario:** acceso muy rápido en escritorio sin llenar la navegación.

### V5-C084 — Hacer breadcrumbs/contexto de retorno consistentes en todas las fichas — P2 · UX
**Mejora:** conservar filtros/página/origen al entrar y volver desde Catálogo, Calidad, Personas, Sagas y Operaciones.
**Impacto usuario:** no perder el punto donde estabas trabajando.

### V5-C085 — Sistema único de estados vacíos — P3 · UX
**Mejora:** distinguir “no hay nada porque todo está bien”, “no hay coincidencias” y “no hay datos todavía”, con siguiente acción útil.
**Impacto usuario:** menos dudas ante una pantalla vacía.

### V5-C086 — Sistema único de confirmaciones según riesgo — P2 · UX/SEGURIDAD
**Mejora:** informativa, confirmación simple, doble confirmación/destructiva; lenguaje y botones coherentes.
**Impacto usuario:** sabes siempre qué va a pasar antes de una acción delicada.

### V5-C087 — Notificaciones/toasts globales consistentes tras acciones — P2 · UX
**Mejora:** éxito, no-change, en cola, parcial y fallo con enlace a Actividad/Operaciones cuando aplique.
**Impacto usuario:** feedback inmediato sin tener que deducir si el clic funcionó.

### V5-C088 — Estado “en proceso” compartido para evitar dobles acciones desde varias superficies — P2 · UX/FIABILIDAD
**Mejora:** si una entidad ya tiene operación equivalente activa, mostrarla y enlazarla en vez de dejar volver a lanzarla.
**Impacto usuario:** menos duplicados y más claridad.

### V5-C089 — Atajos contextuales entre Catálogo, Calidad, Actividad y Operaciones — P2 · FUNCIÓN
**Mejora:** desde una entidad, saltos explícitos al estado funcional, historial y diagnóstico técnico correspondientes.
**Impacto usuario:** menos navegación manual para investigar un caso.

### V5-C090 — Exportación segura de vistas/diagnóstico — P3 · FUNCIÓN
**Mejora:** exportar CSV/JSON de una lista filtrada o un resumen técnico sin secretos/payloads sensibles.
**Impacto usuario:** analizar o archivar fuera de PikoFilm sin acceder directamente a Neon.

---

# Hallazgos transversales que condicionan la priorización

1. **La mayor ganancia inmediata puede no ser visual.** El polling legado de Lifecycle es un coste real medido y debe resolverse antes que microajustes.
2. **Hay una posible fragilidad del cron de Activity Planner.** Debe comprobarse antes de asumir que toda planificación futura V4 está corriendo como se diseñó.
3. **La velocidad debe medirse, no adivinarse.** Neon no tiene `pg_stat_statements` disponible actualmente y no hay RUM/Web Vitals canónico; V5 necesita observabilidad de rendimiento para priorizar SQL y frontend con datos reales.
4. **Los scans de tablas diminutas no son automáticamente un problema.** `genres` o controles Batch son baratos por scan; su enorme frecuencia señala oportunidades de reducir round-trips, no justifica índices absurdos.
5. **Un índice con `idx_scan=0` no se borra por una foto puntual.** Primero hay que conocer reset de stats, workload representativo, constraints y EXPLAIN.
6. **La suite V4 es fuerte en contratos estructurales pero débil en navegador real.** V5 debería conservar esos contratos y añadir integración/E2E, no reemplazarlos.
7. **La app contiene varias generaciones visuales coexistiendo.** La consolidación CSS/diseño puede mejorar simultáneamente velocidad, consistencia y mantenibilidad.
8. **Home y búsqueda concentran trabajo transversal.** Son buenos candidatos a optimización porque se usan mucho y consultan dominios grandes.
9. **No se propone automatizar Plex global.** La regla V4 permanece: sincronización Plex global manual.
10. **No se propone borrar compatibilidad ni índices a ciegas.** Todo borrado requiere consumer sweep/planes/evidencia.

# Procedimiento de decisión V5

Para cada candidato se explicará al usuario en lenguaje de producto:
1. qué ocurre hoy;
2. qué notaría él;
3. qué se propone;
4. beneficio esperado;
5. coste/riesgo aproximado;
6. recomendación del auditor.

El usuario decide **APROBAR / RECHAZAR / POSPONER**. Sólo entonces se persiste la decisión en el roadmap V5 antes de presentar el siguiente candidato.
