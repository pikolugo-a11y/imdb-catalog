# PikoFilm — Bitácora y estado operativo

> Documento vivo. La especificación funcional/técnica canónica describe el sistema; esta bitácora solo fija el punto actual.

## Estado registrado

**Fecha:** 23/08/2026 (Europe/Madrid)  
**Fase:** arquitectura Lifecycle consolidada; migración M01–M27 completada  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama productiva preparada:** `main`

## Reglas operativas innegociables

- Deployments Vercel: siempre manuales por el usuario.
- Los cambios se preparan en rama, pasan CI y se mergean a `main`.
- Pruebas funcionales/visuales: las realiza el usuario sobre el deployment que decida.
- Procesamiento normal de títulos: unitario, una película/serie cada vez y con feedback.
- Catálogo es la vista maestra; Plex representa presencia física; Novedades es la entrada única.
- Excluidas quedan fuera del Lifecycle hasta restauración.
- No se implementa control de reproducciones/visto; Plex cubre ese ámbito.
- Eficiencia de infraestructura: PostgreSQL filtra/agrega cerca del dato y Vercel recibe solo lo necesario.

## Arquitectura funcional vigente

### Entrada
`Discovery / Plex / Manual → Novedades → Añadir → Catálogo`

### Núcleo común
`IDENTITY_PENDING → IDENTITY_VALIDATION / REVIEW → DATA_INCOMPLETE → PIKOSCORE_PENDING`

### Sin archivo Plex
`PIKOSCORE_PENDING resuelto → COMPLETE`

### Película con archivo Plex
`PikoScore → MOVIE_FILE_PENDING → MOVIE_FILE_REVIEW si procede → TECH_PENDING → COMPLETE`

### Serie con Plex
`PikoScore → SERIES_SYNC_PENDING → SERIES_REVIEW si procede → TECH_PENDING → COMPLETE`

## Hitos cerrados / implementados

1. Lifecycle materializado en `catalog_lifecycle`.
2. Catálogo muestra la fase de cada título y es la base de consulta única.
3. Novedades unifica Discovery, Plex y Manual.
4. `/plex` queda solo como redirect temporal a Novedades origen Plex.
5. Identidad y Validación de identidad son unitarias.
6. Identidad ya no usa GitHub Actions/polling; FA usa el resolver Python productivo.
7. Datos separa actualización, ratings y PikoScore.
8. PikoScore 2.0 implantado.
9. Validación de archivo de película se vincula al fingerprint actual.
10. PikoQuality y Series operan unitariamente.
11. `/calidad` es mapa de colas Lifecycle y no lanza acciones masivas.
12. Retirados runners/batches PikoQuality y validación de películas antiguos.
13. Dashboard enlaza Plex pendiente directamente a Novedades.
14. Eliminados pilotos y CSS/rutas Plex huérfanas.
15. Documentación histórica activa retirada y `CANONICAL_DATA.md` consolidado.
16. `PROJECT_RULES.md` incorpora propósito, merge siempre/deployment nunca y eficiencia/coste.
17. `INFRASTRUCTURE_EFFICIENCY.md` fija la política técnica Neon/Vercel.
18. **M16–M21:** retirados workflows de identidad, validación, series, prueba de enriquecimiento y candidato manual.
19. **M22:** se conserva `imdb-ratings-refresh.yml` como mantenimiento offline manual del dataset IMDb.
20. **M23:** CI es el único workflow automático; Discovery, ratings y mantenimiento son únicamente `workflow_dispatch`.
21. **M24–M26:** eliminadas APIs batch/probes antiguas de identidad y validación.
22. **M27:** `worker/` queda reducido a `imdb-discovery.mjs` y `update-imdb-ratings.mjs`, las dos fuentes offline reales que siguen vigentes.
23. `api/fa-search.py` y `api/fa-evidence.py` se conservan como endpoints Python unitarios productivos, no como workers batch.

## Flujo de regresión probado previamente

### `tt6720618`
`Plex/Novedades → Identidad → Validación → Datos → PikoScore → Validación película → PikoQuality → Complete`.

### `tt21187592`
`Novedades → Identidad → Validación → Datos → PikoScore → Complete`.

FilmAffinity en Identidad queda aceptado de momento tras recuperar una tasa de acierto razonable con el resolver Python probado; no bloquea la migración.

## Deuda conocida importante

- **Siguiente bloque:** M28–M35, cerrar Lifecycle como arquitectura 100% materializada/event-driven y limpiar estados/datos heredados.
- Retención, índices, payloads y almacenamiento Neon siguen en M36–M42.
- CSS/componentes heredados siguen en M43–M45.
- El redirect `/plex` se conserva temporalmente por compatibilidad.

La lista completa está en `docs/ROADMAP_MIGRATION.md`.

## Documentación canónica actual

1. `docs/FUNCTIONAL_SPECIFICATION_V2.md`
2. `docs/TECHNICAL_SPECIFICATION_V2.md`
3. `docs/INFRASTRUCTURE_EFFICIENCY.md`
4. `docs/CANONICAL_DATA.md`
5. `docs/ROADMAP_FRONTEND.md`
6. `docs/ROADMAP_MIGRATION.md`
7. `docs/ROADMAP_FUNCTIONAL.md`
8. `docs/PROJECT_RULES.md`
9. `docs/PROJECT_STATUS.md`

## Próxima línea recomendada de trabajo

1. ejecutar M28–M35;
2. después M36–M45;
3. abordar las issues funcionales abiertas por valor.

**ChatGPT no realiza deployments.**
