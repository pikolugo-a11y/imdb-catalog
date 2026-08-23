# PikoFilm — Bitácora y estado operativo

> Documento vivo. La especificación funcional/técnica canónica describe el sistema; esta bitácora solo fija el punto actual.

## Estado registrado

**Fecha:** 23/08/2026 (Europe/Madrid)  
**Fase:** arquitectura Lifecycle consolidada; migración P0 y rutas/conceptos P1 iniciales completados  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama productiva preparada:** `main`

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
4. `/plex` ya no es una pantalla de producto; queda únicamente como redirect temporal a Novedades origen Plex.
5. Identidad se procesa de uno en uno.
6. La resolución unitaria de Identidad ya no usa GitHub Actions/polling; TMDb/Wikidata son vías rápidas y FilmAffinity reutiliza el resolver Python `python_filmaffinity` probado.
7. Validación de Identidad se procesa de uno en uno, con decisión manual.
8. Datos separa actualización completa, actualización ligera de ratings y cálculo local de PikoScore.
9. PikoScore 2.0 implantado con votos/confianza, corrección contextual España, RT/Metacritic y frescura dinámica.
10. Validación de archivo de película se vincula al fingerprint actual.
11. PikoQuality de película se procesa unitariamente después de validar archivo.
12. PikoQuality recalcula lifecycle en la misma operación y puede pasar directamente a Complete.
13. Series dispone de motor unitario y acciones por serie `Crear referencia` / `Refrescar serie`.
14. `/calidad` es mapa de colas Lifecycle y no lanza acciones masivas.
15. Se eliminaron `QualityRunAutoRefresh`, `lib/quality-v2.js`, `/api/pikoquality/run` y `PikoQualityRunner.js`.
16. Dashboard cuenta `PIKOSCORE_PENDING` dentro de Datos y muestra `MOVIE_FILE_*` como etapa propia.
17. Dashboard ya envía `Plex fuera catálogo` directamente a `/novedades?source=plex`.
18. No quedan componentes transitorios `PlexIntake.js` / `NovedadesPlexShell.js` ni terminología funcional “Mi Biblioteca”.
19. Eliminado CSS legado exclusivo de la antigua pantalla Plex.
20. Eliminadas las rutas de prueba `calidad/pikoquality-pilot` y `admin/pikoquality-probe` con sus acciones.
21. Se retiró documentación histórica activa y se consolidó `CANONICAL_DATA.md`.
22. `PROJECT_RULES.md` incorpora propósito, merge siempre/deployment nunca y eficiencia/coste.
23. `INFRASTRUCTURE_EFFICIENCY.md` fija la política técnica Neon/Vercel.

## Flujo de regresión probado previamente

### `tt6720618`
Caso con archivo físico:
`Plex/Novedades → Identidad → Validación → Datos → PikoScore → Validación película → PikoQuality → Complete`.

### `tt21187592`
Caso sin archivo físico:
`Novedades → Identidad → Validación → Datos → PikoScore → Complete`.

FilmAffinity en Identidad queda aceptado de momento tras recuperar una tasa de acierto razonable con el resolver Python probado; no bloquea la migración.

## Deuda conocida importante

- **Siguiente bloque:** M16–M27, workflows GitHub, APIs y workers batch heredados.
- Lifecycle todavía debe cerrarse como 100% event-driven/materializado en M28–M35.
- Retención, índices, payloads y almacenamiento Neon siguen en M36–M42.
- CSS/componentes heredados siguen en M43–M45.
- El redirect `/plex` se conserva temporalmente por compatibilidad y se podrá retirar en una fase posterior.

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

1. ejecutar M16–M27;
2. cerrar Lifecycle con M28–M35;
3. optimizar almacenamiento/índices y deuda visual con M36–M45;
4. abordar después las issues funcionales abiertas por valor.

**ChatGPT no realiza deployments.**
