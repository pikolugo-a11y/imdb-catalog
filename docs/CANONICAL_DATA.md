# PikoFilm — Datos canónicos de países y géneros

**Estado:** arquitectura vigente  
**Fecha de consolidación:** 22/08/2026

Este documento recoge la capa canónica de países y géneros que sigue formando parte del modelo actual de PikoFilm. Sustituye cualquier documentación ligada a versiones V2/V3 sobre esta materia.

## Países

Entidades persistidas:
- `countries`: catálogo canónico con código estable y nombre visible en castellano.
- `country_aliases`: equivalencias de códigos ISO, QID Wikidata y nombres históricos/internacionales.
- `movie_countries`: relación N:M título-país.
- `country_normalization_issues`: tokens no resueltos que deben permanecer trazables.
- `movie_country_names`: vista de presentación con nombres en castellano.

Reglas vigentes:
- Alias equivalentes deben converger en una misma entidad canónica, por ejemplo `US`, `Q30` y `United States of America` → `Estados Unidos`; `ES`, `Q29` y `Spain` → `España`.
- Las coproducciones se representan como relaciones independientes; el orden de un string de origen no tiene significado canónico.
- Los valores no resolubles no se descartan: permanecen trazables en `country_normalization_issues`.
- Las lecturas funcionales deben preferir la capa canónica frente a representaciones legacy cuando ambas existan.

## Géneros

Entidades persistidas:
- `genres`: vocabulario canónico en castellano.
- `genre_aliases`: equivalencias entre fuentes e idiomas.
- `movie_genres_canonical`: relación N:M título-género canónico.
- `genre_normalization_issues`: valores no resolubles.
- `movie_genre_names`: vista agregada de presentación.

Reglas vigentes:
- Alias ingleses/castellanos convergen en el mismo género canónico.
- Categorías compuestas se descomponen cuando corresponde, por ejemplo `Action & Adventure` → `Acción` + `Aventura`, `Sci-Fi & Fantasy` → `Ciencia ficción` + `Fantasía` y `War & Politics` → `Bélica` + `Política`.
- Los valores no resolubles se conservan para revisión en `genre_normalization_issues`.
- Filtros, ficha y agregaciones deben usar el vocabulario canónico para evitar duplicados de idioma o código.

## Uso en PikoFilm

La capa canónica de países y géneros es un dato derivado/normalizado del Catálogo y debe reutilizarse en:
- Catálogo y sus filtros;
- fichas de títulos;
- Dashboard y agregaciones estadísticas;
- cualquier evolución futura que necesite país o género.

No debe crearse una segunda taxonomía paralela. Si persisten columnas o tablas legacy por compatibilidad, su retirada debe hacerse únicamente después de comprobar consumidores y dependencias según `ROADMAP_MIGRATION.md`.
