# PikoFilm — Novedades V1 · Especificación técnica

## Componentes
- `app/novedades/page.js`: read model y UI de propuestas.
- `app/novedades/criterios/page.js`: edición de reglas.
- `app/novedades/actions.js`: acciones servidor de cola, alta manual, exclusión y enriquecimiento.
- `lib/news-v1.js`: configuración, consultas y estadísticas.
- `worker/imdb-discovery.mjs`: discovery batch IMDb.
- `.github/workflows/imdb-discovery.yml`: scheduler y consumidor de cola.
- `worker/update-imdb-ratings.mjs`: worker de ratings trasladado a mainline.

## Persistencia reutilizada
No se introduce una nueva fuente canónica de candidatos. Se reutilizan:
- `catalog_candidates`: staging de discovery.
- `catalog_exclusions`: exclusión global reversible.
- `movies`: catálogo editorial definitivo.
- `app_settings`: configuración versionada de reglas.
- `admin_job_requests`: cola de solicitudes largas.
- `pipeline_runs`: trazabilidad operativa.

## Configuración
La clave `app_settings.key='imdb_discovery_v1'` contiene perfiles `movie.general`, `movie.spain`, `series.general`, `series.spain`, lista `excludedCountries`, versión y flags operativos. Si no existe fila se aplican defaults en código; guardar desde UI materializa la configuración en Neon.

## Discovery
### Fase 1 — ratings
`title.ratings.tsv.gz` se consume con `Readable.fromWeb(...).pipe(createGunzip())`. Solo se guardan en memoria IDs que superan el mínimo absoluto necesario para alguna regla activa.

### Fase 2 — basics
`title.basics.tsv.gz` se consume también por streaming. Se descartan tipos distintos de `movie`, `tvSeries` y `tvMiniSeries`, contenido adulto cuando la regla está activa, títulos ya catalogados/excluidos y filas que no cumplen ni regla general ni zona de rescate España.

### Resolución de país
Los países se reutilizan desde `source_snapshot.countries` si ya existen. Para candidatos sin caché se intenta Wikidata en lotes mediante IMDb ID/P345 y país de origen/P495. Los no resueltos usan TMDb como fallback con concurrencia acotada. Si el país sigue sin resolverse, el candidato no se expone como elegible: se prioriza no dejar escapar países globalmente excluidos.

`Q668` y `IN` representan la exclusión inicial de India. `Q29` y `ES` identifican España en las fuentes empleadas.

## Upserts
Los candidatos se escriben en lotes mediante `jsonb_to_recordset`. `source_snapshot` conserva título, título original, regla que hizo match, versión de discovery, versión de reglas, países y estado de resolución. Los candidatos manuales activos tienen precedencia y no son pisados por el worker automático.

Al final del run, candidatos automáticos V1 que antes eran elegibles pero no han sido vistos en la ejecución actual pasan a `not_eligible`; no se borran.

## Cola y scheduling
La acción web inserta un `admin_job_requests` pendiente. El workflow de GitHub Actions ejecuta un consumidor cada cinco minutos y una ejecución completa diaria. El worker reclama una sola petición con `FOR UPDATE SKIP LOCKED`, la marca `running` y termina en `success`/`failed`.

La petición web nunca espera a descargar/recorrer IMDb.

## Enriquecimiento desde Novedades
`enrichTitle()` no se duplica. El adaptador de Novedades crea una fila staging mínima en `movies` para satisfacer el contrato actual del enriquecedor, ejecuta el pipeline existente y elimina el flag `staging` al completar. Si falla, elimina exclusivamente la fila staging y conserva el candidato.

`inclusion_origin` diferencia `imdb_discovery` e `imdb_manual`.

## Exclusión y restauración
Novedades escribe directamente en `catalog_exclusions`. La consulta de Novedades hace anti-join con esa tabla y con `movies`. Restaurar la exclusión deja que reaparezca el candidato si su estado sigue siendo elegible; no hay tabla de exclusiones paralela.

## Observabilidad
`pipeline_runs` registra `job_type='imdb_discovery'`, fuente (`queue` o `schedule`), duración y contadores. El summary incluye escaneos, preselección, potenciales, elegibles generales, rescates España, descartes de país, pendientes de país y filas actualizadas.

## Rendimiento
- streaming gzip;
- prefiltrado ratings antes de basics;
- Sets/Maps en memoria solo para subconjuntos relevantes;
- anti-join conceptual contra Catálogo/Excluidas antes de resolver país;
- Wikidata batch;
- TMDb con concurrencia limitada;
- upserts de 500 filas;
- navegación Novedades paginada en servidor (48 filas);
- cero APIs externas durante el render.

## Robustez Series (#36)
`app/calidad/series/page.js` declara `maxDuration=60`, dando margen respecto al tiempo observado cercano a 28–30 s. `lib/series-v2.js` registra tiempos de selección, refresco TMDb, cálculo de anomalías y total para poder optimizar con evidencia si el volumen aumenta. Las referencias siguen limitadas a shows Plex activos, preservando el arreglo de #37.

## CI
CI valida sintaxis de ambos workers con `node --check` y ejecuta `next build`. Los workflows IMDb dejan de depender de `issue-14-worker` y pasan a mainline tras el merge.
