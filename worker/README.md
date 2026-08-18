# PikoFilm enrichment worker

Worker experimental para la issue #14.

## Seguridad de la primera prueba

- Procesa solo jobs `catalog_enrichment_test`.
- Máximo un job activo a la vez.
- Modo dry-run: no modifica `movies`, créditos, géneros ni sagas.
- Usa `admin_job_requests` como cola y almacena el resultado del test dentro de `payload.result`.
- El worker no hace commits, no llama a Vercel y no lanza otros procesos.

## Variables

- `DATABASE_URL`
- `TMDB_API_TOKEN`
- `WORKER_POLL_MS` (opcional, por defecto 15000)

## Arranque

`npm run worker:test`

## Job de prueba

Crear un registro en `admin_job_requests` con:

- `job_type = catalog_enrichment_test`
- `status = pending`
- `payload = {"imdb_id":"tt..."}`

El worker valida el título existente en Neon, consulta Wikidata para resolver el FilmAffinity ID y TMDb para resolver/enriquecer el título. El resultado se guarda en el propio payload del job sin modificar el catálogo.
