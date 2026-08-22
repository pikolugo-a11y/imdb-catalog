# PikoFilm — Bitácora y estado operativo

> Documento vivo. La especificación funcional/técnica canónica describe el sistema; esta bitácora solo fija el punto actual.

## Estado registrado

**Fecha:** 22/08/2026 (Europe/Madrid)  
**Fase:** arquitectura Lifecycle consolidada y primer flujo completo validado  
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

## Hitos cerrados en esta versión

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
16. Neon fue podado/compactado: logs limitados manualmente a 1.000 + 1.000 y snapshots catalogados limpiados; última medición aproximada ~403 MB.
17. `PROJECT_RULES.md` incorpora el propósito permanente de PikoFilm y la regla explícita merge siempre / deployment nunca por ChatGPT.
18. Se retiró de `docs/` la documentación histórica V1/V2/V3 y los pilotos obsoletos. La información todavía vigente de países/géneros se consolidó en `CANONICAL_DATA.md`. El histórico queda preservado por Git.

## Flujo de regresión probado

### `tt6720618`
Caso con archivo físico:
`Plex/Novedades → Identidad → Validación → Datos → PikoScore → Validación película → PikoQuality → Complete`.

### `tt21187592`
Caso sin archivo físico:
`Novedades → Identidad → Validación → Datos → PikoScore → Complete`.

## Deuda conocida importante

- `/calidad` conserva botones masivos anteriores.
- Series todavía depende de actualización masiva en su pantalla principal.
- Persisten runners/APIs/workflows batch antiguos que hay que auditar y retirar.
- PikoQuality conserva funciones batch históricas aunque la película usa ya motor unitario.
- Dashboard contiene enlace/terminología Plex anterior.
- Retención de Admin/pipeline todavía no está automatizada.
- Lifecycle debe evolucionar a lectura 100% materializada/event-driven en todas las vistas grandes.

La lista completa está en `docs/ROADMAP_MIGRATION.md`.

## Documentación canónica actual

1. `docs/FUNCTIONAL_SPECIFICATION_V2.md` — comportamiento funcional actual.
2. `docs/TECHNICAL_SPECIFICATION_V2.md` — arquitectura técnica actual.
3. `docs/CANONICAL_DATA.md` — países y géneros canónicos.
4. `docs/ROADMAP_FRONTEND.md` — mejoras de UI/UX por pantalla.
5. `docs/ROADMAP_MIGRATION.md` — legado a borrar/adaptar.
6. `docs/ROADMAP_FUNCTIONAL.md` — evoluciones futuras.
7. `docs/PROJECT_RULES.md` — propósito y reglas operativas permanentes.
8. `docs/PROJECT_STATUS.md` — esta foto de estado.

La carpeta `docs/` ya no mantiene documentos históricos activos de versiones anteriores. Para consultar esas versiones debe usarse el historial de Git.

## Próxima línea recomendada de trabajo

1. ejecutar primero el bloque P0 de `ROADMAP_MIGRATION.md` para eliminar procesos masivos/duplicados;
2. aplicar el bloque P0 del `ROADMAP_FRONTEND.md` para que el frontal represente exactamente el lifecycle nuevo;
3. completar después la rama unitaria de Series;
4. seleccionar las siguientes funcionalidades por valor desde `ROADMAP_FUNCTIONAL.md`.

No se ha solicitado ni ejecutado deployment como parte de esta actualización documental.