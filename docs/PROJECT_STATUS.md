# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 20/08/2026 (Europe/Madrid)  
**Fase:** evolución UX V3 — Mi Biblioteca validada visualmente; corregido contrato de alta parcial Plex → Catálogo; pendiente deployment/aceptación funcional  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar trabajo funcional antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Hito Mi Biblioteca
`/plex` funciona como bandeja de entrada de elementos activos presentes en Plex y todavía ausentes del catálogo. La vista visual fue validada por el usuario el 20/08.

Incluye:
- tabla compacta;
- filtros Todos / Películas / Series, búsqueda y año;
- acción directa **Añadir al catálogo**;
- sin IMDb → **Resolver identidad**;
- sin ficha intermedia;
- última sincronización + **Actualizar Plex**;
- `added_at` rotulado **Añadido a Plex**;
- estado normal redundante eliminado;
- resumen superior compacto;
- estado vacío `Todo al día`.

## Incidencia detectada y corregida — alta parcial desde Plex
Caso de regresión: `tt5901280` / The River, Plex rating key `156271`.

Producción antes del fix:
- Plex aporta IMDb válido `tt5901280`, título `The River`, tipo `movie`;
- no existe todavía en `movies`;
- TMDb no encuentra el título;
- `processTitle()` propagaba el error y bloqueaba completamente el alta.

Contrato correcto ya implementado en `main`:
- `processTitle()` obtiene identidad mínima desde Plex antes de enriquecer;
- crea staging mínimo en `movies` con origen `plex_manual`;
- ejecuta `ensureImdbRating()` best-effort + `enrichTitle()` canónico;
- si TMDb/FA/otra fuente secundaria falla, conserva el título catalogado, marca `source_status.partial=true`, `enrichment_status='pending'`, guarda el error y deja trazabilidad `plex_catalogue_partial`;
- la fila debe desaparecer de Mi Biblioteca porque ya existe en Catálogo;
- Calidad → Identidad debe mostrarlo por `tmdb_id IS NULL` y permitir reintento;
- solo se elimina staging si no existía identidad mínima fiable.

Commit de código del fix: `3d93aa1b7f961e24bbdebf97d351bc87ca8cde1f`. Después se actualizaron especificaciones y esta bitácora; desplegar siempre el HEAD final de `main`.

## Pendiente de aceptación
1. Usuario realiza deployment manual del HEAD actual de `main`.
2. Verificar técnicamente que producción corresponde al HEAD esperado.
3. Prueba funcional principal: en Mi Biblioteca, pulsar **Añadir al catálogo** sobre `tt5901280`.
   - Esperado: mensaje de alta parcial, no error bloqueante.
   - Esperado: The River desaparece de Mi Biblioteca.
   - Esperado: aparece en Catálogo con datos mínimos Plex/IMDb.
   - Esperado: aparece en Calidad → Identidad como `missing_tmdb`.
4. Verificar en Admin/pipeline que el run termina como `success` con `stage='partial'`, `errors=1`, y existe audit `plex_catalogue_partial`.
5. Regresión: un título Plex cuyo TMDb sí existe sigue enriqueciendo completamente y desaparece igualmente de Mi Biblioteca.

## Próximo paso exacto
Usuario despliega manualmente el HEAD actual de `main`. Después ChatGPT verifica el commit desplegado y conduce primero la prueba `tt5901280`.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits de `main`.
