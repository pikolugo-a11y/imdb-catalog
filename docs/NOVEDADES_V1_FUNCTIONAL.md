# PikoFilm — Novedades V1 · Especificación funcional

## Objetivo
Novedades mantiene vivo el catálogo después de la carga inicial: detecta candidatos IMDb y permite decidir incorporar, excluir o retirar sin mezclarlos antes de tiempo con el catálogo editorial.

## Elegibilidad
IMDb rating/votos decide la entrada automática. TMDb/FilmAffinity/Wikidata enriquecen después o resuelven país selectivamente para rescate España.

Criterios iniciales: películas generales 6,0/10.000; series 7,0/5.000; películas ES 6,0/7.500; series ES 6,5/4.000. India (`Q668`,`IN`) excluida inicialmente de forma configurable.

## Candidatos
Automáticos: pueden entrar/salir según criterios. Manuales: cualquier `tt...`, permanecen hasta Añadir/Excluir/Retirar. Ya catalogado no duplica; excluido exige restauración explícita.

## Excluidas
Excluir reutiliza `catalog_exclusions`. Novedades muestra acceso visible `Excluidas` con contador y Catálogo muestra `Ver excluidas` de forma prominente. Restaurar es explícito y reversible.

## Añadir al catálogo
Reutiliza el enriquecedor canónico. Si existe identidad mínima IMDb fiable, una fuente secundaria ausente **no bloquea el alta**: se cataloga con los datos disponibles, desaparece de Novedades y Calidad/Identidad muestra lo pendiente para reintento. Solo identidad mínima insuficiente o integridad insegura conserva el candidato sin catalogar. Regresión: `tt38268282`.

## Ejecución
Discovery **solo manual**. Sin cron, sin polling, sin cola `pending` desde la web. GitHub Actions admite únicamente `workflow_dispatch`; el worker impone máximo una ejecución exitosa cada 7 días y bloquea antes de procesar datasets. Novedades muestra próxima fecha permitida; cuando está permitido, `Buscar novedades ahora` abre el workflow manual. Guardar criterios nunca dispara discovery.

## UX
Vista compacta: KPIs en una fila, toolbar de alta manual/filtros, tabla densa y acciones directas `Ver`, `IMDb`, `Añadir`, `Excluir` (`Retirar` en manuales). Ficha de candidato `/novedades/[imdbId]`. Paginación 24/48/96. Responsive.

## Rendimiento
Render desde Neon. Worker streaming gzip: ratings → basics → país selectivo → upserts por lotes. Sin scraping ni enriquecimiento masivo en render.

## Trazabilidad
`pipeline_runs.job_type='imdb_discovery'` registra ejecuciones/cooldown. `single_title` distingue enriquecimiento completo, parcial o fallo de identidad. `admin_job_requests` no es ejecutor del discovery actual.

## Aceptación
La implementación no se considera aceptada hasta deployment manual y pruebas del usuario. #29/#38/#41/#42/#43 permanecen abiertas hasta PASS explícito.
