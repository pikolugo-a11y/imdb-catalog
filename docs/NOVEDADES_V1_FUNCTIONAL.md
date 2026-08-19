# PikoFilm — Novedades V1 · Especificación funcional

## Objetivo
Novedades mantiene vivo el catálogo después de la carga masiva inicial. Su responsabilidad es detectar títulos que ahora cumplen los criterios IMDb o que el usuario desea incorporar manualmente, sin mezclarlos todavía con el catálogo editorial definitivo.

## Principio de entrada
IMDb es la fuente de elegibilidad. Rating y votos IMDb determinan si un título entra automáticamente en Novedades. TMDb, FilmAffinity y Wikidata no alteran ese criterio; se usan después para enriquecimiento y, de forma selectiva, para resolver el país cuando una candidatura depende de una regla territorial.

## Criterios iniciales
- Películas generales: IMDb >= 6,0 y >= 10.000 votos.
- Series/miniseries generales: IMDb >= 7,0 y >= 5.000 votos.
- Películas con participación española: IMDb >= 6,0 y >= 7.500 votos.
- Series/miniseries con participación española: IMDb >= 6,5 y >= 4.000 votos.
- India permanece excluida globalmente de forma configurable.

Los valores son editables desde `Novedades > Criterios IMDb` y no requieren cambios de código.

## Descubrimiento automático
El discovery recorre datasets oficiales IMDb. Un título solo se propone si no está ya en `movies`, no está en `catalog_exclusions` y no pertenece a un país globalmente excluido.

La regla española funciona como rescate: si una obra ya cumple el criterio general no necesita nacionalidad para decidir la elegibilidad; solo se resuelve país cuando falla el criterio general pero podría cumplir la regla española. Una coproducción cuenta como española si España participa en la producción.

## Estados visibles
Novedades distingue tres motivos de entrada:
- Cumple criterio general.
- Rescate España.
- Añadido manualmente.

Los candidatos automáticos pueden dejar de ser elegibles si cambian rating/votos. Los manuales no desaparecen por fluctuaciones IMDb.

## Añadir IMDb manualmente
El usuario puede introducir cualquier `tt...` válido aunque no cumpla los umbrales. Si ya está en Catálogo se informa y no se duplica. Si está excluido se exige una restauración explícita; la exclusión nunca se levanta silenciosamente. Si es nuevo queda visible como candidato manual hasta incorporarlo, excluirlo o retirarlo.

## Excluir desde Novedades
Excluir reutiliza `catalog_exclusions`. El título desaparece de Novedades, deja de proponerse y queda consultable/restaurable en la vista normal de Excluidas. No existe una segunda lista paralela de rechazados.

## Añadir y ampliar datos
La acción reutiliza el pipeline individual existente. El candidato se adapta temporalmente al contrato del enriquecedor, se obtienen los datos de TMDb/Wikidata/FilmAffinity y se persiste en el Catálogo. Al existir ya en `movies`, desaparece naturalmente de Novedades por el anti-join. Si el enriquecimiento falla, el candidato permanece disponible para reintento y no queda una fila parcial en Catálogo.

## Ejecución
El discovery no se ejecuta dentro de la petición web. `Buscar novedades ahora` encola una solicitud; un worker GitHub Actions la recoge. También existe una ejecución automática diaria. La UI muestra última ejecución y última solicitud.

## Rendimiento
La página lee exclusivamente datos persistidos en Neon. El worker filtra primero `title.ratings.tsv.gz`, cruza después `title.basics.tsv.gz`, usa streaming gzip, escrituras por lotes y resuelve país solo para candidatos potenciales. No hay scraping IMDb ni enriquecimiento masivo durante el render.

## Trazabilidad
Cada ejecución crea un `pipeline_runs.job_type='imdb_discovery'` con métricas de filas examinadas, preselección, candidatos, rescates españoles, países excluidos, pendientes de país y duración. Las solicitudes manuales viven en `admin_job_requests`.

## Criterios de aceptación
1. Un título nuevo que supera los criterios aparece sin scraping.
2. Un título antiguo puede aparecer cuando alcanza hoy los umbrales.
3. España dispone de reglas propias.
4. India no aparece mientras siga excluida.
5. Catálogo y Excluidas siempre prevalecen sobre Novedades.
6. La exclusión desde Novedades es reversible en el sistema global.
7. Se permite cualquier IMDb manual válido.
8. Un manual no depende de rating/votos.
9. El enriquecimiento reutiliza el pipeline existente.
10. El discovery es batch, auditable e idempotente.
