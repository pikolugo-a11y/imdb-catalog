# PikoFilm — PRE-V4 · Auditoría DBMIG-001

Fecha: 2026-09-02  
Rama: `pre-v4-readiness`

## Riesgo que se estaba vigilando

Existía la duda de si `.github/workflows/neon-branch-first-migrations.yml` podía aplicar migraciones de producción en **cualquier push a `main`**, lo que habría convertido commits de código/infra en un riesgo DDL involuntario.

## Evidencia del workflow actual

El workflow tiene `paths` tanto para `pull_request` como para `push`:

```yaml
pull_request:
  branches: [main]
  paths:
    - 'db/migrations/*.sql'
push:
  branches: [main]
  paths:
    - 'db/migrations/*.sql'
```

Además, en `push` sólo aplica a producción las migraciones nuevas/modificadas detectadas por `git diff` bajo `db/migrations/*.sql`.

## Conclusión

**DBMIG-001 queda rebajado/cerrado como riesgo general de push.** Un commit a `main` que modifique únicamente Dockerfiles, workers, frontend, documentación u otro código fuera de `db/migrations/*.sql` no dispara este workflow por sus filtros de ruta.

Por tanto, los hotfixes productivos de Plex:

- `8aa8db3526b1922042ce79321f0cb46c06036219`
- `47a4a521f9997b3838b160ad02ffc027d5c35d9c`

modificaron `Dockerfile.batch-plex` y **no cumplen el filtro de ruta del workflow de migraciones**.

## Riesgo que sí permanece

Un push/merge a `main` que añada o modifique un fichero `db/migrations/*.sql` sí puede:

1. crear rama Neon efímera;
2. aplicar allí la migración y smoke test;
3. en evento `push`, aplicar esa misma migración a `DATABASE_URL` de producción.

Esto no es un disparo accidental por cualquier commit: es la política explícita actual para cambios SQL de esa carpeta. Debe mantenerse visible en cualquier futura revisión de gobernanza de migraciones.

## Regla PRE-V4

- Código no SQL: DBMIG-001 no bloquea por sí solo un futuro merge/push.
- Cambios en `db/migrations/*.sql`: requieren revisión específica de migración y de su efecto productivo antes de mergear.
- No modificar el workflow durante PRE-V4 sin una decisión explícita sobre la política futura de migraciones.
