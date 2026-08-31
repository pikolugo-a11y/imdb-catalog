# DATA-008 retirado

Decisión funcional: `PROC-DATA-008` deja de existir como proceso independiente.

La actualización de ratings pertenece a `PROC-DATA-002` por título. Cuando exista el nuevo Batch común, la actualización masiva se modelará como N ejecuciones de DATA-002; una descarga compartida de `title.ratings.tsv.gz` podrá ser una optimización técnica interna, nunca una segunda vía funcional de escritura.

Se retiran el worker `worker/update-imdb-ratings.mjs`, el workflow manual `.github/workflows/imdb-ratings-refresh.yml` y el script npm asociado. DATA-008 no crea candidatos ni toca Novedades.
