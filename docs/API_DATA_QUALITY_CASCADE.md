# CALIDAD → Datos: cascada de proveedores

Orden canónico de enriquecimiento: TMDb → OMDb → MDBList.

Antes de enriquecer, TMDb se resuelve desde el IMDb ID mediante `/find/{imdb_id}?external_source=imdb_id`, de modo que `tmdb_id` y `type` almacenados pueden corregirse si están desactualizados o mal clasificados.

Todas las llamadas HTTP de esta cascada registran request y response en `admin_events` mediante eventos `provider_http_request` y `provider_http_response`. Las credenciales se enmascaran y las respuestas se truncan para evitar almacenar payloads excesivos.

OMDb se consulta por `i=<IMDb ID>` conforme a su contrato oficial. MDBList se consulta mediante `/{media_provider}/{media_type}/{media_id}/`, usando `media_provider=imdb` y `media_type=movie|show`.

Las fuentes posteriores solo completan huecos; no sustituyen datos válidos ya recuperados por una fuente anterior.
