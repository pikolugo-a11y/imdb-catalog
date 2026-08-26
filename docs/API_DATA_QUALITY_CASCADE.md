# CALIDAD → Datos: cascada de proveedores

Orden canónico de enriquecimiento: **TMDb → OMDb → MDBList**.

`Completar datos` no reidentifica el título ni cambia su tipo. La identidad y el tipo deben llegar ya validados desde las fases de Identidad/Validación. El proceso se limita a enriquecer los huecos de datos respetando esa identidad.

- Si el título es **Película**, TMDb usa `/movie/{tmdb_id}` y MDBList usa `/imdb/movie/{imdb_id}`.
- Si el título es **Serie/Miniserie**, TMDb usa `/tv/{tmdb_id}` y MDBList usa `/imdb/show/{imdb_id}`.
- OMDb se consulta siempre por su identificador oficial `i=<IMDb ID>`.

Para series, TMDb puede profundizar en temporadas, episodios, créditos e imágenes para completar campos que no estén presentes en la ficha general. Esto no altera el tipo almacenado.

Las fuentes posteriores solo completan huecos; no sustituyen datos válidos ya recuperados por una fuente anterior.

Todas las llamadas HTTP de esta cascada registran request y response en `admin_events` mediante eventos `provider_http_request` y `provider_http_response`. Las credenciales se enmascaran y las respuestas se truncan para evitar almacenar secretos o payloads excesivos.

Si una identidad o un tipo están mal clasificados, deben corregirse en el flujo de Identidad/Validación, no silenciosamente durante el enriquecimiento de datos.
