# PA-001 — Actualizar datos de una película

## 1. Identidad del proceso

- **ID:** PA-001
- **Nombre funcional:** Actualizar datos de una película
- **Nombre técnico:** `single_title`
- **Pantalla de origen:** Ficha individual de película (`/catalogo/[imdbId]`)
- **Disparador:** Botón **Actualizar datos**
- **Tipo de ejecución:** Manual bajo demanda
- **Origen registrado:** `web`
- **Unidad de trabajo:** 1 título por ejecución
- **Procesamiento por lotes:** No

## 2. Objetivo

Actualizar y enriquecer una película concreta a partir de su IMDb ID, consolidando identidad, metadatos, valoraciones, imágenes, géneros, reparto, dirección y saga/colección. También puede incorporar al catálogo un título que exista en Plex pero todavía no esté en `movies`.

## 3. Flujo paso a paso

### Paso 1 — Crear ejecución

Antes de procesar el título se crea una fila en `pipeline_runs` con:

- `job_type = single_title`
- `source = web`
- `status = running`
- `summary.stage = start`

Antes de crear la nueva ejecución se limpian ejecuciones antiguas que permanezcan en `running` durante más de 2 horas. Esas ejecuciones se marcan como `failed` y `stage = abandoned`.

### Paso 2 — Validar IMDb ID

El identificador debe cumplir el patrón `tt` seguido de dígitos. Si no lo cumple, el proceso termina con error `IMDb ID inválido`.

### Paso 3 — Comprobar si el título ya está en Catálogo

Se busca el IMDb ID en `movies`.

- Si existe, continúa el enriquecimiento.
- Si no existe, se busca en los elementos activos de Plex mediante `plex_items` y `plex_external_ids`.
- Si se encuentra en Plex, se obtiene una identidad mínima: título, año, tipo y `rating_key`.
- En ese caso se crea una entrada temporal en `movies` con origen `plex_manual` y estado `staging`.

### Paso 4 — Garantizar rating IMDb

El proceso intenta obtener rating y votos IMDb en este orden:

1. `movies`
2. `catalog_candidates`
3. Dataset oficial IMDb `title.ratings.tsv.gz`

La descarga bajo demanda del dataset tiene timeout de **12 segundos**.

Si IMDb falla o no devuelve datos, **el proceso continúa**. IMDb queda como `pending_dataset`.

### Paso 5 — Resolver identidades conocidas

Se conservan como preferentes los IDs ya existentes:

- IMDb ID
- TMDb ID
- FilmAffinity ID

El proceso evita sustituirlos innecesariamente.

### Paso 6 — Consultar Wikidata si falta FilmAffinity ID

Si no existe `fa_id`, se consulta Wikidata mediante el IMDb ID para intentar obtener:

- Wikidata ID
- FilmAffinity ID (`P480`)

Si Wikidata falla, **el proceso continúa**.

### Paso 7 — Consultar TMDb

TMDb aporta la estructura principal del enriquecimiento.

Si ya existe `tmdb_id`:

1. intenta el tipo esperado (`movie` para película),
2. si falla, prueba el tipo alternativo (`tv`).

Si no existe `tmdb_id`, realiza búsqueda por IMDb ID y después consulta la ficha completa.

Datos obtenidos de TMDb:

- TMDb ID
- título español
- título original
- fecha de estreno
- año
- duración
- rating y votos
- póster
- backdrop
- sinopsis
- idioma original
- países
- géneros
- saga/colección
- director
- reparto principal

El reparto se limita a **15 actores**.

Cada petición externa tiene timeout de **15 segundos**.

Si TMDb falla definitivamente, **el enriquecimiento falla**.

### Paso 8 — Consultar FilmAffinity

Si existe `fa_id`, intenta obtener nota y votos por dos vías:

1. ficha principal `film<ID>.html`
2. página de reviews `reviews/1/<ID>.html`

El parser intenta primero JSON-LD y después extracción desde el HTML visible.

Si FilmAffinity falla en ambos intentos, **el proceso continúa** sin nota FA.

### Paso 9 — Calcular PikoScore

Se utilizan las fuentes que tengan nota y votos válidos:

- IMDb
- FilmAffinity
- TMDb

El peso de cada fuente es:

`log10(votos + 10)`

El PikoScore es la media ponderada resultante.

### Paso 10 — Persistir datos

Se actualizan o crean datos en varias tablas.

#### `movies`

Entre otros:

- tipo
- título
- título español
- título original
- año
- duración
- país
- PikoScore
- IMDb rating y votos
- FilmAffinity ID, rating y votos
- TMDb ID, rating y votos
- Wikidata ID
- póster
- backdrop
- estado de fuentes
- timestamps de enriquecimiento

#### `movie_metadata`

- sinopsis
- idioma original
- fecha de estreno

#### `movie_genres`

Se eliminan los géneros anteriores y se reconstruyen.

#### `movie_credits`

Se eliminan los créditos anteriores y se reconstruyen con director y reparto principal.

#### `people`

Se crean o actualizan las personas asociadas.

#### `movie_collections`

Se elimina la relación previa y se reconstruye si TMDb devuelve una colección/saga.

### Paso 11 — Garantizar consistencia

Antes de escribir se solicita un `pg_advisory_xact_lock` sobre `pikofilm:catalog-enrichment`.

Las operaciones principales de persistencia se ejecutan dentro de una transacción SQL.

## 4. Fuentes utilizadas

| Fuente | Uso | Obligatoria para completar |
|---|---|---:|
| IMDb | Rating y votos | No |
| TMDb | Identidad, metadatos, imágenes, reparto, géneros, saga | Sí |
| FilmAffinity | Rating, votos y preferencia de título español cuando está disponible | No |
| Wikidata | Resolver Wikidata ID y posible FilmAffinity ID | No |
| Plex | Identidad mínima para altas desde Plex | No |
| OMDb | No participa actualmente | No |

## 5. Volumen y concurrencia

- **Elementos por ejecución:** 1
- **Tamaño de lote:** 1
- **Número máximo por pulsación:** 1
- **Procesamiento masivo:** No
- **Doble pulsación desde la misma ficha:** mitigada deshabilitando el botón mientras está pendiente
- **Bloqueo de escritura concurrente:** sí, mediante advisory lock PostgreSQL

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
| Advisory lock | Sí | Serializa enriquecimientos de catálogo |
| Alta parcial desde Plex | Sí | Conserva ficha mínima |
| Reintento automático completo | No | No existe |
| Heartbeat/progreso por fases | No | No existe progreso intermedio |
| Limpieza de ejecuciones colgadas | Sí | `running` > 2 h → `failed` |

## 7. Resultado de la ejecución

### Éxito completo

La ejecución se cierra como `success` con:

- `processed = 1`
- `updated = 1`
- `summary.stage = done`
- IMDb ID
- operación (`add` o `refresh`)
- título
- estado de identidad
- estado de IMDb

También se registra un evento de auditoría en `admin_events`.

### Alta parcial desde Plex

Si el título no estaba en Catálogo, sí estaba en Plex y el enriquecimiento falla después de crear la entrada mínima, se conserva el registro con información de estado parcial:

- `partial = true`
- `enrichment_status = pending`
- origen Plex
- `plex_rating_key`
- último error
- fecha del intento
- TMDb marcado como pendiente/missing

La ejecución se registra actualmente como:

- `status = success`
- `processed = 1`
- `added = 1`
- `errors = 1`
- `summary.stage = partial`

Este comportamiento debe considerarse una decisión de diseño pendiente, ya que un resultado parcial queda clasificado técnicamente como `success`.

### Fallo total

Si no aplica el caso parcial, la ejecución se cierra como `failed` con:

- `processed = 1` si se llegó a validar el IMDb ID
- `errors = 1`
- `summary.stage = failed`
- IMDb ID
- nombre y mensaje del error

Si existía una fila temporal en `staging`, se intenta eliminar.

## 8. Salida visual para el usuario

### Durante la ejecución

El botón cambia a **Procesando…** y queda deshabilitado.

### Al finalizar correctamente

Se muestra un mensaje debajo del botón con un resumen similar a:

`Actualizada: <título>. PikoScore X · IMDb X · FA X · TMDb X`

### En error

Se muestra el mensaje concreto del error o, como fallback:

`No se pudo procesar el título`

### Limitaciones visuales actuales

- No existe barra de progreso.
- No se muestran fases intermedias.
- No se informa fuente por fuente durante la ejecución.
- Solo se muestra estado pendiente y resultado final.

## 9. Visibilidad en Admin

La ejecución aparece en **Admin → Actividad / Procesos** como `single_title`.

Admin permite ver y filtrar por:

- todos
- en curso
- correctos
- fallidos
- tipo de proceso

Cada ejecución muestra:

- tipo de proceso
- origen
- fecha/hora de inicio
- duración
- procesados
- errores
- estado
- fecha/hora de fin
- añadidos
- actualizados
- omitidos
- errores
- JSON completo de `summary`

Además, el enriquecimiento deja un registro separado en **Auditoría de acciones**, asociado al IMDb ID.

## 10. Recuperación y relanzamiento

- El proceso puede volver a ejecutarse manualmente desde la ficha.
- No existe reintento automático del proceso completo.
- Las ejecuciones que quedan en `running` durante más de 2 horas se marcan automáticamente como abandonadas/fallidas cuando se inicia una nueva ejecución registrada.
- Las escrituras principales están protegidas por transacción y advisory lock.
- En altas desde Plex existe un modo de conservación parcial para evitar perder una identidad mínima válida.

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

1. Valorar un estado explícito `partial` en lugar de registrar resultados parciales como `success`.
2. Decidir si TMDb debe seguir siendo una dependencia fatal o permitir un enriquecimiento parcial.
3. Evaluar reintentos automáticos por fuente.
4. Mejorar la salida visual con fases y resultado fuente por fuente.
5. Valorar si el proceso debería incorporar OMDb u otras fuentes.
6. Determinar si debe existir una variante masiva de este mismo proceso.
