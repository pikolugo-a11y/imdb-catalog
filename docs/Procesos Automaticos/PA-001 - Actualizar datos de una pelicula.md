# PA-001 — Actualizar datos de una película

## 1. Identidad del proceso

- **ID:** PA-001
- **Nombre funcional:** Actualizar datos de un título
- **Nombre técnico:** `single_title`
- **Tipo de ejecución:** Manual bajo demanda
- **Origen registrado:** `web`
- **Unidad de trabajo:** 1 título por ejecución
- **Procesamiento por lotes:** No

### Puntos de entrada / Dónde se utiliza

| Área | Pantalla | Acción visual | Backend | Volumen |
|---|---|---|---|---:|
| Catálogo | Ficha de película (`/catalogo/[imdbId]`) | **Actualizar datos** | `EnrichTitleButton` → `single_title` | 1 título |
| Catálogo | Ficha de serie/miniserie (`/catalogo/[imdbId]`) | **↻ Actualizar datos** | `EnrichTitleButton` → `single_title` | 1 título |

Ambas interfaces utilizan el mismo proceso técnico. La presentación de la ficha cambia según sea película o serie/miniserie, pero no se crea un proceso automático distinto. Si durante la revisión de PikoFilm aparecen nuevos puntos de entrada que ejecuten este mismo backend, se añadirán a esta tabla en lugar de crear un nuevo PA.

## 2. Objetivo

Actualizar y enriquecer un título concreto a partir de su IMDb ID, consolidando identidad, metadatos, valoraciones, imágenes, géneros, reparto, dirección y saga/colección. También puede incorporar al catálogo un título que exista en Plex pero todavía no esté en `movies`.

## 3. Flujo paso a paso

### Paso 1 — Crear ejecución
Antes de procesar el título se crea una fila en `pipeline_runs` con `job_type = single_title`, `source = web`, `status = running` y `summary.stage = start`. Antes de crearla se limpian ejecuciones antiguas que permanezcan en `running` durante más de 2 horas, marcándolas `failed` y `stage = abandoned`.

### Paso 2 — Validar IMDb ID
El identificador debe cumplir el patrón `tt` seguido de dígitos. Si no lo cumple, termina con `IMDb ID inválido`.

### Paso 3 — Comprobar Catálogo/Plex
Se busca el IMDb ID en `movies`. Si no existe, se busca en Plex. Si se encuentra allí, se obtiene identidad mínima y se puede crear una entrada temporal `plex_manual`/`staging`.

### Paso 4 — Garantizar rating IMDb
Orden: `movies` → `catalog_candidates` → dataset oficial `title.ratings.tsv.gz`. Timeout bajo demanda: **12 s**. Si falla, continúa como `pending_dataset`.

### Paso 5 — Resolver identidades conocidas
Conserva como preferentes IMDb ID, TMDb ID y FilmAffinity ID existentes.

### Paso 6 — Wikidata si falta FA ID
Consulta Wikidata mediante IMDb para intentar obtener Wikidata ID y FilmAffinity ID (`P480`). Si falla, continúa.

### Paso 7 — TMDb
Aporta identidad, títulos, estreno, año, duración, rating/votos, imágenes, sinopsis, idioma, países, géneros, colección, director y hasta **15 actores**. Si existe `tmdb_id`, prueba el tipo esperado y después el alternativo; si no, busca por IMDb ID. Timeout HTTP: **15 s**. Si TMDb falla definitivamente, el enriquecimiento falla.

### Paso 8 — FilmAffinity
Con `fa_id`, intenta ficha principal y después página de reviews. Extrae nota, votos y eventualmente título mediante JSON-LD o HTML. Si falla, continúa sin nota FA.

### Paso 9 — PikoScore
Usa las fuentes disponibles entre IMDb, FilmAffinity y TMDb. Peso: `log10(votos + 10)`; resultado: media ponderada.

### Paso 10 — Persistencia
Actualiza `movies`, `movie_metadata`, reconstruye `movie_genres`, `movie_credits`, actualiza `people` y reconstruye `movie_collections` cuando procede.

### Paso 11 — Consistencia
Usa `pg_advisory_xact_lock('pikofilm:catalog-enrichment')` y las escrituras principales se ejecutan en una transacción SQL.

## 4. Fuentes utilizadas

| Fuente | Uso | Obligatoria para completar |
|---|---|---:|
| IMDb | Rating y votos | No |
| TMDb | Identidad, metadatos, imágenes, reparto, géneros, saga | Sí |
| FilmAffinity | Rating, votos y preferencia de título español | No |
| Wikidata | Resolver Wikidata ID y posible FA ID | No |
| Plex | Identidad mínima para altas desde Plex | No |
| OMDb | No participa actualmente | No |

## 5. Volumen y concurrencia

- **Elementos por ejecución:** 1
- **Tamaño de lote:** 1
- **Número máximo por pulsación:** 1
- **Procesamiento masivo:** No
- **Doble pulsación desde la misma ficha:** mitigada deshabilitando el botón mientras está pendiente
- **Bloqueo de escritura concurrente:** sí, advisory lock PostgreSQL

## 6. Controles y tolerancia a fallos

| Control | Estado | Comportamiento |
|---|---:|---|
| Validación IMDb ID | Sí | Bloquea IDs inválidos |
| Botón deshabilitado durante ejecución | Sí | Evita doble clic inmediato |
| Timeout IMDb | Sí | 12 s |
| Fallo IMDb tolerado | Sí | Continúa como `pending_dataset` |
| Timeout fuentes HTTP | Sí | 15 s por petición |
| Fallo Wikidata tolerado | Sí | Continúa |
| Fallback FilmAffinity | Sí | ficha → reviews |
| Fallo FilmAffinity tolerado | Sí | Continúa sin nota |
| Fallback TMDb movie/tv | Sí | Prueba tipo alternativo |
| Fallo TMDb tolerado | No | Falla el enriquecimiento |
| Transacción de escritura | Sí | Escrituras agrupadas |
| Advisory lock | Sí | Serializa enriquecimientos |
| Alta parcial desde Plex | Sí | Conserva ficha mínima |
| Reintento automático completo | No | No existe |
| Heartbeat/progreso por fases | No | No existe |
| Limpieza de ejecuciones colgadas | Sí | `running` > 2 h → `failed` |

## 7. Resultado de la ejecución

### Éxito completo
`success`, `processed = 1`, `updated = 1`, `summary.stage = done`, con IMDb ID, operación, título y estados relevantes. También registra auditoría.

### Alta parcial desde Plex
Puede conservar una ficha mínima con `partial = true`, `enrichment_status = pending`, origen Plex, `plex_rating_key`, último error y fecha del intento. Actualmente se registra como `status = success`, `processed = 1`, `added = 1`, `errors = 1`, `stage = partial`.

### Fallo total
Se cierra como `failed`, con `errors = 1`, `stage = failed`, IMDb ID y detalle del error. Si existía una fila temporal `staging`, se intenta eliminar.

## 8. Salida visual para el usuario

Durante la ejecución el botón cambia a **Procesando…** y queda deshabilitado. Al terminar muestra un resumen del título, PikoScore e IMDb/FA/TMDb; en error muestra el mensaje concreto o `No se pudo procesar el título`.

**Limitaciones:** no hay barra de progreso, fases intermedias ni estado fuente por fuente.

## 9. Visibilidad en Admin

Aparece en **Admin → Actividad / Procesos** como `single_title`. Se registran tipo, origen, inicio, fin, duración, procesados, añadidos, actualizados, omitidos, errores, estado y `summary` técnico. Además puede dejar registro en **Auditoría de acciones** asociado al IMDb ID.

## 10. Recuperación y relanzamiento

- Puede relanzarse manualmente desde cualquiera de sus puntos de entrada.
- No existe reintento automático completo.
- `running` de más de 2 h se marca como abandonado/fallido cuando se inicia una nueva ejecución registrada.
- Escrituras principales protegidas por transacción y advisory lock.
- Altas desde Plex pueden conservar estado parcial.

## 11. Evaluación actual

- **Cobertura funcional:** Alta
- **Tolerancia a fallos:** Buena
- **Trazabilidad Admin:** Alta
- **Información visual al usuario:** Básica
- **Control por fuente:** Bueno, con dependencia crítica de TMDb
- **Reintentos automáticos:** Inexistentes
- **Estados parciales:** Existen, pero se clasifican como `success`
- **Procesamiento masivo:** No

## 12. Puntos de diseño pendientes

1. Valorar estado explícito `partial`.
2. Decidir si TMDb debe seguir siendo dependencia fatal.
3. Evaluar reintentos automáticos por fuente.
4. Mejorar salida visual con fases y resultado fuente por fuente.
5. Valorar incorporación de OMDb u otras fuentes.
6. Determinar si debe existir variante masiva.

## 13. Regla documental para reutilización

Todo PA debe incluir una sección **Puntos de entrada / Dónde se utiliza**. Cuando una nueva pantalla, botón o automatismo invoque un proceso técnico ya documentado, se añadirá como nuevo punto de entrada al PA existente. Solo se creará un nuevo ID PA cuando exista un proceso funcional/técnico diferente.