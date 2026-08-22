# PA-018 — Actualización masiva de ratings IMDb

## 1. Identidad
- **ID:** PA-018
- **Workflow:** `imdb-ratings-refresh.yml`
- **Worker:** `update-imdb-ratings.mjs`
- **Tipo:** manual desde GitHub Actions
- **Programación cron:** no existe

### Punto de entrada
- GitHub Actions → **PikoFilm · actualizar ratings IMDb**.

## 2. Objetivo
Actualizar rating y votos IMDb de todos los IDs conocidos en Catálogo y candidatos usando el dataset oficial `title.ratings.tsv.gz`.

## 3. Flujo
1. Garantiza candidatos para títulos Plex fuera de catálogo con IMDb.
2. Construye set de todos los IMDb IDs de `movies` + `catalog_candidates`.
3. Descarga dataset completo IMDb ratings.
4. Recorre todas sus filas.
5. Conserva solo IDs objetivo con rating/votos válidos.
6. Actualiza en lotes de **500** tanto candidatos como movies.
7. Workflow puede verificar un IMDb ID al terminar.

## 4. Volumen
- Dataset ratings completo.
- Objetivos: todos los IMDb IDs conocidos.
- Escritura: lotes de 500.
- Workflow timeout: 10 min.

## 5. Controles
- DATABASE_URL obligatorio.
- Dataset HTTP obligatorio; fallo fatal.
- Concurrency global `pikofilm-imdb-ratings-refresh`, no cancela en curso.
- Verificación final opcional.
- No retry automático.

## 6. Persistencia
`catalog_candidates` y `movies`, incluyendo timestamp/fuente de dataset.

## 7. Salida
Principalmente logs de GitHub: targets, scanned_rows, matched_rows, elapsed_seconds y verificación opcional.

## 8. Admin
Carencia: el worker no crea `pipeline_runs` ni auditoría propia, por lo que su visibilidad dentro de Admin es baja/inexistente.

## 9. Recuperación
Relanzable; lotes ya escritos permanecen si falla a mitad. No hay checkpoint formal.

## 10. Evaluación
Útil y eficiente en escritura, pero débil en observabilidad PikoFilm y sin automatización periódica.

## 11. Pendientes
1. Integrarlo en `pipeline_runs`/Admin.
2. Decidir periodicidad automática.
3. Retry/checkpoint del dataset.
4. Recalcular PikoScore tras cambios de IMDb si corresponde.