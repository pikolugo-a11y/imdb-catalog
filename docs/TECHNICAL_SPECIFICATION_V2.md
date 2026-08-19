# PikoFilm V2 — Documento técnico

**Estado:** baseline técnico de la versión estable · 19/08/2026  
**Repositorio:** `pikolugo-a11y/imdb-catalog`

## 1. Arquitectura general
PikoFilm V2 es una aplicación web Next.js desplegada en Vercel, con PostgreSQL gestionado en Neon como almacenamiento operativo. El frontend usa App Router y Server Components/Server Actions; la lógica de dominio reside principalmente en `lib/`. Las integraciones externas principales son Plex y TMDb, junto con el pipeline de enriquecimiento de IMDb/FilmAffinity y fuentes auxiliares.

Arquitectura lógica:

`Browser → Next.js/Vercel → servicios lib/* → Neon PostgreSQL`

Integraciones:

`Plex → plex-sync → tablas Plex → read models/diagnósticos`

`IMDb/FA/TMDb → enrich-title → catálogo/identidad/sagas`

`TMDb TV → series-v2 → referencia episodios + disponibilidad ES`

La regla de diseño es separar **datos fuente**, **estado editorial** y **datos derivados/diagnósticos**.

## 2. Estructura de aplicación
### 2.1 `app/`
Rutas principales observadas:
- `/` Dashboard.
- `/catalogo` y `/catalogo/[imdbId]`.
- `/catalogo/excluidas`.
- `/plex`.
- `/calidad`, `/calidad/peliculas`, `/calidad/identidad`, `/calidad/series`, `/calidad/series/[ratingKey]`.
- `/sagas`, `/sagas/[name]`.
- `/personas/[id]`.
- `/admin`.

`app/actions.js` concentra Server Actions que conectan componentes con servicios de dominio y mutaciones.

### 2.2 `components/`
Contiene componentes reutilizables de navegación, KPIs, segmented controls, controles de procesos y visualizaciones. `DecadeCoverage` encapsula la visualización histórica por décadas.

### 2.3 `lib/`
Servicios principales:
- `db.js`: creación/acceso al cliente Neon.
- `queries.js`: consultas de catálogo y lectura general.
- `operational-queries.js`: consultas operativas V2.
- `plex-queries-v2.js`: Biblioteca Plex paginada y cruces.
- `plex-sync.js`: sincronización rápida/incremental Plex y reconciliaciones asociadas.
- `enrich-title.js`: pipeline individual de enriquecimiento.
- `identity.js`: diagnóstico y persistencia de identidad.
- `quality-v2.js`: análisis Calidad Películas.
- `series-v2.js`: refresco de referencia/disponibilidad de Series.
- `sagas-v2.js`: lógica de sagas/cobertura.
- `dashboard-v2.js`: agregados, KPIs, distribuciones e histórico.
- `admin-queries-v2.js`: lectura de actividad operativa.
- `runlog.js`: ciclo de vida de ejecuciones.
- `excluded.js`: soporte de exclusiones.

## 3. Persistencia y dominios de datos
### 3.1 Catálogo
El catálogo se expone mediante un read model (`catalog_read_model`) y tablas fuente/editoriales. IMDb actúa como identificador canónico importante para películas y para gran parte del cruce histórico. El read model evita que cada pantalla reconstruya el universo editorial desde cero.

### 3.2 Plex
Tablas clave:
- `plex_items`: inventario jerárquico y estado activo de elementos Plex.
- `plex_external_ids`: IDs externos por `rating_key` y proveedor.
- `plex_media`: características de media/streams agregadas por elemento.
- `plex_files`: información física de archivos.
- `plex_sync_runs`: detalle específico de sincronizaciones cuando aplica.

`rating_key` es el identificador operativo Plex y permite relacionar show/season/episode mediante claves padre/abuelo e índices de temporada/episodio.

### 3.3 Exclusiones
`catalog_exclusions` mantiene la exclusión de forma reversible. Las consultas operativas hacen `LEFT JOIN`/anti-join para impedir que excluidos alimenten calidad, series, sagas y métricas.

### 3.4 Series
- `series_reference`: identidad y resumen oficial de un show.
- `series_reference_episodes`: referencia oficial por `(show_rating_key, season_number, episode_number)`.
- `series_season_availability`: disponibilidad por temporada/país, incluyendo override manual.
- capas/vistas efectivas cruzan referencia, Plex y disponibilidad.

### 3.5 Calidad
Las incidencias derivadas se separan de las tablas fuente Plex. Calidad no modifica ni elimina archivos; almacena diagnóstico/estado operativo y respeta excepciones.

### 3.6 Procesos
`pipeline_runs` es el registro transversal. Los servicios llaman `startRun()` y `finishRun()` desde `runlog.js`, con `job_type`, `source`, estado, contadores y `summary` JSON. Tablas específicas pueden complementar este registro.

### 3.7 Dashboard
El dashboard combina consultas agregadas instantáneas con snapshots históricos. El objetivo es evitar cálculos costosos fila a fila en cada render y permitir evolución temporal.

## 4. Acceso a base de datos
`lib/db.js` centraliza la conexión PostgreSQL/Neon. Los servicios usan SQL parametrizado. Se favorecen agregaciones y joins en PostgreSQL para minimizar roundtrips y transferencias de miles de filas al runtime de Vercel.

Las operaciones por lotes usan transacciones/chunks cuando es necesario; por ejemplo, Series inserta/actualiza episodios de referencia en bloques.

## 5. Sincronización Plex
### 5.1 Responsabilidad
`plex-sync.js` es la frontera de entrada de cambios físicos. Debe actualizar inventario, metadatos Plex, IDs externos y detectar altas/cambios/bajas sin convertir el sync en un análisis externo pesado.

### 5.2 Incrementalidad
El diseño evita reexpandir toda la biblioteca cuando no es necesario. El inventario base se compara con estado persistido y se amplían detalles donde existen cambios o información necesaria.

### 5.3 Reconciliación de identidad de series
La detección de un cambio de IMDb/TMDb/TVDb pertenece al sync Plex, no a `series-v2`. Cuando cambia la identidad de un show, Plex Sync invalida la referencia derivada anterior. El refresco de Series reconstruye posteriormente la referencia desde TMDb. Esta separación evita duplicar detección y evita que el sync haga llamadas masivas de temporadas.

### 5.4 Bajas
Los elementos desaparecidos se marcan/inactivan según el modelo de sincronización en lugar de confundirlos con catálogo editorial.

### 5.5 Rendimiento/timeout
La sincronización se ha optimizado reduciendo roundtrips y paginando la UI. Las operaciones cercanas al límite de ejecución deben instrumentarse y no depender de un margen HTTP mínimo.

## 6. Pipeline individual de enriquecimiento
`lib/enrich-title.js` implementa el alta/actualización individual.

Entradas posibles: IMDb conocido, identidad Plex (ratingKey + GUIDs), TMDb/otros IDs y correcciones manuales.

Flujo conceptual:
1. Resolver identidad suficiente.
2. Obtener/normalizar metadatos IMDb.
3. Resolver FilmAffinity/Wikidata según estrategia configurada.
4. Resolver TMDb y recursos asociados.
5. Persistir catálogo y relaciones.
6. Actualizar colecciones/sagas cuando corresponda.
7. Recalcular diagnósticos afectados.
8. Registrar ejecución.

Los IDs marcados manualmente deben conservar precedencia. Un refresco automático no puede convertir un valor manual válido en `NULL` porque una fuente automática no lo encuentre.

## 7. Identidad V2
`lib/identity.js` implementa la capa común.

Principios técnicos:
- distinguir identidad automática de identidad confirmada manualmente cuando el esquema lo permita;
- validar formatos;
- persistir cambios de forma transaccional/coherente;
- actualizar tanto catálogo como identidad Plex cuando el origen de la edición lo requiera;
- reanalizar después de mutaciones;
- no corregir agresivamente contradicciones sin evidencia suficiente.

La UI `/calidad/identidad` consulta problemas y ofrece reintento/edición. Las fichas reutilizan acciones de identidad.

## 8. Calidad Películas V2
`lib/quality-v2.js` trabaja principalmente con datos ya presentes en Neon.

### 8.1 Motor duración
Calcula desviación absoluta y relativa entre duración física y referencia. Los umbrales fueron calibrados sobre la distribución real para reducir falsos positivos.

### 8.2 Filename
Normaliza extensiones/tags/resolución/codec y compara texto/año con títulos esperados.

### 8.3 Duplicados
Agrupa por identidad y compara medias. Duraciones muy diferentes impiden asumir automáticamente duplicidad equivalente.

### 8.4 Calidad técnica
Combina señales de resolución, bitrate, codec, tamaño/duración, HDR y audio según disponibilidad. La resolución aislada no determina el diagnóstico.

### 8.5 Exclusiones y huella
El motor filtra `catalog_exclusions`. Las excepciones deben estar vinculadas a la huella relevante para que un archivo realmente cambiado pueda reevaluarse.

## 9. Series V2
`lib/series-v2.js` usa TMDb API con `TMDB_API_TOKEN` y `cache: no-store`.

### 9.1 Selección
`refreshSeriesV2({limit=120})` selecciona referencias con `tmdb_id`, excluye títulos presentes en `catalog_exclusions`, prioriza referencias nunca refrescadas/antiguas y limita el lote.

### 9.2 Concurrencia
Procesa shows con un pool concurrente de 6 workers. Para cada show consulta `/tv/{tmdb_id}` y después cada temporada positiva mediante `/tv/{tmdb_id}/season/{n}`.

### 9.3 Referencia
Cada episodio se upserta en `series_reference_episodes`. Las escrituras de episodios se agrupan en transacciones de hasta 100 operaciones. Después se actualizan título, título original, año, número oficial de temporadas/episodios, fuente y `refreshed_at` de `series_reference`.

### 9.4 Disponibilidad ES
A partir de `watch/providers` para `ES`, fechas de emisión y episodios pasados/futuros calcula `ES_AVAILABLE`, `ES_PARTIAL`, `ES_NOT_YET` o `UNKNOWN`. `series_season_availability` se actualiza sin pisar filas con `manual_override=true`.

### 9.5 Anomalías
Tras el refresco ejecuta una agregación SQL que compara episodios Plex activos con la referencia por temporada/episodio. Calcula series con extras, episodios no emparejados y casos de alto riesgo (extras >=20% de episodios oficiales cuando existe denominador).

### 9.6 Logging
Registra `series_v2_refresh` en `pipeline_runs`; el summary incluye series revisadas, temporadas, episodios, disponibilidad, anomalías y errores.

### 9.7 Override manual
`setSeasonAvailability()` persiste `EXCEPTION_AVAILABLE` o `EXCEPTION_NOT_AVAILABLE` con `source='manual'`, confianza alta y `manual_override=true`.

### 9.8 Mejora pendiente
Issue #36: el refresco puede acercarse/superar el timeout de la petición en el primer intento. Debe instrumentarse por fases y optimizarse o desacoplarse antes de limitarse a aumentar el timeout.

## 10. Sagas V2
`lib/sagas-v2.js` mantiene la lógica de cobertura sobre colecciones y universos. El estado se deriva del número de miembros presentes frente al total. La sincronización Plex puede cambiar cobertura sin necesidad de volver a consultar TMDb si la composición de la colección ya es conocida. Las actualizaciones externas deben ser incrementales.

## 11. Dashboard V2
`lib/dashboard-v2.js` produce:
- KPIs agregados;
- histórico por periodo;
- distribuciones por resolución, codec, género y país;
- cobertura por décadas;
- contadores de calidad, identidad, series, sagas y fallos.

`app/page.js` es `force-dynamic`, por lo que solicita el estado actual al servidor. Los gráficos son componentes ligeros basados en HTML/CSS y datos agregados, evitando librerías pesadas innecesarias.

`DecadeCoverage` calcula total, owned, cobertura, máximo de escala, mejor cobertura y máximo pendiente; renderiza columnas cuya altura representa volumen y cuya fracción interior representa presencia Plex.

## 12. Biblioteca Plex y paginación
`plex-queries-v2.js` realiza filtrado y paginación en SQL. La UI no descarga los ~12k elementos para luego filtrarlos en navegador. Esto redujo significativamente la latencia observada al cambiar de vistas.

## 13. Admin y observabilidad
`runlog.js` normaliza el ciclo de vida de procesos. Un proceso debe crear su run antes del trabajo y cerrarlo en `success` o `failed`, incluyendo error normalizado mediante `errorInfo()`.

`admin-queries-v2.js` alimenta `/admin`. El objetivo operativo es que una incidencia pueda diagnosticarse por run, duración, contadores y etapa sin necesitar logs de infraestructura para errores de negocio.

Los fallos de build/deploy siguen perteneciendo a Vercel/GitHub CI y no pueden registrarse desde una aplicación que no llegó a desplegarse.

## 14. UI/UX
Next.js App Router renderiza páginas servidor y usa acciones servidor para mutaciones. Los filtros pequeños usan controles segmentados/chips; listas de alta cardinalidad pueden usar select. Las rutas preservan query params cuando son parte del estado funcional.

El detalle de Series usa explícitamente parámetros de URL para temporada y estado; `state=all` debe conservarse para que el servidor no vuelva al default `Faltan ES`.

Los listados grandes se paginan. Las acciones destructivas son reversibles cuando funcionalmente corresponde (exclusiones) y no provocan borrados físicos en Plex.

## 15. Seguridad y secretos
Los secretos (`DATABASE_URL`, token Plex, `TMDB_API_TOKEN` y credenciales equivalentes) deben existir únicamente como variables de entorno/secretos de plataforma. No deben incluirse en código, documentación, commits ni respuestas de UI. Las trazas Admin deben evitar exponerlos.

El servidor es quien accede a Neon y APIs con secretos; el navegador no necesita recibir credenciales de backend.

## 16. CI/CD
El repositorio contiene GitHub Actions para CI y tareas de mantenimiento/refresco. Vercel despliega la rama principal. Un merge correcto no implica que producción esté actualizada hasta que el deployment correspondiente esté `READY`; la batería final confirmó la importancia de verificar el deployment antes de atribuir resultados a un cambio.

## 17. Rendimiento y escalabilidad
Principios aplicados:
- SQL agregado y paginación server-side.
- Separar lectura de procesos de enriquecimiento.
- Incrementalidad Plex/TMDb.
- Persistir referencias oficiales y disponibilidad.
- Evitar APIs externas durante render normal.
- Concurrencia acotada para APIs externas.
- Escrituras por lotes/transacciones.
- Snapshots para histórico del dashboard.
- Exclusiones filtradas lo más cerca posible de la consulta fuente.

Con decenas de miles de títulos/episodios, cualquier nueva feature debe evitar N+1 de red y recomputación global por navegación.

## 18. Consistencia y fuentes de verdad
- **Presencia física:** Plex (`plex_items.active`).
- **Identidad externa Plex:** `plex_external_ids`.
- **Universo editorial:** catálogo/read model.
- **Exclusión:** `catalog_exclusions`.
- **Referencia episodios:** `series_reference` + `series_reference_episodes`.
- **Disponibilidad ES:** `series_season_availability` + overrides.
- **Histórico operativo:** `pipeline_runs` y runs específicos.
- **Composición de saga:** colecciones/universos persistidos; cobertura derivada contra Plex.

No deben crearse segundas fuentes canónicas para resolver bugs locales.

## 19. Dependencias entre procesos
`Plex Sync → inventario/IDs → cobertura catálogo/sagas + invalidación identidad Series`

`Series Refresh → referencia TMDb + disponibilidad ES → estado efectivo + anomalías`

`Enrichment → identidad/metadatos → catálogo + sagas + calidad de identidad`

`Quality Refresh → datos Plex + catálogo → incidencias`

`Procesos relevantes → pipeline_runs → Admin + métricas Dashboard`

Esta dirección de dependencias es deliberada. Un consumidor puede reconstruir derivados, pero no debe redefinir la fuente que le alimenta.

## 20. Operación y diagnóstico
Ante un título mal asociado:
1. comprobar IDs Plex/catálogo;
2. corregir identidad en la fuente adecuada o manualmente;
3. sincronizar Plex si cambió Plex;
4. ejecutar el análisis derivado correspondiente;
5. verificar que el diagnóstico se recalcula;
6. revisar Admin si falla.

Ante un timeout, distinguir timeout de infraestructura/petición de error funcional. No repetir escrituras no idempotentes sin comprobar el estado. Los upserts y procesos V2 están diseñados para que reintentos sean seguros en los flujos principales.

## 21. Testing y regresión
`docs/V2_ACCEPTANCE_TESTS.md` contiene la batería funcional. La estabilización final añadió casos de regresión sobre:
- paginación/rendimiento Biblioteca;
- alta desde Plex;
- persistencia de IDs manuales;
- exclusiones fuera de Calidad;
- filtros Series;
- anomalías de sobrecobertura;
- reconciliación de identidad Castle;
- Dashboard y décadas.

Para cambios futuros en Plex/Series, Castle debe conservarse como caso de regresión conceptual: cambiar identidad en Plex no puede dejar una referencia oficial huérfana de la identidad anterior.

## 22. Deuda técnica conocida
La única incidencia menor abierta al cierre de esta baseline es #36, relativa al timeout de `Actualizar Series`. No invalida la estabilidad funcional de V2, pero debe resolverse antes de aumentar significativamente el volumen o la frecuencia del proceso.

## 23. Regla para evolución futura
Toda nueva funcionalidad debe declarar: fuente de verdad, datos derivados, política de invalidación, estrategia incremental, impacto en exclusiones, logging Admin, comportamiento ante reintentos, filtros/paginación y pruebas de regresión. Si una solución introduce una lógica paralela que intenta reparar datos derivados sin pasar por el propietario de la fuente, debe considerarse una violación arquitectónica.
