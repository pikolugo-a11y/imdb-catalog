# PikoFilm — Bitácora y estado operativo

> Documento vivo. La especificación funcional/técnica canónica describe el sistema; esta bitácora solo fija el punto actual.

## Estado registrado

**Fecha:** 23/08/2026 (Europe/Madrid)  
**Fase:** arquitectura Lifecycle materializada; M01–M35 completado; M46 Batch Autopilot diseñado y priorizado  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama productiva preparada:** `main`

## Reglas operativas innegociables

- Deployments Vercel: siempre manuales por el usuario.
- Los cambios se preparan en rama, pasan CI y se mergean a `main`.
- Pruebas funcionales/visuales: las realiza el usuario sobre el deployment que decida.
- El procesamiento canónico sigue siendo unitario por título/serie/archivo/etapa; la automatización masiva futura encadenará muchas operaciones unitarias seguras, no procesos monolíticos.
- Vercel es interfaz/control plane, no motor batch de larga duración.
- GitHub Actions no debe convertirse en infraestructura continua de procesamiento Lifecycle.
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
26. **M46 diseñado:** Batch Engine / Autopilot Lifecycle permitirá automatización masiva mediante operaciones unitarias, cola/checkpoint, leases, rate limit por fuente, backoff, circuit breaker, presupuestos y kill switch.
27. M46 separa control plane (Vercel), state plane (Neon) y execution plane (worker dedicado pendiente de seleccionar).
28. Estados de revisión humana (`IDENTITY_REVIEW_REQUIRED`, `MOVIE_FILE_REVIEW`, `SERIES_REVIEW`) serán barreras obligatorias del Autopilot.

## Flujo de regresión de referencia

### `tt6720618`
`Plex/Novedades → Identidad → Validación → Datos → PikoScore → Validación película → PikoQuality → Complete`.

### `tt21187592`
`Novedades → Identidad → Validación → Datos → PikoScore → Complete`.

FilmAffinity en Identidad queda aceptado de momento tras recuperar una tasa de acierto razonable con el resolver Python probado; no bloquea la migración.

## Decisión estratégica M46

Lifecycle unitario nació para impedir procesos masivos accidentales capaces de bloquear GitHub/Vercel/fuentes externas. Esa protección se mantiene, pero **no se renuncia a la automatización masiva**.

La nueva estrategia es ejecutar muchas unidades canónicas de forma controlada. Vercel solo crea/controla runs; Neon mantiene cola/estado/checkpoints; un worker dedicado ejecutará los jobs con baja concurrencia y límites por fuente.

Documento canónico: `docs/BATCH_AUTOPILOT_ARCHITECTURE.md`.

Orden M46 aprobado:
1. M46-A: control + cola + Admin sin tráfico batch externo;
2. elegir host del worker;
3. M46-B: FAST worker local/SQL;
4. M46-C: APIs oficiales/controlables;
5. M46-D: FilmAffinity/web sensible;
6. M46-E: Autopilot Lifecycle;
7. M46-F: evaluar sacar Discovery/ratings IMDb de GitHub Actions.

## Deuda conocida importante

- **Siguiente bloque prioritario:** M46-A, construir infraestructura de control y cola sin lanzar aún procesos masivos externos.
- Antes de M46-B hay que seleccionar el host del execution plane.
- M36–M42 siguen pendientes: retención, espacio, índices, snapshots y JSON/payloads en Neon.
- M43–M45: CSS/layouts/componentes heredados.
- El redirect `/plex` se conserva temporalmente por compatibilidad.
- Quedan las issues funcionales abiertas ya depuradas.

La lista completa está en `docs/ROADMAP_MIGRATION.md`.

## Documentación canónica actual

1. `docs/FUNCTIONAL_SPECIFICATION_V2.md`
2. `docs/TECHNICAL_SPECIFICATION_V2.md`
3. `docs/BATCH_AUTOPILOT_ARCHITECTURE.md`
4. `docs/INFRASTRUCTURE_EFFICIENCY.md`
5. `docs/CANONICAL_DATA.md`
6. `docs/ROADMAP_FRONTEND.md`
7. `docs/ROADMAP_MIGRATION.md`
8. `docs/ROADMAP_FUNCTIONAL.md`
9. `docs/PROJECT_RULES.md`
10. `docs/PROJECT_STATUS.md`

## Próxima línea recomendada de trabajo

1. implementar M46-A sin ejecución batch real;
2. comparar y seleccionar runtime dedicado para el worker;
3. validar cola, leases, pausa, cancelación e idempotencia con jobs FAST;
4. ampliar de forma incremental a APIs y después fuentes sensibles;
5. continuar M36–M45 en paralelo cuando no interfiera.

**ChatGPT no realiza deployments.**
