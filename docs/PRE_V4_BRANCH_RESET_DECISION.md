# PikoFilm — PRE-V4 · Decisión de reinicio de ramas

Fecha: 2026-09-02

## Decisión del propietario

Para las nuevas versiones se quiere partir de cero respecto al histórico de ramas experimentales. No se conservarán ramas por valor histórico, experimentos, ideas o lógica antigua. Una rama sólo debe conservarse si borrarla puede afectar al funcionamiento actual.

## Comprobación de dependencias vivas

### Railway
Proyecto `PikoFilm Batch` auditado en producción. Los cuatro servicios actuales apuntan a `pikolugo-a11y/imdb-catalog` rama `main`:

- `pikofilm-batch-plex-worker-v2` → `main`
- `pikofilm-batch-fast-worker-v1` → `main`
- `pikofilm-technical-snapshot-worker-v1` → `main`
- `pikofilm-worker-api-v3` → `main`

Por tanto, ninguna rama histórica es necesaria para el runtime actual de Railway.

### Vercel
Proyecto canónico `imdb-catalog` auditado. El despliegue de producción actual está asociado al proyecto canónico y existe alias `imdb-catalog-git-main-piko-film.vercel.app`, consistente con `main` como rama de producción. No se ha encontrado evidencia de que una rama histórica sea necesaria para servir el frontend actual.

### GitHub Actions
El workflow `ci.yml` escucha pull requests a `main` y también a `develop`. La referencia a `develop` es sólo una regla de CI para PRs, no una dependencia del funcionamiento de producción. Si `develop` se retira, conviene simplificar posteriormente `ci.yml` para dejar sólo `main`.

## Política resultante

- CONSERVAR: `main`.
- CONSERVAR TEMPORALMENTE: `pre-v4-readiness` mientras PRE-V4 siga abierto.
- BORRAR: todas las demás ramas, incluidas las que tienen commits exclusivos, porque el propietario ha decidido no conservar experimentos ni lógica histórica y no hay dependencia viva demostrada de Railway/Vercel sobre ellas.

## Frontend Safety Gate

El borrado de una referencia de rama GitHub que no está desplegada ni utilizada como fuente de runtime no cambia el árbol de `main`, no cambia botones/rutas/API actualmente desplegados, no cambia Railway y no modifica Neon. Por tanto, para el borrado de las refs históricas el gate operativo es `NO` respecto al frontend actual.

## Excepción operativa

La herramienta GitHub disponible en esta sesión no expone una acción para eliminar referencias de ramas. La clasificación está lista, pero la eliminación física debe hacerse manualmente en GitHub o con una herramienta/CLI con permiso de borrar refs.
