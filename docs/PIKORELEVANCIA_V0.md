# PikoRelevancia V0

Fórmula viva: `0.2.0` (Media Cloud sustituye a GDELT).

Objetivo: evaluar series por IMDb ID antes de integrar el resultado en el Lifecycle de admisión.

## Principios
- Cero IA.
- Cero scraping.
- FilmAffinity no participa.
- La puntuación es determinista y explicable.
- Un fallo de fuente reduce la confianza; nunca se interpreta como evidencia negativa.
- V0 no modifica el Catálogo ni el Lifecycle.

## Fuentes
- Datos PikoFilm ya disponibles: PikoScore, IMDb rating/votos cuando existen.
- TMDb: identidad, popularidad, estado, origen/idioma, traducción española y proveedores por país.
- Watchmode: contraste independiente de disponibilidad en España.
- Wikidata/Wikipedia ES + Wikimedia Pageviews: huella enciclopédica y tráfico 90 días.
- Media Cloud: cobertura reciente en medios españoles mediante la colección `Spain - National` (`34412356`) y búsquedas en español.
- OMDb sólo como rescate de identidad/rating si el IMDb ID todavía no está en PikoFilm.

No se usa Brave ni ninguna fuente de pago nueva.

## Salida
`series_relevance_assessments` conserva:
- `score` 0-100
- `confidence` 0-100
- `recommendation`
- factores con peso y puntos
- evidencias
- salud de cada fuente
- próxima revisión

## Recomendaciones V0
- >=80: muy_alta
- >=65: alta
- >=50: remojo
- >=35: baja
- <35: muy_baja
- confianza <60: datos_insuficientes

Estos umbrales son experimentales y configurables mediante `app_settings.key='pikorelevance_v0'`.

## Proceso
`PROC-REL-001` vive en el worker API de Railway y acepta un `entity_id` IMDb (`tt...`).
Cada fuente es tolerante a fallos. La ejecución sólo debe fallar por IMDb ID inválido o por un fallo interno no recuperable.

### Fiabilidad de fuentes externas
- Wikidata SPARQL conserva la política histórica para otros callers, pero PikoRelevancia usa hasta 3 intentos, timeout de 30 s por intento y backoff.
- Wikidata EntityData y Wikimedia Pageviews usan hasta 3 intentos y timeout de 20 s por intento.
- Media Cloud se consulta con una sola petición `search/total-count` por serie, sobre los últimos 90 días. Requiere `MEDIACLOUD_API_KEY`; la colección española es configurable mediante `MEDIACLOUD_ES_COLLECTION_ID` y vale `34412356` por defecto.
- Media Cloud se serializa dentro del worker con una separación mínima configurable (`PIKORELEVANCE_MEDIACLOUD_MIN_INTERVAL_MS`, 31 s por defecto), coherente con el límite público de 2 peticiones/minuto.
- HTTP 429 y 5xx se reintentan con backoff exponencial; `Retry-After`, cuando existe, tiene prioridad.
- Una fuente agotada sigue reduciendo `confidence`; nunca se transforma en evidencia negativa.

## Siguiente fase
Después de validar la fórmula con una muestra de series elegidas por el usuario:
1. ajustar pesos y umbrales;
2. introducir estado de admisión de series;
3. impedir que series nuevas de Discovery entren en `catalog_read_model` hasta decisión de admisión;
4. programar reevaluación de títulos en remojo.