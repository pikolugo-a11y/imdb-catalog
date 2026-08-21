# PA-002 — Discovery de Novedades IMDb

## 1. Identidad del proceso
- **ID:** PA-002
- **Nombre funcional:** Discovery de Novedades IMDb
- **Nombre técnico:** `imdb_discovery`
- **Tipo:** manual bajo demanda con cooldown semanal
- **Programación cron:** no existe actualmente
- **Ejecución:** PikoFilm → GitHub Actions → worker Node

### Puntos de entrada / Dónde se utiliza
| Área | Pantalla | Acción | Backend |
|---|---|---|---|
| Novedades | `/novedades` | **Buscar novedades** / **Prueba única** | `requestNewsDiscoveryAction` → `imdb-discovery.yml` → `worker/imdb-discovery.mjs` |

## 2. Objetivo
Recorrer los datasets oficiales de IMDb para detectar películas, series y miniseries que todavía no estén en el catálogo y cumplan los criterios configurados de valoración/votos, incluyendo una regla específica de rescate para España.

## 3. Frecuencia y disparador
No es realmente un proceso programado semanal. El workflow solo dispone de `workflow_dispatch`. El usuario debe solicitarlo manualmente desde Novedades. Tras una ejecución correcta existe un cooldown de 7 días. Hay una excepción controlada `force_once` de un solo uso para pruebas.

La protección semanal se comprueba tanto en la acción web como dentro del worker.

## 4. Flujo paso a paso
1. La web comprueba credencial GitHub y último `imdb_discovery` correcto.
2. Aplica cooldown de 7 días o consume, si está disponible, la excepción de prueba.
3. Solicita a GitHub Actions ejecutar `imdb-discovery.yml` sobre `main`.
4. GitHub prepara Ubuntu, Node 24 e instala dependencias.
5. Ejecuta `npm run worker:imdb-discovery`.
6. El worker vuelve a comprobar el límite semanal.
7. Carga configuración `imdb_discovery_v1` desde `app_settings`.
8. Carga catálogo, exclusiones y candidatos ya conocidos.
9. Descarga y recorre completamente `title.ratings.tsv.gz`.
10. Preselecciona IMDb IDs por los umbrales mínimos absolutos.
11. Descarga y recorre completamente `title.basics.tsv.gz`.
12. Filtra películas, series y miniseries, adultos, catálogo, exclusiones y candidatos manuales activos.
13. Resuelve países reutilizando caché, Wikidata y, como fallback limitado, TMDb.
14. Clasifica cada candidato según criterios general/España/país.
15. Persiste candidatos mediante UPSERT en lotes de 500.
16. Desactiva candidatos antiguos que ya no resulten elegibles.
17. Cierra `pipeline_runs` con métricas completas.

## 5. Criterios por defecto
| Tipo | General | Rescate España |
|---|---|---|
| Película | ≥ 6,0 y ≥ 10.000 votos | ≥ 6,0 y ≥ 7.500 votos |
| Serie/miniserie | ≥ 7,0 y ≥ 5.000 votos | ≥ 6,5 y ≥ 4.000 votos |

- Contenido adulto: excluido por defecto.
- País excluido configurado por defecto: India (`Q668`, `IN`).
- Los valores pueden modificarse mediante `app_settings`.

## 6. Volumen y lotes
- **IMDb ratings:** dataset completo.
- **IMDb basics:** dataset completo.
- **Candidatos potenciales:** variable, sin máximo global fijo.
- **Wikidata:** bloques de 120 IMDb IDs.
- **Fallback TMDb:** máximo primeros 800 candidatos sin país.
- **Concurrencia TMDb:** 8 workers.
- **UPSERT Neon:** lotes de 500 filas.
- **Timeout global GitHub:** 15 minutos.

## 7. Fuentes
| Fuente | Uso | Fallo fatal |
|---|---|---:|
| IMDb ratings dataset | rating/votos y preselección | Sí |
| IMDb basics dataset | tipo, año, títulos, adulto | Sí |
| Wikidata | resolución de país | No |
| TMDb | fallback de país | No |
| Neon | catálogo, configuración, exclusiones, candidatos y persistencia | Sí ante error no controlado |

## 8. Estados de candidatos
- **eligible / general:** cumple criterio general.
- **eligible / spain:** rescate España.
- **rejected:** país excluido.
- **not_eligible/pending:** país sin resolver o no cumple regla final.
- Los candidatos manuales activos quedan protegidos frente a sobrescritura del Discovery.

## 9. Controles y tolerancia a fallos
| Control | Estado | Comportamiento |
|---|---:|---|
| Cooldown semanal web | Sí | Bloquea lanzamiento normal antes de 7 días |
| Cooldown semanal worker | Sí | Segunda barrera independiente |
| Excepción de prueba única | Sí | `force_once` controlado |
| Concurrencia GitHub | Sí | grupo `pikofilm-imdb-discovery`, no cancela en curso |
| Timeout global | Sí | 15 min |
| Fallo datasets IMDb | Fatal | falla PA-002 |
| Fallo Wikidata | Tolerado | continúa |
| Fallo TMDb | Tolerado | país puede quedar pendiente |
| Reutilización de país cacheado | Sí | evita consultas innecesarias |
| Protección manuales | Sí | no pisa candidatos manuales activos |
| Reintento automático completo | No | inexistente |
| Checkpoint/reanudación | No | inexistente |
| Transacción global | No | puede existir persistencia parcial |

## 10. Escrituras
Principalmente `catalog_candidates`. También registra `pipeline_runs`, auditoría del dispatch y consume/restaura el override de prueba en `app_settings` cuando procede.

Después del UPSERT, candidatos anteriores de Discovery que ya no aparezcan válidos pasan a `not_eligible`.

## 11. Resultado y métricas
En éxito registra, entre otras:
- `elapsedSeconds`
- `ratingsScanned`
- `ratingsPreselected`
- `basicsScanned`
- `potentialCandidates`
- `generalEligible`
- `spanishRescues`
- `rejectedCountry`
- `pendingCountry`
- `rowsUpserted`
- `forceOnce`
- `weeklyGuardBypassed`

Contadores: `processed = potentialCandidates`; `added = generalEligible + spanishRescues`; `skipped = rejectedCountry + pendingCountry`.

En fallo cierra como `failed` con el mensaje de error.

## 12. Salida visual
Novedades muestra último Discovery, próxima disponibilidad y el botón de lanzamiento. Tras solicitarlo informa de que GitHub Actions lo ejecutará, o muestra bloqueo/error de dispatch.

No existe progreso en tiempo real, fases, contador visual ni resumen final asociado automáticamente a la ejecución recién lanzada.

## 13. Visibilidad en Admin
Alta. `pipeline_runs` registra `job_type = imdb_discovery`, estado, tiempos, contadores y summary detallado. El dispatch web también genera auditoría `workflow_dispatch` o `workflow_dispatch_failed`.

## 14. Recuperación
No hay checkpoint ni reanudación por fase. No hay retry automático. Si falla tras UPSERTs ya ejecutados puede quedar trabajo parcial persistido; una futura ejecución vuelve a reevaluar los candidatos.

## 15. Evaluación actual
- **Cobertura funcional:** Alta
- **Volumen:** Muy alto
- **Trazabilidad Admin:** Alta
- **Tolerancia de fuentes auxiliares:** Buena
- **Dependencia IMDb:** Crítica
- **Información visual:** Baja
- **Recuperación tras fallo:** Media-baja
- **Reintentos:** Inexistentes
- **Control de frecuencia:** Alto

## 16. Puntos de diseño pendientes
1. Decidir si debe convertirse realmente en ejecución automática semanal.
2. Mejorar progreso y resultado visual en Novedades.
3. Evaluar checkpoint/reanudación y retry automático.
4. Revisar límite de 800 fallbacks TMDb y concurrencia 8.
5. Revisar timeout global de 15 minutos frente al volumen completo de IMDb.
6. Valorar una semántica explícita para ejecuciones parciales.