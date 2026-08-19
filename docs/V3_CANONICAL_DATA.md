# PikoFilm V3 — Capa canónica de países y géneros

Fecha: 2026-08-19
Issues: #49 y #50.

## Estado

La capa canónica está creada y backfilleada en Neon producción. Los campos/tablas V2 legacy se conservan durante la transición para garantizar no regresión.

## Países

Entidades persistidas:
- `countries`: catálogo canónico con código estable y nombre visible en castellano.
- `country_aliases`: equivalencias de códigos ISO, QID Wikidata y nombres históricos/internacionales.
- `movie_countries`: relación N:M título-país.
- `country_normalization_issues`: tokens no resueltos, nunca silenciados.
- `movie_country_names`: vista de presentación con nombres españoles.

Reglas:
- `US`, `Q30` y `United States of America` convergen en `Estados Unidos`.
- `ES`, `Q29` y `Spain` convergen en `España`.
- Las coproducciones se almacenan como relaciones independientes; el orden del string legacy deja de tener significado.
- `movies.country` se conserva temporalmente como trazabilidad/fallback V2.
- Nuevas altas/cambios de `movies.country` sincronizan automáticamente la relación canónica mediante trigger, por lo que el enriquecimiento masivo puede continuar durante la transición.

## Géneros

Entidades persistidas:
- `genres`: vocabulario canónico en castellano.
- `genre_aliases`: aliases de distintas fuentes/idiomas.
- `movie_genres_canonical`: relación N:M título-género canónico.
- `genre_normalization_issues`: valores que no puedan resolverse.
- `movie_genre_names`: vista agregada de presentación.

Reglas:
- aliases ingleses/castellanos convergen al mismo género.
- categorías compuestas se descomponen: `Action & Adventure` → `Acción` + `Aventura`; `Sci-Fi & Fantasy` → `Ciencia ficción` + `Fantasía`; `War & Politics` → `Bélica` + `Política`.
- `movie_genres` legacy se conserva temporalmente.
- inserts/updates/deletes de `movie_genres` sincronizan automáticamente la relación canónica mediante trigger.

## Validación ejecutada

En producción tras el backfill:
- 31 géneros canónicos.
- 0 géneros legacy sin resolver en el snapshot validado.
- 0 relaciones huérfanas de países.
- 0 relaciones huérfanas de géneros.
- alias principales y coproducciones validados manualmente.
- el catálogo siguió creciendo durante la migración y los triggers eliminaron la carrera entre backfill e ingesta.

Los tokens de país menos frecuentes que no están todavía en el diccionario permanecen en `country_normalization_issues` y conservan el valor legacy original. Esto permite ampliar el diccionario sin pérdida de información.

## Lecturas de aplicación

Desde los commits V3 del 19/08/2026:
- Catálogo obtiene país y géneros desde la capa canónica, con fallback legacy durante transición.
- el filtro de género usa el vocabulario canónico.
- ficha de título consume país/géneros canónicos.
- Dashboard agrupa géneros y países mediante las relaciones canónicas, eliminando duplicados de idioma/código.

## Regla de retirada legacy

No eliminar `movies.country` ni `movie_genres` hasta que todas las rutas, workers y validaciones V3 dependan de la capa canónica y exista una decisión explícita de retirada. La transición debe ser reversible y sin pérdida de funcionalidad V2.
