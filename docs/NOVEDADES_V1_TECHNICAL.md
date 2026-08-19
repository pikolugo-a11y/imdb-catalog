# PikoFilm — Novedades V1 · Especificación técnica

## Componentes
- `app/novedades/page.js`: UI compacta.
- `app/novedades/news.css`: estilos responsive específicos.
- `app/novedades/[imdbId]/page.js`: ficha de candidato.
- `app/novedades/criterios/page.js`: reglas.
- `app/novedades/actions.js`: alta manual, exclusión/restauración, retirada y catalogación.
- `lib/news-v1.js`: consultas, stats, paginación y cooldown.
- `worker/imdb-discovery.mjs`: batch IMDb.
- `.github/workflows/imdb-discovery.yml`: **solo `workflow_dispatch`**.

## Persistencia
`catalog_candidates`, `catalog_exclusions`, `movies`, `app_settings`, `pipeline_runs`. `admin_job_requests` ya no actúa como cola del discovery actual.

## Discovery
Streaming de `title.ratings.tsv.gz` y después `title.basics.tsv.gz`; tipos movie/tvSeries/tvMiniSeries; país selectivo para rescate España; caché `source_snapshot`; Wikidata batch y TMDb fallback acotado; upserts por lotes. India configurable (`Q668`,`IN`). Automáticos no vistos pasan a `not_eligible`, no se borran.

## Ejecución segura (#42)
No existe `schedule`, cron ni polling. El workflow solo admite ejecución manual. Antes de descargar datasets el worker consulta la última ejecución exitosa y bloquea si no han pasado 7 días, registrando `weekly_cooldown`.

La web no inserta solicitudes `pending`. `saveNewsSettingsAction()` solo persiste configuración. `getNewsV1()` calcula `nextAllowedAt` y `discoveryAllowed`; si está permitido la UI abre el workflow manual GitHub, si no muestra cooldown. No se añaden tokens GitHub a Vercel/frontend.

## UI (#41)
`getNewsV1()` pagina 24/48/96 (default 24), devuelve stats, contador de excluidas y último run. Tabla compacta con acciones Ver/IMDb/Añadir/Excluir/Retirar. `getNewsCandidate()` alimenta ficha local sin llamadas externas. Catálogo añade acceso prominente `/catalogo/excluidas`.

## Alta parcial (#43)
`enrichNewsCandidateAction()` crea staging y reutiliza `enrichTitle()`.
- éxito completo → `catalogued`, staging eliminado, run `success/done`;
- error con identidad mínima fiable → conservar `movies`, `source_status.partial=true`, `enrichment_status=pending`, error/timestamp, candidato `catalogued`, run `success/partial` con error pendiente;
- identidad mínima insuficiente → borrar solo staging, candidato `eligible`, run `failed_identity`.

Calidad/Identidad detecta TMDb/FA/campos pendientes desde la fila canónica; no se crea silo adicional. Regresión `tt38268282`.

## Exclusión
`catalog_exclusions` sigue siendo única fuente. Anti-join en Novedades. Restauración explícita para manual excluido.

## Observabilidad
`pipeline_runs`: `imdb_discovery` para batch/cooldown y `single_title` para alta completa/parcial/fallo de identidad. Auditoría ligera para mutaciones de candidatos.

## Rendimiento
Streaming gzip, prefiltrado ratings, país selectivo, upserts batch, render Neon-only, paginación server-side y cero enriquecimiento masivo en render.

## CI / deployment
Antes de producción debe validarse build/sintaxis. El deployment de Vercel lo realiza manualmente el usuario; después el usuario ejecuta la batería funcional dirigida. Issues no se cierran antes de aceptación explícita.
