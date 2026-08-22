# PA-022 — Prueba experimental de enriquecimiento

## 1. Identidad
- **ID:** PA-022
- **Workflow:** `catalog-enrichment-test.yml`
- **Tipo:** manual GitHub Actions, experimental

### Punto de entrada
- GitHub Actions → PikoFilm · prueba enriquecimiento 1 título.

## 2. Objetivo
Probar enriquecimiento de un IMDb ID en `dry-run` o `commit` usando el worker experimental de la rama `issue-14-worker`.

## 3. Volumen
1 IMDb ID. Timeout 3 min.

## 4. Controles
- Valida patrón IMDb.
- Default `dry-run`.
- Para `commit` exige repetir exactamente el IMDb ID en `confirm_imdb_id`.
- Concurrency global de prueba, no cancela en curso.
- Checkout explícito de rama experimental, no main.

## 5. Salida
Logs GitHub Actions.

## 6. Admin
No hay integración garantizada con Admin en el workflow actual.

## 7. Evaluación
Proceso experimental/legacy que debe revisarse para decidir si sigue siendo necesario frente a PA-001 y PA-004.