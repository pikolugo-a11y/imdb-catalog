# PikoFilm — Novedades V1 · Especificación técnica

## Componentes
- `app/novedades/page.js`: UI compacta y control de discovery.
- `app/novedades/news.css`: estilos responsive específicos.
- `app/novedades/[imdbId]/page.js`: ficha de candidato.
- `app/novedades/criterios/page.js`: reglas.
- `app/novedades/actions.js`: alta manual, exclusión/restauración, retirada, catalogación y dispatch manual GitHub.
- `lib/news-v1.js`: consultas, stats, paginación, cooldown y override de aceptación.
- `worker/imdb-discovery.mjs`: batch IMDb + guard semanal.
- `.github/workflows/imdb-discovery.yml`: solo `workflow_dispatch`, con input `force_once`.

## Persistencia
`catalog_candidates`, `catalog_exclusions`, `movies`, `app_settings`, `pipeline_runs`. `admin_job_requests` ya no actúa como cola del discovery actual. `app_settings.imdb_discovery_test_override` contiene únicamente la excepción operacional de aceptación; no sustituye la política semanal.

## Discovery
Streaming de `title.ratings.tsv.gz` y después `title.basics.tsv.gz`; tipos movie/tvSeries/tvMiniSeries; país selectivo para rescate España; caché `source_snapshot`; Wikidata batch y TMDb fallback acotado; upserts por lotes. India configurable (`Q668`,`IN`). Automáticos no vistos pasan a `not_eligible`, no se borran.

## Ejecución segura (#42)
No existe `schedule`, cron ni polling. El workflow solo admite ejecución manual. Antes de descargar datasets el worker consulta la última ejecución exitosa y bloquea si no han pasado 7 días.

### Desde PikoFilm
`requestNewsDiscoveryAction()` ejecuta el dispatch sin sacar al usuario del frontal:
- usa `GITHUB_ACTIONS_TOKEN` exclusivamente server-side en Vercel;
- recalcula el cooldown en servidor;
- si está permitido, envía `workflow_dispatch` con `force_once=false`;
- si existe cooldown, consume atómicamente un override `enabled=true/used=false` y envía `force_once=true`;
- si GitHub rechaza la llamada, rearma ese override para que el fallo técnico no lo consuma;
- registra audit log y devuelve feedback a `/novedades`.

La UI nunca recibe el token. `saveNewsSettingsAction()` solo persiste configuración. No se generan `admin_job_requests pending`.

### Override controlado
El workflow propaga `force_once` a `FORCE_DISCOVERY_ONCE`. El worker omite únicamente el guard semanal cuando vale `true`; el run queda trazado como `manual_test_override`, con `forceOnce` y `weeklyGuardBypassed`. La bandera en Neon se consume una sola vez y no se rearma automáticamente. Una ejecución exitosa pasa a ser la nueva referencia para el cooldown de 7 días.

## UI (#41)
`getNewsV1()` pagina 24/48/96 (default 24), devuelve stats, contador de excluidas, último run, cooldown y disponibilidad de override. Tabla compacta con acciones Ver/IMDb/Añadir/Excluir/Retirar. `getNewsCandidate()` alimenta ficha local sin llamadas externas. Catálogo añade acceso prominente `/catalogo/excluidas`.

## Alta parcial (#43)
`enrichNewsCandidateAction()` crea staging y reutiliza `enrichTitle()`.
- éxito completo → `catalogued`, staging eliminado, run `success/done`;
- error con identidad mínima fiable → conservar `movies`, `source_status.partial=true`, `enrichment_status=pending`, error/timestamp, candidato `catalogued`, run `success/partial`;
- identidad mínima insuficiente → borrar solo staging, candidato `eligible`, run `failed_identity`.

Calidad/Identidad detecta TMDb/FA/campos pendientes desde la fila canónica; no se crea silo adicional. Regresión `tt38268282`.

## Exclusión
`catalog_exclusions` sigue siendo única fuente. Anti-join en Novedades. Restauración explícita para manual excluido.

## Observabilidad
`pipeline_runs`: `imdb_discovery` para batch/cooldown/override y `single_title` para alta completa/parcial/fallo de identidad. Auditoría ligera para mutaciones y para dispatch/fallo de GitHub.

## Seguridad
- secreto GitHub solo en Vercel;
- permiso mínimo para ejecutar Actions del repositorio;
- nunca persistir token en GitHub, Neon, logs o navegador;
- ningún trigger periódico;
- guard semanal redundante en worker;
- override único mediante actualización condicional.

## Rendimiento
Streaming gzip, prefiltrado ratings, país selectivo, upserts batch, render Neon-only, paginación server-side y cero enriquecimiento masivo en render.

## CI / deployment
Antes de producción debe validarse build/sintaxis. El deployment de Vercel lo realiza manualmente el usuario; después el usuario ejecuta la batería funcional dirigida. Issues no se cierran antes de aceptación explícita.
