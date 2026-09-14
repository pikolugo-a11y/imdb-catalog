# PikoFilm V5 — Auditoría 03: Base de datos y modelo de datos

Estado: **FASE 1 COMPLETADA**  
Fecha: **2026-09-14**  
Rama: `audit/v5-03-database`  
Proyecto Neon auditado: `red-silence-53441102` (`pikofilm`)  
Base de datos: `neondb`  
Rama Neon de producción observada: `br-crimson-tooth-b2k4s1jw`

## 1. Objetivo y alcance

Esta auditoría revisa el sistema real de persistencia de PikoFilm antes de definir decisiones V5 para el Punto 3 — Base de datos y modelo de datos.

Se ha contrastado el repositorio vigente con Neon vivo, sin modificar datos ni esquema. El foco ha sido:

- topología real de tablas, vistas, claves e índices;
- datos canónicos frente a proyecciones/read models e históricos;
- tamaño, crecimiento, write amplification, dead tuples y bloat;
- retención y limpieza;
- coexistencia de modelos antiguos y canónicos;
- integridad referencial y orfandades observables;
- migraciones y riesgo de drift;
- escalabilidad de los modelos con más crecimiento potencial;
- patrones de lectura/escritura que condicionan el coste de Neon;
- relación con decisiones ya aprobadas en el Punto 2 — Rendimiento.

No se ha instalado ninguna extensión ni se ha ejecutado SQL destructivo. `pg_stat_statements` y las métricas LFC no estaban disponibles, por lo que la auditoría de histórico de queries se apoya en estadísticas nativas PostgreSQL, planes/código y estructura real.

---

## 2. Fuentes revisadas

### Repositorio

Entre otros, se han revisado:

- `AGENTS.md`
- `docs/AI_DEVELOPMENT_GUIDE.md`
- `docs/PROJECT_RULES.md`
- `docs/README.md`
- `docs/V4_ARCHITECTURE.md`
- `docs/V5_AUDIT_02_PERFORMANCE.md`
- `docs/V5_DECISIONS_02_PERFORMANCE.md`
- `docs/CURRENT_V5_HANDOFF.md`
- `.github/workflows/neon-branch-first-migrations.yml`
- `lib/db.js`
- `lib/database-storage.js`
- `lib/catalog-v4-queries.js`
- `lib/people-refresh-core.mjs`
- `lib/series-diagnostics-reconcile.mjs`
- `lib/series-quality-read-model-core.mjs`
- `lib/series-quality-query.js`
- `lib/series-detail-query.js`
- `lib/process-observability-retention.js`
- `lib/process-planning-retention.js`
- módulos Plex, Batch, planning, observabilidad y workers relacionados con persistencia.

### Neon vivo

Se han consultado, sólo en lectura:

- `pg_database_size`
- `pg_class`, `pg_namespace`
- `pg_stat_user_tables`
- `pg_stat_user_indexes`
- `pg_constraint`, `pg_index`
- `information_schema.columns`
- `pg_views`
- diagnósticos Neon de tamaños, vacuum, bloat, scans e índices.

---

## 3. Foto general de Neon

### 3.1 Tamaño total

En la medición final de esta auditoría:

- `pg_database_size(neondb)`: **869 MB**.
- relaciones ordinarias del esquema `public`: aproximadamente **858 MB** en total.
- heap/datos de esas relaciones: aproximadamente **619 MB**.
- índices: aproximadamente **236 MB**.

La diferencia restante corresponde a estructuras adicionales de PostgreSQL/Neon y otros objetos de la base.

La primera lectura parcial realizada durante la auditoría arrojó una magnitud menor porque no estaba midiendo el mismo agregado que `pg_database_size()`. Para capacidad y coste, la referencia canónica de esta auditoría es el tamaño total de base de **869 MB**.

### 3.2 Objetos

El esquema `public` contiene actualmente:

- **69 tablas ordinarias**;
- **7 vistas**;
- **4 secuencias**;
- **0 materialized views**.

Las vistas observadas son:

1. `catalog_read_model`
2. `plex_library`
3. `plex_quality_current`
4. `pikoquality_coverage`
5. `pikoquality_execution_status`
6. `series_episode_effective_status`
7. `series_plex_episode_sample`

Conclusión: varios objetos denominados conceptualmente “read model” siguen siendo vistas dinámicas o tablas mantenidas por lógica de aplicación; no existe un patrón único de proyección.

---

## 4. Distribución del almacenamiento

Las relaciones más grandes en la foto final son aproximadamente:

| Tabla | Filas aprox. | Tamaño total aprox. |
|---|---:|---:|
| `person_filmography` | 550k | 204 MB |
| `process_run_events` | 161k | 59 MB |
| `movie_credits` | 345k | 56 MB |
| `piko_quality` | 70k | 53 MB |
| `process_runs` | 39k | 52 MB |
| `title_ratings` | 146k | 47 MB |
| `plex_technical_state` | 65k | 45 MB |
| `plex_items` | 75k | 44 MB |
| `admin_events` | 64k | 41 MB |
| `plex_streams` | 154k | 26 MB |
| `series_diagnostics` | 62k | 24 MB |
| `series_reference_episodes` | 62k | 23 MB |
| `movie_metadata` | 21k | 21 MB |
| `people` | 145k | 20 MB |
| `movies` | 21k | 19 MB |
| `batch_run_items` | 32k | 15 MB |
| `plex_media` | 70k | 14 MB |
| `plex_files` | 70k | 14 MB |
| `catalog_candidates` | 29k | 14 MB |
| `identity_validation` | 21k | 14 MB |

La base no está dominada por una sola causa. Hay tres familias principales de consumo:

1. datos de catálogo/personas y ratings;
2. inventario/técnica Plex/PikoQuality;
3. observabilidad e históricos operativos.

Esto es importante: una política de almacenamiento V5 no puede limitarse a “limpiar logs”; también debe gobernar proyecciones y datos derivados pesados.

---

## 5. Canonicalidad: qué parece fuente de verdad y qué es derivado

### 5.1 Catálogo

`movies` es la entidad central de título por `imdb_id`. Sobre ella se apoyan, entre otras:

- `movie_metadata`
- `movie_countries`
- `movie_genres`
- `movie_genres_canonical`
- `movie_collections`
- `movie_credits`
- `title_ratings`
- `catalog_lifecycle`
- `plex_catalog_status`
- `identity_validation`

`catalog_read_model` es una **VIEW**, no una tabla materializada. Combina `movies`, estado Plex, adquisición y colección, y agrega géneros desde `movie_genres`.

Sin embargo, el frontend V4 de Catálogo filtra y compone géneros preferentemente desde `movie_genres_canonical` + `genres`, usando el array procedente de la vista como fallback. Esto significa que hoy conviven dos modelos de género en el mismo recorrido funcional.

### 5.2 Personas

- `people` representa la persona canónica identificada por TMDb.
- `movie_credits` modela relaciones entre títulos PikoFilm y personas.
- `person_filmography` es una proyección/enriquecimiento mucho más amplio por persona y contiene metadatos de las obras externas además de la relación persona↔obra.
- `person_refresh_state` gobierna refresco/progreso de la proyección.

`person_filmography` no debe tratarse como fuente de verdad primaria: puede regenerarse desde TMDb y el código actual la reemplaza por persona.

### 5.3 Plex

La persistencia Plex está normalizada en varias capas:

- `plex_items`
- `plex_external_ids`
- `plex_media`
- `plex_files`
- `plex_streams`
- `plex_technical_state`
- `plex_catalog_status`

La vista `plex_library` ensambla estas capas para lectura.

La frontera de producto permanece: los campos de visionado que Plex pueda exponer son datos externos de Plex y no convierten a PikoFilm en propietario del historial personal.

### 5.4 Series

El dominio está distribuido entre:

- referencia oficial: `series_reference`, `series_reference_episodes`;
- disponibilidad: `series_season_availability`, `series_episode_availability`;
- diagnóstico físico: `series_diagnostics`;
- decisiones manuales: `series_episode_overrides`;
- proyección agregada: `series_quality_read_model`;
- vistas derivadas como `series_episode_effective_status`.

Este modelo tiene una separación conceptual correcta entre verdad física, referencia oficial, disponibilidad y decisión manual. No obstante, su mantenimiento genera mucha escritura derivada y parte de su integridad se gobierna en aplicación en vez de constraints.

### 5.5 Operaciones

`process_runs`, `process_run_events`, `process_run_errors`, planning y tablas Batch constituyen estado operativo e histórico. Parte es estado vivo; parte es evidencia histórica prescindible después de una ventana definida.

V5 debe distinguir explícitamente ambas categorías.

---

## 6. Hallazgo DB-F01 — `person_filmography` es el principal riesgo de crecimiento estructural

### Evidencia viva

- `people`: **144.866** personas.
- personas con filmografía enriquecida: **9.563**.
- `person_filmography`: **549.892** filas.
- media declarada en `person_refresh_state`: **57,50 créditos por persona enriquecida**.
- máximo observado: **1.126 créditos** en una persona.
- tamaño actual de la relación: aproximadamente **204 MB**.
- filas relevantes para PikoFilm: **423.321**.
- filas explícitamente no relevantes: **126.349**.
- filas sin clasificación de relevancia: **222**.

Sólo alrededor del **6,6 %** de las personas de `people` tiene hoy filmografía enriquecida.

Si se enriqueciese todo el universo manteniendo la densidad media actual, el orden de magnitud sería aproximadamente **8,3 millones de filas**, unas **15 veces** el volumen actual. A densidad física similar, la proyección podría situarse alrededor de varios GB; no debe tomarse como forecast exacto, pero sí como señal clara de que el esquema actual no escala linealmente de forma cómoda.

### Causa de modelo

`person_filmography` mezcla en una misma fila:

- la relación persona↔obra;
- identidad/título/año/tipo de la obra;
- popularidad y votos;
- poster;
- géneros JSON;
- tipo de crédito/personaje/trabajo;
- flags de relevancia;
- timestamps.

El mismo título externo puede repetir buena parte de sus metadatos para muchas personas.

Además, `people-refresh-core` refresca una persona reemplazando su filmografía: elimina las filas anteriores de esa persona y vuelve a insertar el conjunto normalizado.

### Riesgo

El crecimiento de Personas puede convertirse en el principal consumidor de Neon antes de que el catálogo principal crezca significativamente.

### Oportunidad V5

Revisar el modelo antes de enriquecer masivamente más personas: separar relación persona↔obra de metadatos compartidos, limitar almacenamiento a señales necesarias, conservar sólo filmografía relevante cuando corresponda o introducir otra estrategia derivada y regenerable.

No se propone todavía una solución concreta: se decidirá en Fase 2.

---

## 7. Hallazgo DB-F02 — write amplification extrema en proyecciones de Series

### `series_diagnostics`

Estadísticas acumuladas observadas:

- ~61.900 filas vivas;
- **1.381.837 inserts**;
- **1.319.935 deletes**;
- prácticamente sin updates.

El volumen histórico de escritura es más de veinte veces el estado vivo. El reconcile actual recalcula por serie y persiste de forma que la evidencia derivada se reemplaza repetidamente.

### `series_quality_read_model`

Estadísticas acumuladas observadas:

- **971** filas vivas;
- **761.476 updates**;
- ~972 inserts.

Es decir, cientos de actualizaciones por fila para una proyección de menos de mil entidades.

`rebuildSeriesQualityReadModel()` realiza `INSERT ... ON CONFLICT DO UPDATE` sobre la proyección y actualiza incluso cuando el resultado funcional no ha cambiado, incluyendo `updated_at`.

### Relación con PERF-08

El Punto 2 ya aprobó como principio que una proyección idempotente **sólo debe escribir cuando cambia su resultado**. La auditoría de BBDD confirma que no es una optimización menor: es un problema visible en las estadísticas físicas.

### Riesgos

- WAL y escrituras innecesarias;
- autovacuum y bloat evitables;
- invalidaciones/caches falsas por `updated_at` cambiante;
- más coste al crecer Series;
- menor claridad semántica entre “recalculado” y “realmente cambió”.

---

## 8. Hallazgo DB-F03 — alto churn también en Plex y estado operativo

Estadísticas observadas:

- `plex_items`: ~75k filas y **~401k updates**;
- `plex_technical_state`: ~65k filas y **~575k updates**;
- `process_runs`: ~39k filas y **~655k updates**.

Parte de estos updates son naturales porque representan estado vivo. El problema no es que existan, sino que el modelo V5 debe separar:

- cambios funcionales reales;
- heartbeats/progreso/timestamps;
- proyecciones derivadas;
- histórico que no necesita reescribir la misma fila.

El punto de BBDD debe exigir semántica de escritura clara para evitar que un simple “seguimos vivos” tenga el mismo coste de persistencia que un cambio funcional.

---

## 9. Hallazgo DB-F04 — el bloat existe, pero no es la causa principal del tamaño

La inspección final de bloat muestra desperdicio estimado relevante, entre otros:

- `plex_items`: ~12 MB de waste estimado, ratio ~1,6;
- `plex_technical_state`: ~9,4 MB, ratio ~1,6;
- `series_diagnostics`: ~4,1 MB, ratio ~1,3;
- `series_reference_episodes`: ~2,9 MB;
- `catalog_candidates`: ~2,3 MB;
- `movie_metadata`: ~2,2 MB;
- `plex_media`: ~2,1 MB;
- `movies`: ~2,0 MB;
- `series_quality_read_model`: ratio alto (~6,7) pero sólo ~1,1 MB absolutos.

Conclusión importante: **VACUUM no resolverá el problema de capacidad por sí solo**. El tamaño dominante corresponde a datos e índices legítimamente persistidos. El remedio principal debe ser de modelo, retención y write amplification; mantenimiento físico es complementario.

---

## 10. Hallazgo DB-F05 — observabilidad e históricos ya son una parte grande de la base

### Estado actual

- `process_run_events`: ~161k filas, ~59 MB.
- `process_runs`: ~39k filas, ~52 MB.
- `admin_events`: ~64k filas, ~41 MB.
- `process_run_errors`: pequeño comparativamente, ~0,5 MB.

Sólo esas tres primeras relaciones ya representan del orden de **150 MB**.

### Composición de `process_run_events`

Los eventos más frecuentes son:

- ~48k `step_completed`;
- ~39k `run_started`;
- ~39k `run_finished`;
- ~33k `step_started`.

Los eventos funcionales/manuales/error son minoritarios frente a la telemetría mecánica de ejecución.

### Composición de `admin_events`

Destacan:

- ~23k `movie_file_validation`;
- ~21,5k `pikoscore`;
- ~7,8k `data_quality`;
- ~6,1k `identity_validation`.

Los eventos `pikoscore` pesan de media alrededor de **1,1 KB por fila**, sensiblemente más que otros tipos.

### Interpretación

PikoFilm persiste detalle por elemento en varias capas. Esto da trazabilidad, pero si no existe una política común de ciclo de vida, la observabilidad puede convertirse en almacenamiento histórico indefinido.

---

## 11. Hallazgo DB-F06 — la retención de 30 días existe, pero no es un contrato global

Existe código explícito para:

- `process_runs` terminales mayores de 30 días, con cascada a sus eventos/errores/métricas/steps y salvaguardas por referencias;
- `process_plans` antiguos/terminales.

La lógica está integrada en ciclos reales de Actividad/Operaciones.

Sin embargo, no se ha encontrado un contrato único equivalente para toda tabla histórica/operativa. En particular, `admin_events` no presenta una purga equivalente en el código revisado. Otras tablas de runs/snapshots tienen ciclos propios o no están gobernadas por una política central.

En la fecha de la auditoría los grandes históricos todavía son jóvenes —los principales comienzan a finales de agosto de 2026—, por lo que aún no existe una gran masa >30 días. Eso no elimina el riesgo: simplemente significa que PikoFilm todavía no ha alcanzado una edad suficiente para mostrarlo.

### Riesgo

La regla funcional acordada de no conservar historia operativa innecesaria durante más de 30 días puede cumplirse sólo parcialmente si depende de cada módulo.

### Necesidad V5

Definir por tabla una clase de retención:

- estado actual: sin expiración automática;
- histórico operativo corto: 30 días;
- auditoría funcional/manual: retención más larga o permanente si está justificada;
- caché/proyección reconstruible: política por frescura/reconstrucción;
- snapshots de diagnóstico: política explícita.

No debe existir “retención por accidente”.

---

## 12. Hallazgo DB-F07 — coexistencia de dos modelos de géneros en producción

Existen simultáneamente:

- `movie_genres` — modelo legacy textual;
- `movie_genres_canonical` + `genres` — modelo normalizado/canónico.

Volumen observado:

- `movie_genres`: ~50,3k relaciones;
- `movie_genres_canonical`: ~52,0k relaciones.

Comparando por `imdb_id` + nombre de género normalizado:

- ~32,3k relaciones coinciden;
- ~18,0k están sólo en el modelo legacy;
- ~19,7k están sólo en el canónico.

No son copias idénticas.

Además:

- `catalog_read_model` agrega sus `genres` desde `movie_genres`;
- `catalog-v4-queries.js` filtra y devuelve preferentemente `movie_genres_canonical`, usando la lista de la vista como fallback.

### Riesgo

Una misma película puede producir resultados distintos según qué consumidor use una u otra representación. También se paga almacenamiento y mantenimiento doble.

### Conclusión

No se debe borrar `movie_genres` sin migrar consumidores y reconciliar diferencias. Pero V5 necesita decidir una autoridad única y una estrategia de retirada de la otra representación.

---

## 13. Hallazgo DB-F08 — la integridad referencial ha mejorado, pero sigue siendo desigual por dominio

### Fortalezas

Todas las tablas ordinarias de `public` observadas tienen clave primaria.

Existen FKs útiles en múltiples dominios, por ejemplo:

- metadata/créditos/géneros/ratings → `movies`;
- créditos → `people`;
- Plex media/external IDs/technical state → `plex_items`;
- Plex files → `plex_media`;
- planning/batch → runs;
- disponibilidad de Series → referencias;
- sagas → colecciones/universos.

En las relaciones nucleares auditadas no se encontraron huérfanos reales en:

- `movie_metadata` respecto a `movies`;
- `person_filmography` respecto a `people`;
- `plex_media` respecto a `plex_items`;
- `plex_technical_state` respecto a `plex_items`;
- `plex_catalog_status` respecto a `movies`;
- episodios de referencia respecto a cabeceras de serie;
- diagnósticos respecto a referencia oficial;
- `series_quality_read_model` respecto a shows Plex.

### Series: constraints selectivos

`series_reference_episodes`, `series_diagnostics`, `series_episode_overrides` y `series_quality_read_model` no están enlazados todos entre sí mediante FKs, aunque funcionalmente se relacionan por `show_rating_key` y número T/E.

No debe añadirse FKs de forma mecánica: algunas decisiones manuales representan deliberadamente elementos Plex no presentes en la referencia oficial.

Prueba: en `series_episode_overrides` hay decisiones `special`, `not_needed` y `manual_present` sin episodio oficial asociado, y eso es correcto por diseño. En cambio las nuevas exclusiones `unavailable` sí tienen referencia oficial: 2/2 observadas.

### Conclusión

La integridad debe reforzarse **según semántica**, no por obsesión de normalización. Donde una relación es obligatoria, DB debería ayudar a protegerla. Donde el dominio admite excepciones, la constraint podría ser incorrecta.

---

## 14. Hallazgo DB-F09 — dos FKs carecen de índice de apoyo directo

La auditoría de FKs detectó dos constraints cuyo lado hijo no tiene un índice que cubra directamente sus columnas:

- `batch_run_items.child_run_id -> process_runs.run_id`;
- `process_plans.dispatch_run_id -> process_runs.run_id`.

También `country_aliases.country_code` aparece sin índice dedicado, aunque su tabla es diminuta y un índice adicional probablemente no aportaría valor.

No se propone crear índices automáticamente: primero debe comprobarse frecuencia de deletes/updates del padre y consultas reales. Pero sí deben entrar en una revisión dirigida de índices V5.

---

## 15. Hallazgo DB-F10 — existen índices grandes con cero scans registrados

Índices no únicos >1 MB con `idx_scan=0` en la estadística observada:

- `idx_plex_technical_state_technical_fingerprint`: ~12 MB;
- `process_run_events_type_time_idx`: ~11 MB;
- `process_runs_correlation_key_idx`: ~2,5 MB;
- `plex_items_updated_idx`: ~2,2 MB;
- `plex_items_active_idx`: ~1,1 MB.

La auditoría estricta no encontró pares de índices exactamente duplicados en definición.

### Cautela

`idx_scan=0` no es autorización para borrar. Puede tratarse de:

- rutas raras/manuales;
- índices nuevos;
- índices usados para constraints/plans no capturados de forma obvia;
- estadísticas cuyo horizonte no coincide con el ciclo funcional completo.

Por tanto, V5 necesita gobernanza de índices basada en **estadística + búsqueda de consumidores + EXPLAIN**, no limpieza automática.

---

## 16. Hallazgo DB-F11 — hay tablas vacías que pueden ser contrato futuro o restos de funcionalidad

Actualmente están vacías, entre otras:

- `acquisition_priority_snapshots`
- `acquisition_status`
- `batch_api_source_leases`
- `plex_review_tasks`
- `saga_universes`
- `saga_universe_collections`
- `saga_universe_titles`
- `series_episode_availability`

Otras que parecían vacías por estadísticas sí contienen datos, por ejemplo `movie_quality_actions` y `batch_engine_control`.

### Conclusión

Una tabla vacía no equivale a tabla obsoleta. Antes de retirar cualquiera hay que clasificarla como:

- contrato activo pero todavía sin filas;
- infraestructura reservada para una función aprobada;
- legacy realmente abandonado.

El Punto 10 — Legacy profundizará después, pero Base de datos debe establecer el inventario y la regla de ownership.

---

## 17. Hallazgo DB-F12 — `catalog_read_model` no es todavía un read model materializado

`catalog_read_model` es una `VIEW` normal que expande joins/subqueries cada vez que se consulta.

El Punto 2 ya aprobó `PERF-05`: evolucionar Catálogo hacia una proyección materializada/regenerable. Desde el punto de vista de modelo de datos, esto obliga a definir:

- qué columnas son canónicas y cuáles derivadas;
- quién actualiza la proyección;
- qué mutaciones la invalidan;
- cómo se reconstruye;
- qué constraints necesita;
- cómo se evita doble autoridad entre `movies` y la proyección.

La implementación futura no debe limitarse a “crear una tabla más”. Debe existir un contrato explícito de proyección.

---

## 18. Hallazgo DB-F13 — migraciones branch-first sólidas, pero sin ledger canónico en la base

### Lo positivo

El workflow `.github/workflows/neon-branch-first-migrations.yml` protege cambios de `db/migrations/*.sql`:

1. detecta migraciones nuevas/modificadas por diff Git;
2. crea una rama Neon efímera;
3. aplica las migraciones;
4. ejecuta smoke test asociado si existe;
5. verifica PostgreSQL;
6. tras merge/push a `main`, aplica a producción;
7. elimina la rama efímera.

Este mecanismo ha demostrado funcionar en cambios recientes, incluida la migración de exclusiones de episodios de Series.

### Hueco observado

No existe en `public` una tabla tipo `schema_migrations`/ledger que registre de forma canónica qué migraciones fueron aplicadas a esa base.

La producción depende de:

- historial Git;
- eventos del workflow;
- idempotencia/calidad de los SQL;
- que no haya cambios fuera del mecanismo canónico.

### Segundo directorio

El workflow sólo observa `db/migrations/*.sql`.

El repositorio conserva además un directorio top-level `migrations/` con migraciones históricas de PikoQuality de agosto de 2026. Ese directorio no participa en el gate actual.

### Riesgo

Un operador futuro puede interpretar ambos directorios como equivalentes o no poder responder desde la propia DB a “¿qué versión de esquema tengo?”.

V5 debe unificar el contrato de migración y añadir detección de drift/estado aplicado sin romper el workflow branch-first vigente.

---

## 19. Hallazgo DB-F14 — no hay materialized views; la estrategia derivada está fragmentada

Hoy PikoFilm usa tres patrones distintos:

1. `VIEW` dinámica, como `catalog_read_model` y `series_episode_effective_status`;
2. tabla read model mantenida por código, como `series_quality_read_model`;
3. cachés/tablas enriquecidas reconstruibles, como `person_filmography` o `tmdb_movie_cache`.

Ningún patrón es incorrecto por sí mismo, pero falta una taxonomía común que responda para cada objeto:

- fuente canónica;
- frescura esperada;
- estrategia de actualización;
- reconstrucción;
- retención;
- ownership;
- si puede borrarse y regenerarse;
- cómo se detecta deriva.

Esa falta de contrato facilita que una proyección termine tratándose como dato canónico o que varias proyecciones dupliquen la misma información.

---

## 20. Hallazgo DB-F15 — la base conserva bastante payload derivado por elemento

Dos ejemplos:

### `piko_quality`

- ~70k filas;
- ~53 MB;
- `components` JSONB medio ~458 bytes, máximo ~508 bytes.

### `title_ratings`

- ~146k filas;
- ~47 MB;
- conserva rating normalizado y además `raw_payload` JSONB;
- payload medio observado ~115 bytes.

No son tamaños absurdos aisladamente. El problema es acumulativo: PikoFilm guarda resultado procesado + evidencia + raw payload en varias familias.

V5 debe distinguir cuándo el raw payload es necesario para reproducibilidad/auditoría y cuándo puede expirar o quedar en una capa de caché con retención propia.

---

## 21. Hallazgo DB-F16 — el esquema real es más robusto de lo que sugería parte de la documentación antigua

Durante la auditoría se comprobó que el esquema vivo ya contiene más FKs y constraints de los que algunas descripciones históricas hacían pensar.

Ejemplos:

- `plex_media.rating_key -> plex_items.rating_key` con cascade;
- `plex_technical_state.rating_key -> plex_items.rating_key`;
- `movie_genres_canonical` ligado a `movies` y `genres`;
- `series_episode_availability` ligado a la referencia oficial;
- múltiples tablas de catálogo ligadas a `movies`.

Por tanto, las decisiones V5 deben partir del catálogo real de constraints y no de supuestos heredados.

---

## 22. Hallazgo DB-F17 — no se observan corrupciones masivas ni huérfanos en los dominios nucleares

Las comprobaciones dirigidas no detectaron huérfanos en las relaciones principales auditadas.

La única cifra inicialmente llamativa fueron **72 overrides de Series sin episodio oficial**, pero al clasificarlos resultaron ser:

- 48 `not_needed`;
- 22 `special`;
- 2 `manual_present`;
- 0 `unavailable` sin referencia.

Esto coincide con el contrato funcional: extras/especiales/combinados pueden representar elementos Plex fuera de la referencia oficial. Las exclusiones `unavailable`, en cambio, se aplican sólo a episodios oficiales.

Conclusión: no hay evidencia para justificar una “limpieza de huérfanos” agresiva. Cualquier saneamiento debe entender antes la semántica.

---

## 23. Hallazgo DB-F18 — el modelo de géneros demuestra el riesgo de transición incompleta

La coexistencia de `movie_genres` y `movie_genres_canonical` es un ejemplo útil de un problema más general:

1. se introduce un modelo nuevo más correcto;
2. algunos consumidores migran;
3. otros siguen leyendo el modelo anterior;
4. ambos empiezan a divergir;
5. retirar el antiguo se vuelve más difícil.

V5 debe exigir una regla de migración de modelo:

- declarar fuente futura;
- backfill/reconciliar;
- migrar todos los consumidores;
- medir paridad;
- retirar writes antiguos;
- retirar reads antiguos;
- sólo entonces eliminar almacenamiento legacy.

---

## 24. Hallazgo DB-F19 — crecimiento futuro: catálogo y personas tienen perfiles muy distintos

El catálogo principal tiene actualmente ~21k títulos. Personas tiene ~145k entidades y una proyección potencialmente muchas-a-muchas muy grande.

Esto significa que un crecimiento 10x del catálogo no es el único escenario relevante. El sistema puede multiplicar almacenamiento sin añadir nuevas películas simplemente por enriquecer más profundamente entidades ya conocidas.

El diseño V5 debe presupuestar por **cardinalidad de relaciones**, no sólo por número de películas.

---

## 25. Hallazgo DB-F20 — observabilidad SQL incompleta para gobernar crecimiento/query cost a largo plazo

`pg_stat_statements` no está instalado y las métricas de Local File Cache requeridas por el inspector tampoco están disponibles.

No se ha modificado Neon para habilitarlas durante esta auditoría.

Consecuencia: hoy puede auditarse muy bien el estado físico y estadísticas por tabla/índice, pero no existe desde PostgreSQL una serie histórica rica y persistente de consultas más costosas/frecuentes.

Esto pertenece parcialmente al Punto 5 — Observabilidad, pero afecta al gobierno de BBDD: V5 debería poder detectar regresiones de consultas y crecimiento antes de que el usuario las perciba.

---

## 26. Clasificación de objetos para V5

La auditoría propone que toda tabla/vista se adscriba a una de estas categorías, sin cambiar todavía el esquema:

### A. Canónico

Dato que representa la autoridad funcional de PikoFilm y no puede eliminarse/reconstruirse sin perder verdad.

Ejemplos aproximados: `movies`, decisiones manuales válidas, configuración, estados editoriales.

### B. Integración externa actual

Estado sincronizado de un sistema externo que puede reconstruirse consultando la fuente, pero cuya pérdida temporal afectaría funcionamiento.

Ejemplos: inventario Plex, IDs externos.

### C. Proyección/read model

Derivado regenerable para servir lecturas rápidas.

Ejemplos: `series_quality_read_model`; futuro catálogo materializado.

### D. Caché/enriquecimiento regenerable

Dato costoso de volver a pedir pero no fuente de verdad.

Ejemplos: `tmdb_movie_cache`, partes de filmografía externa.

### E. Histórico operativo con TTL

Runs, eventos y snapshots cuyo valor cae con el tiempo.

### F. Auditoría funcional/manual

Decisiones humanas o hechos que justifican por qué cambió el sistema y pueden necesitar retención más larga.

### G. Legacy/transición

Modelo todavía existente por compatibilidad que debe tener plan explícito de retirada.

Esta taxonomía permitiría fijar retención, backups, constraints y estrategias de reconstrucción de forma coherente.

---

## 27. Riesgos priorizados

### Prioridad crítica

**R1 — Crecimiento sin contrato global de retención.**  
La observabilidad ya consume una fracción relevante de una base joven y `admin_events` no está cubierto por el mismo contrato de 30 días que `process_runs`.

**R2 — `person_filmography` no escala cómodamente al universo completo.**  
Es ya la tabla más grande con sólo ~6,6 % de personas enriquecidas.

### Prioridad alta

**R3 — Write amplification de proyecciones.**  
`series_quality_read_model`, `series_diagnostics` y varios estados vivos acumulan muchas más escrituras que cambios funcionales.

**R4 — Modelos paralelos que divergen.**  
`movie_genres` y `movie_genres_canonical` ya producen universos distintos y tienen consumidores diferentes.

**R5 — Ausencia de ledger de migraciones/drift.**  
El workflow es bueno, pero la DB no puede demostrar por sí sola su versión de esquema.

### Prioridad media

**R6 — Índices costosos sin uso observado.**  
Hay al menos ~29 MB en cinco índices >1 MB con cero scans registrados, pero requieren validación antes de cualquier drop.

**R7 — tablas vacías sin clasificación formal.**  
Pueden ser contrato futuro o legacy; hoy no existe un inventario de ownership fácilmente verificable.

**R8 — raw/evidence payload persistido sin política homogénea.**

### Prioridad baja / seguimiento

**R9 — FKs sin índice de apoyo en relaciones concretas.**  
Sólo merece intervención si el patrón de consulta/delete lo justifica.

**R10 — bloat físico.**  
Existe, pero hoy no es el factor principal del tamaño total.

---

## 28. Lo que NO se debe hacer como reacción a esta auditoría

- No borrar tablas vacías sólo porque estén vacías.
- No borrar índices sólo porque `idx_scan=0`.
- No añadir FKs de forma indiscriminada a excepciones funcionales de Series.
- No ejecutar `VACUUM FULL` como sustituto de corregir el modelo.
- No purgar decisiones manuales para ahorrar espacio.
- No reducir retención de evidencia funcional irreversible sin decidir qué necesita auditoría.
- No convertir proyecciones derivadas en segunda fuente de verdad.
- No hacer cambios directos en producción fuera del workflow de migraciones.

---

## 29. Líneas de decisión para Fase 2

La auditoría justifica al menos las siguientes familias de propuestas V5, que deberán presentarse y decidirse **una a una**:

1. contrato único de retención y clasificación de datos históricos;
2. rediseño escalable de `person_filmography`;
3. escritura idempotente de read models/derivados;
4. reconcile diferencial de diagnósticos de Series;
5. autoridad única y retirada progresiva del modelo legacy de géneros;
6. ledger de migraciones + detección de drift;
7. catálogo formal de ownership/canonicalidad/reconstrucción por tabla;
8. revisión dirigida de índices con evidencia real;
9. política de payload raw/evidencia;
10. guardrails de almacenamiento y crecimiento por dominio;
11. constraints/FKs selectivas donde la semántica sea obligatoria;
12. consolidación de tablas vacías/legacy sólo tras demostrar ausencia de consumidores.

La lista anterior **no es todavía una decisión**. Fase 2 debe convertirla en propuestas concretas `DB-xx` y revisarlas individualmente con el usuario.

---

## 30. Conclusión de la Fase 1

La BBDD de PikoFilm no está en una situación de corrupción general ni de mala integridad básica. El problema principal es de **gobierno del crecimiento y del dato derivado**.

La base ya es lo bastante grande —869 MB en la foto final— para que decisiones aparentemente pequeñas de modelado tengan efecto material. La mayor oportunidad no es “optimizar PostgreSQL” en abstracto, sino decidir con precisión:

- qué merece persistirse;
- durante cuánto tiempo;
- qué es canónico y qué es reconstruible;
- cuándo una proyección debe escribir;
- qué modelos en transición deben desaparecer;
- cómo demostrar qué versión de esquema está realmente desplegada.

La Fase 1 del Punto 3 queda **COMPLETADA**. El siguiente paso es Fase 2 — Propuestas V5, comenzando por `DB-01` y persistiendo cada decisión antes de presentar la siguiente.