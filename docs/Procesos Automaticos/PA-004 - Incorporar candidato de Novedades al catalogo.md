# PA-004 — Incorporar candidato de Novedades al catálogo

## 1. Identidad
- **ID:** PA-004
- **Backend:** `enrichNewsCandidateAction`
- **Tipo:** manual bajo demanda
- **Unidad:** 1 candidato
- **pipeline job:** `single_title`, source `news`

### Puntos de entrada
- Novedades → candidato elegible → **＋ Añadir**.

## 2. Objetivo
Convertir un candidato de `catalog_candidates` en un título real de `movies` y ejecutar el enriquecimiento completo.

## 3. Flujo
1. Valida IMDb ID.
2. Si ya existe en `movies`, redirige a su ficha.
3. Carga el candidato y determina si procede de alta manual o discovery.
4. Comprueba si existe identidad mínima (título real + tipo reconocido).
5. Crea `pipeline_runs(single_title, source=news)` en etapa `adapter`.
6. Inserta una fila staging en `movies` con origen `imdb_discovery` e `inclusion_origin` manual/discovery.
7. Ejecuta `enrichTitle(imdbId)`.
8. Si completa, elimina `staging`, marca candidato `catalogued` y registra éxito/auditoría.
9. Si falla pero había identidad mínima, conserva alta parcial y marca el run como `success` con error y `stage=partial`.
10. Si falla sin identidad mínima, elimina staging, devuelve candidato a `eligible` y marca run `failed`.

## 4. Fuentes
Hereda las fuentes del enriquecimiento: TMDb, IMDb/ratings disponibles, FilmAffinity y Wikidata según `enrichTitle`.

## 5. Volumen
- 1 candidato por ejecución.
- Sin lote ni concurrencia propia.

## 6. Controles
- Validación IMDb.
- Evita duplicado en `movies`.
- Staging reversible.
- Alta parcial si existe identidad mínima.
- Auditoría de `catalogue` / `catalogue_partial`.
- `pipeline_runs` completo.
- No hay retry automático.

## 7. Persistencia
`movies`, tablas de enriquecimiento asociadas y `catalog_candidates` (`catalogued`/`eligible`).

## 8. Salida visual
Redirige a la ficha de Catálogo en éxito o parcial; en fallo vuelve a Novedades con `notice=enrich_error`.

## 9. Admin
Alta: aparece como `single_title` con source `news` y deja `admin_events`.

## 10. Recuperación
La identidad mínima permite conservar una ficha parcial; sin ella se revierte el staging y el candidato sigue disponible para reintentar.

## 11. Evaluación
- Trazabilidad: alta.
- Recuperación: buena.
- Estado parcial: existe pero se clasifica como `success`.
- Información de progreso: baja.

## 12. Pendientes de diseño
1. Estado explícito `partial`.
2. Homogeneizar PA-004 con PA-001, ya que ambos usan `enrichTitle` pero tienen adaptadores/orígenes distintos.
3. Mejorar detalle visual del resultado y fuentes fallidas.