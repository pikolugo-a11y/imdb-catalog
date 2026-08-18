# PikoFilm enrichment worker

Worker experimental de la issue #14.

## Primera prueba

- Solo procesa jobs `catalog_enrichment_test`.
- Máximo un job por arranque.
- Modo dry-run: no modifica `movies`, créditos, géneros ni sagas.
- Usa `admin_job_requests` como cola.
- Guarda el resultado del test dentro de `payload.result`.
- No hace commits, no llama a Vercel y no lanza otros procesos.

## Variables

- `DATABASE_URL`
- `TMDB_API_TOKEN`
- `WORKER_POLL_MS` opcional (por defecto 15000)

## Arranque

`npm run worker:test`

## Job de prueba

`job_type = catalog_enrichment_test`

Payload:

```json
{"imdb_id":"tt..."}
```

El worker valida el título existente en Neon, consulta Wikidata para resolver el FilmAffinity ID (P480) y TMDb para resolver datos del título. El resultado se guarda en el job y `writes_to_catalog` permanece en 0.
