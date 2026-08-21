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
| Mi Biblioteca | `/plex` | **Añadir con IMDb** sobre un elemento Plex sin catálogo | `enrichSingleTitle` → `single_title` | 1 título |

Las interfaces utilizan el mismo proceso técnico. Si durante la revisión aparecen nuevos puntos de entrada que ejecuten este mismo backend, se añaden aquí en lugar de crear un PA nuevo.

## 2. Objetivo
Actualizar y enriquecer un título concreto a partir de su IMDb ID, consolidando identidad, metadatos, valoraciones, imágenes, géneros, reparto, dirección y saga/colección. También puede incorporar al catálogo un título que exista en Plex pero todavía no esté en `movies`.

## 3. Flujo paso a paso
1. Crea `pipeline_runs` con `job_type=single_title`, `source=web`, `status=running`, `stage=start`; recupera runs `running` de más de 2 h como fallidos/abandonados.
2. Valida patrón IMDb `tt` + dígitos.
3. Busca el título en `movies`; si no existe, intenta localizarlo en Plex y crear identidad mínima/staging.
4. Garantiza rating IMDb desde `movies` → `catalog_candidates` → dataset `title.ratings.tsv.gz` (timeout 12 s; fallo tolerado).
5. Conserva IDs conocidos IMDb/TMDb/FA.
6. Si falta FA ID, intenta Wikidata (`P480`); fallo tolerado.
7. TMDb aporta identidad, títulos, estreno, duración, ratings, imágenes, sinopsis, idioma, países, géneros, colección, director y hasta 15 actores. Timeout 15 s; si falla definitivamente, el enriquecimiento falla.
8. FilmAffinity intenta ficha principal y reviews; extrae nota/votos/título; fallo tolerado.
9. Calcula PikoScore ponderando fuentes disponibles con `log10(votos+10)`.
10. Actualiza `movies`, `movie_metadata`, géneros, créditos/personas y colecciones.
11. Escrituras principales protegidas por advisory lock `pikofilm:catalog-enrichment` y transacción.

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
- 1 elemento por ejecución.
- Sin procesamiento masivo.
- Botón se deshabilita durante la ejecución.
- Advisory lock serializa escrituras de enriquecimiento.

## 6. Controles y tolerancia a fallos
- Validación IMDb.
- Timeout IMDb 12 s, fallo tolerado.
- Fuentes HTTP principales 15 s.
- Wikidata y FilmAffinity tolerados.
- Fallback FA ficha→reviews y TMDb movie↔tv.
- TMDb es dependencia fatal.
- Transacción + advisory lock.
- Alta parcial desde Plex si existe identidad mínima.
- Sin reintento automático completo.
- Sin heartbeat/progreso por fases.
- Runs colgados >2 h se recuperan como failed.

## 7. Resultado
**Éxito:** `success`, processed=1, updated=1, stage=done.

**Alta parcial desde Plex:** conserva ficha mínima con `partial=true`, `enrichment_status=pending`; actualmente el run se registra `success` con errors=1 y stage=partial.

**Fallo total:** `failed`, errors=1, stage=failed; elimina staging cuando corresponde.

## 8. Salida visual
Durante ejecución: **Procesando…**. Al terminar muestra título/PikoScore/IMDb/FA/TMDb o mensaje de error. No hay barra de progreso ni fases fuente por fuente.

## 9. Visibilidad en Admin
Alta: `single_title` con origen, tiempos, contadores y summary; auditoría adicional por IMDb ID.

## 10. Recuperación
Relanzable desde cualquiera de sus puntos de entrada. No hay retry automático. Escrituras principales son transaccionales y las altas Plex pueden conservar estado parcial.

## 11. Evaluación
Cobertura alta, tolerancia buena, Admin alto, información visual básica, TMDb crítico, sin retry automático, estados parciales mezclados con success.

## 12. Puntos de diseño pendientes
1. Estado explícito `partial`.
2. Revisar dependencia fatal TMDb.
3. Reintentos por fuente.
4. Progreso/fases visuales.
5. Valorar OMDb.
6. Variante masiva si aporta valor.

## 13. Regla documental
Todo PA incluye **Puntos de entrada / Dónde se utiliza**. Una nueva pantalla que invoque el mismo proceso se añade al PA existente; solo se crea nuevo ID para un proceso funcional/técnico diferente.