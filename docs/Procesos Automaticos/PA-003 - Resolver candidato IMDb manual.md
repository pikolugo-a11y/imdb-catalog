# PA-003 — Resolver candidato IMDb manual

## 1. Identidad del proceso
- **ID:** PA-003
- **Nombre funcional:** Resolver candidato IMDb manual
- **Workflow:** `imdb-manual-candidate.yml`
- **Worker:** `worker/imdb-manual-candidate.mjs`
- **Tipo:** manual bajo demanda + ejecución asíncrona en GitHub Actions
- **Unidad de trabajo:** 1 IMDb ID

### Puntos de entrada / Dónde se utiliza
| Área | Pantalla | Acción | Comportamiento |
|---|---|---|---|
| Novedades | `/novedades` | **Añadir manualmente** | Crea/resuelve inicialmente el candidato y dispara PA-003 para resolución autoritativa |
| Novedades | `/novedades` | **↻ Reintentar** | Relanza PA-003 para el mismo IMDb ID cuando la resolución autoritativa falla o queda atascada |
| Novedades | restauración manual | Restaurar candidato manual | Tras restaurar puede volver a disparar la resolución autoritativa |

## 2. Objetivo
Completar de forma autoritativa un candidato introducido manualmente mediante IMDb ID, obteniendo datos de los datasets oficiales de IMDb y complementándolos con país, TMDb ID, póster y sinopsis mediante Wikidata/TMDb.

## 3. Arquitectura y fases
El alta manual tiene dos niveles:
1. La acción web valida el IMDb ID y realiza una resolución inicial para que el candidato pueda aparecer inmediatamente en Novedades.
2. Marca la resolución autoritativa como `pending`, incrementa `authoritativeAttempts` y lanza GitHub Actions.
3. GitHub ejecuta el worker específico para ese IMDb ID.
4. El worker sustituye/completa los datos con información autoritativa y marca `authoritativeStatus = complete`, o `failed` si termina con error.

## 4. Flujo paso a paso
1. Validar formato `tt` + dígitos.
2. Comprobar que no exista ya en `movies` ni esté excluido.
3. Crear/actualizar candidato manual como `eligible` mediante resolución inicial.
4. Marcar `authoritativeStatus = pending`, fecha de solicitud e incrementar intento.
5. Auditar la solicitud.
6. Comprobar `GITHUB_ACTIONS_TOKEN`.
7. Lanzar `imdb-manual-candidate.yml` con `imdb_id`.
8. GitHub prepara Ubuntu, Node 24 e instala dependencias.
9. Worker valida de nuevo `IMDB_ID`.
10. Busca rating/votos en `title.ratings.tsv.gz`.
11. Busca tipo, título, título original, adulto y año en `title.basics.tsv.gz`.
12. Ambas búsquedas IMDb se ejecutan en paralelo.
13. Cada lectura se detiene al encontrar/sobrepasar numéricamente el IMDb ID objetivo.
14. Si no existe en Basics, falla.
15. Consulta Wikidata para países.
16. Consulta TMDb para identidad complementaria, póster, sinopsis y países.
17. Si TMDb devuelve países, tienen prioridad sobre Wikidata.
18. UPSERT en `catalog_candidates` como `eligible`.
19. Marca `authoritativeStatus = complete`, fecha de resolución y resolver utilizado.
20. Registra `admin_event` de éxito.

## 5. Volumen y concurrencia
- **IMDb IDs por ejecución:** 1.
- **Ratings/Basics:** lectura secuencial desde el inicio hasta encontrar o sobrepasar el ID; no necesariamente dataset completo.
- **Ratings y Basics:** procesados en paralelo.
- **GitHub timeout:** 10 minutos.
- **Concurrencia:** grupo `pikofilm-imdb-manual-${imdb_id}`.
- **cancel-in-progress:** false.
- Títulos distintos pueden tener grupos de concurrencia distintos.

## 6. Fuentes
| Fuente | Uso | Fallo |
|---|---|---|
| IMDb ratings dataset | rating y votos | Rating ausente puede quedar null; fallo de descarga puede tumbar worker |
| IMDb basics dataset | tipo, títulos, adulto, año | IMDb ID no encontrado es fatal |
| Wikidata | país | Tolerado; devuelve vacío |
| TMDb | TMDb ID, póster, sinopsis, país | Tolerado; devuelve null |
| Neon | candidato, estado, intentos, persistencia y auditoría | Crítico ante error no controlado |

## 7. Datos persistidos
En `catalog_candidates`: `candidate_type`, `year`, `imdb_rating`, `imdb_votes`, `eligibility_status = eligible` y `source_snapshot` enriquecido con título, título original, adulto, flags manuales, países, estado de país, fuentes dataset, fechas, resolver, estado autoritativo, TMDb ID, póster y sinopsis.

## 8. Control de intentos y estados
Antes del dispatch se incrementa `authoritativeAttempts` y se registra `authoritativeRequestedAt`.

Estados principales:
- `pending`: workflow solicitado y pendiente.
- `complete`: resolución autoritativa terminada.
- `failed`: resolución autoritativa fallida.

En fallo se guardan `manualAuthoritativeFailedAt` y `manualAuthoritativeError`.

## 9. Detección de proceso atascado
La interfaz de Novedades puede considerar la resolución atascada cuando permanece pendiente durante aproximadamente **30 minutos**. En ese caso habilita **↻ Reintentar**. El reintento no constituye un PA nuevo: vuelve a disparar PA-003 e incrementa el número de intento.

## 10. Controles y tolerancia a fallos
| Control | Estado | Comportamiento |
|---|---:|---|
| Validación IMDb ID web | Sí | Bloquea formato inválido |
| Validación IMDb ID worker | Sí | Segunda validación |
| Existencia previa en catálogo | Sí | Evita duplicar alta manual |
| Exclusiones | Sí | Impide alta normal de excluido |
| Estado pending antes del dispatch | Sí | Permite seguimiento |
| Contador de intentos | Sí | `authoritativeAttempts` |
| Concurrencia por IMDb ID | Sí | Evita cancelación de ejecución previa del mismo grupo |
| Timeout GitHub | Sí | 10 min |
| Wikidata tolerado | Sí | continúa sin país |
| TMDb tolerado | Sí | continúa sin datos TMDb |
| Reintento manual | Sí | botón ↻ Reintentar |
| Reintento automático | No | inexistente |
| Detección visual de atascado | Sí | ~30 min |
| `pipeline_runs` propio | No | carencia relevante |

## 11. Tratamiento de errores
Si falta `GITHUB_ACTIONS_TOKEN`, el candidato pasa a estado autoritativo fallido y se audita. Si el dispatch HTTP falla, se registra el error y queda `failed`. Si el worker falla, ejecuta `markFailed`, guarda fecha/error en `source_snapshot`, genera `manual_authoritative_failed` y termina GitHub con código 1.

La resolución inicial puede dejar el candidato visible incluso si la fase autoritativa posterior falla, permitiendo reintento.

## 12. Salida visual
El alta manual devuelve avisos en Novedades. El candidato puede mostrar estado de resolución autoritativa, fallo/atasco y ofrecer **↻ Reintentar**. No existe barra de progreso ni fases en tiempo real del workflow.

## 13. Visibilidad en Admin
- **Auditoría:** alta; registra solicitud, dispatch, retry, resolución y fallos mediante `admin_events`.
- **pipeline_runs:** baja/inexistente para el worker autoritativo; PA-003 no crea actualmente un `pipeline_run` propio.
- El estado técnico detallado queda principalmente en `catalog_candidates.source_snapshot`.

## 14. Recuperación
La recuperación es manual mediante **↻ Reintentar**. El candidato permanece disponible y conserva contador de intentos y último error. No existe retry automático ni checkpoint intermedio.

## 15. Evaluación actual
- **Cobertura funcional:** Alta
- **Unidad de trabajo:** Clara, 1 título
- **Trazabilidad por candidato:** Alta
- **Trazabilidad homogénea en Admin/pipeline_runs:** Baja
- **Tolerancia Wikidata/TMDb:** Buena
- **Dependencia IMDb Basics:** Crítica
- **Información visual:** Media-baja
- **Recuperación:** Manual pero funcional
- **Reintentos automáticos:** Inexistentes

## 16. Puntos de diseño pendientes
1. Añadir `pipeline_runs` propio para homogeneizar PA-003 con PA-001/PA-002.
2. Decidir si el reintento debe automatizarse tras determinados errores.
3. Revisar la diferencia entre timeout GitHub de 10 min y detección UI de atascado a ~30 min.
4. Mejorar progreso/estado visual.
5. Valorar optimización/caché de datasets para evitar volver a descargarlos por cada candidato manual.
6. Mantener todos los puntos de entrada de alta/restauración/reintento asociados a este mismo PA.