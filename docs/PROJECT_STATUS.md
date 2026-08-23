# PikoFilm — Bitácora y estado operativo

> Documento vivo. La especificación funcional/técnica canónica describe el sistema; esta bitácora solo fija el punto actual.

## Estado registrado

**Fecha:** 23/08/2026 (Europe/Madrid)  
**Fase:** arquitectura Lifecycle consolidada; bloque P0 M01–M07 implementado en rama y pendiente de CI/merge  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama productiva preparada:** `main`  
**Último deployment confirmado antes de este bloque:** `30a1f581cdc4486538a118577d525eb191c81ae9`

## Reglas operativas innegociables

- Deployments Vercel: siempre manuales por el usuario.
- Los cambios se preparan en rama, pasan CI y se mergean a `main`.
- Pruebas funcionales/visuales: las realiza el usuario sobre el deployment que decida.
- Procesamiento normal de títulos: unitario, una película/serie cada vez y con feedback.
- Catálogo es la vista maestra; Plex representa presencia física; Novedades es la entrada única.
- Excluidas quedan fuera del lifecycle hasta restauración.
- No se implementa control de reproducciones/visto; Plex ya cubre ese ámbito.
- Eficiencia de infraestructura: PostgreSQL filtra/agrega cerca del dato y Vercel recibe solo lo necesario; ver `INFRASTRUCTURE_EFFICIENCY.md`.

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
3. Novedades unifica Discovery, Plex y Manual mediante columna Origen.
4. `/plex` deja de ser una bandeja independiente y redirige a Novedades origen Plex.
5. Identidad se procesa de uno en uno.
6. Validación de Identidad se procesa de uno en uno, con decisión manual.
7. Datos separa actualización completa, actualización ligera de ratings y cálculo local de PikoScore.
8. PikoScore 2.0 implantado con votos/confianza, corrección contextual España, RT/Metacritic y frescura dinámica.
9. FilmAffinity usa un extractor robusto compartido.
10. Validación de archivo de película se vincula al fingerprint actual.
11. PikoQuality de película se procesa unitariamente después de validar archivo.
12. PikoQuality recalcula lifecycle en la misma operación y puede pasar directamente a Complete.
13. Las tablas duplicadas de Películas/PikoQuality se eliminaron de los layouts.
14. Ficha de serie permite excluir; excluir no borra Plex.
15. Las operaciones nuevas dejan traza en Admin.
16. Se retiró documentación histórica activa y se consolidó `CANONICAL_DATA.md`.
17. `PROJECT_RULES.md` incorpora propósito, merge siempre/deployment nunca y eficiencia/coste.
18. `INFRASTRUCTURE_EFFICIENCY.md` fija la política técnica Neon/Vercel.
19. **M01:** `/calidad` queda como mapa de colas y pierde todas las acciones masivas.
20. **M02:** eliminado `QualityRunAutoRefresh` y el polling asociado a batches.
21. **M03:** Series dispone de motor `lib/series-unitary.js` y acciones por serie `Crear referencia` / `Refrescar serie`.
22. **M04:** retirado `lib/quality-v2.js` y el disparador masivo antiguo de validación de películas; la ruta canónica es `validateMovieFile` por título/fingerprint.
23. **M05:** el flujo operativo PikoQuality queda centrado en `pikoquality-unitary.js`; `pikoquality.js` conserva scoring compartido mientras se limpian pilotos posteriores.
24. **M06:** retirada `/api/pikoquality/run`.
25. **M07:** retirado `PikoQualityRunner.js`.
26. La portada de Calidad cuenta `PIKOSCORE_PENDING` dentro de Datos y muestra `MOVIE_FILE_*` como etapa propia.

## Flujo de regresión probado previamente

### `tt6720618`
Caso con archivo físico:
`Plex/Novedades → Identidad → Validación → Datos → PikoScore → Validación película → PikoQuality → Complete`.

### `tt21187592`
Caso sin archivo físico:
`Novedades → Identidad → Validación → Datos → PikoScore → Complete`.

## Deuda conocida importante

- Quedan conceptos/rutas/pilotos P1 de M08–M15.
- Persisten workflows/APIs/workers batch heredados a auditar en M16–M27, incluido el workflow/worker histórico de refresco completo de Series, ya sin consumidor desde el frontal normal.
- Lifecycle todavía debe cerrarse como 100% event-driven/materializado en M28–M35.
- Retención, índices, payloads y almacenamiento Neon siguen en M36–M42.
- CSS/componentes heredados siguen en M43–M45.
- Dashboard contiene enlace/terminología Plex anterior.

La lista completa está en `docs/ROADMAP_MIGRATION.md`.

## Documentación canónica actual

1. `docs/FUNCTIONAL_SPECIFICATION_V2.md` — comportamiento funcional actual.
2. `docs/TECHNICAL_SPECIFICATION_V2.md` — arquitectura técnica actual.
3. `docs/INFRASTRUCTURE_EFFICIENCY.md` — eficiencia/coste Neon/Vercel.
4. `docs/CANONICAL_DATA.md` — países y géneros canónicos.
5. `docs/ROADMAP_FRONTEND.md` — mejoras de UI/UX por pantalla.
6. `docs/ROADMAP_MIGRATION.md` — legado a borrar/adaptar.
7. `docs/ROADMAP_FUNCTIONAL.md` — evoluciones futuras.
8. `docs/PROJECT_RULES.md` — propósito y reglas operativas permanentes.
9. `docs/PROJECT_STATUS.md` — esta foto de estado.

## Próxima línea recomendada de trabajo

Tras CI, merge, deployment manual y prueba de regresión de este bloque:
1. ejecutar M08–M11 y M15;
2. después M16–M27;
3. cerrar Lifecycle con M28–M35;
4. optimizar almacenamiento/índices y deuda visual con M36–M45;
5. entonces abordar las issues funcionales abiertas por valor.

**No se ha realizado deployment desde ChatGPT.**
