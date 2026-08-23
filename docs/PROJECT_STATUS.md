# PikoFilm — Bitácora y estado operativo

> Documento vivo. La especificación funcional/técnica canónica describe el sistema; esta bitácora solo fija el punto actual.

## Estado registrado

**Fecha:** 23/08/2026 (Europe/Madrid)  
**Fase:** arquitectura Lifecycle materializada; migración M01–M35 completada  
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

No existe `TECH_REVIEW`: PikoQuality bajo no constituye por sí solo una incidencia funcional.

## Hitos cerrados / implementados

1. Lifecycle materializado en `catalog_lifecycle`.
2. Catálogo muestra la fase de cada título y es la base de consulta única.
3. Novedades unifica Discovery, Plex y Manual.
4. `/plex` queda solo como redirect temporal a Novedades origen Plex.
5. Identidad, Validación de identidad, Datos, Películas, PikoQuality y Series son unitarios en su operación normal.
6. Identidad ya no usa GitHub Actions/polling; FA usa el resolver Python productivo.
7. PikoScore 2.0 implantado y separado de actualización de ratings.
8. Validación/PikoQuality física se vinculan al fingerprint actual.
9. `/calidad` es mapa de colas Lifecycle y no lanza acciones masivas.
10. Retirados runners/batches/workflows/workers antiguos de identidad, validación, películas, PikoQuality y Series.
11. CI es el único workflow automático; Discovery, ratings offline y mantenimiento son manuales.
12. `worker/` queda reducido a `imdb-discovery.mjs` y `update-imdb-ratings.mjs`.
13. `api/fa-search.py` y `api/fa-evidence.py` son endpoints Python unitarios productivos.
14. **M28:** `getLifecycleForIds()` es estrictamente lectura del snapshot; ya no recalcula por antigüedad. Las mutaciones relevantes recalculan estado explícitamente. Sync Plex reconcilia solo estados físicamente sensibles, en lotes.
15. **M29/M30:** Calidad cuenta `PIKOSCORE_PENDING` dentro de Datos y representa explícitamente `MOVIE_FILE_PENDING/REVIEW`.
16. **M31:** retirado `TECH_REVIEW`.
17. **M32:** PikoScore legado sin versión/fecha actual se considera no vigente. Auditoría: 20.444/20.446 scores existentes eran pre-2.0/no vigentes; se conservan físicamente hasta recálculo, sin tratarlos como score canónico en Catálogo.
18. **M33:** PikoQuality exige fórmula + fingerprint actuales. Auditoría: 63.834 evaluados, 0 evaluados sin fórmula/fingerprint.
19. **M34:** `source_status` es auxiliar/transitorio, no fuente canónica. La poda física segura queda integrada en M42.
20. **M35:** `movie_quality_findings` estaba vacío al auditar; no quedan findings pre-Lifecycle que migrar.
21. Retirados restos internos huérfanos: `identity-validation-run-control.js`, `pikoquality-b-probe.js`, `pikoquality-pilot.js`.
22. Especificaciones funcional y técnica actualizadas con el Lifecycle materializado definitivo.
23. Documentación histórica activa retirada y `CANONICAL_DATA.md` consolidado.
24. `PROJECT_RULES.md` incorpora propósito, merge siempre/deployment nunca y eficiencia/coste.
25. `INFRASTRUCTURE_EFFICIENCY.md` fija la política técnica Neon/Vercel.

## Flujo de regresión de referencia

### `tt6720618`
`Plex/Novedades → Identidad → Validación → Datos → PikoScore → Validación película → PikoQuality → Complete`.

### `tt21187592`
`Novedades → Identidad → Validación → Datos → PikoScore → Complete`.

FilmAffinity en Identidad queda aceptado de momento tras recuperar una tasa de acierto razonable con el resolver Python probado; no bloquea la migración.

## Deuda conocida importante

- **Siguiente bloque:** M36–M42, retención, espacio, índices, snapshots y JSON/payloads en Neon.
- Después M43–M45: CSS/layouts/componentes heredados.
- El redirect `/plex` se conserva temporalmente por compatibilidad.
- Quedan las issues funcionales abiertas ya depuradas; se abordarán después de cerrar la migración técnica.

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

1. ejecutar M36–M42 con foco en coste/crecimiento Neon;
2. ejecutar M43–M45 para deuda visual/técnica;
3. abordar después las issues funcionales abiertas por valor.

**ChatGPT no realiza deployments.**
