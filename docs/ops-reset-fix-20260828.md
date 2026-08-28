# Fix PROC-OPS-001 · dependencias detectadas en producción

La primera ejecución real con `tt15281656` fue bloqueada correctamente por el preflight al detectar seis tablas derivadas no incluidas inicialmente en la allowlist de limpieza: `catalog_read_model`, `movie_countries`, `movie_country_names`, `movie_genre_names`, `movie_genres_canonical`, `title_ratings`.

Se incorporan explícitamente como estado derivado limpiable. La protección ante tablas desconocidas permanece activa.
