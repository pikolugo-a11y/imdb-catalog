# PikoFilm 2.0

Centro de selección, correlación y control de calidad para una biblioteca Plex.

## Objetivos

1. Mantener un catálogo curado de películas y series seleccionables para incorporar a Plex.
2. Correlacionar el catálogo deseado con la biblioteca Plex real.
3. Auditar Plex: identificaciones, ficheros, películas/sagas faltantes y series episodio a episodio.

Películas y series comparten catálogo y cruce Plex, pero **no comparten motor de diagnóstico**. En series, un episodio técnicamente ausente solo pasa a ser faltante real cuando existe evidencia de disponibilidad en España.

## V1

- Inicio / centro de control
- Catálogo con filtros, ficha y estado `Falta / En proceso / En Plex`
- Plex: inventario y elementos fuera de catálogo
- Calidad de películas: cola de revisión resoluble
- Calidad de series: temporada/episodio y disponibilidad efectiva ES
- Sagas: completitud y detalle título a título
- Administración: historial de procesos y sincronizaciones

## Seguridad operativa

GitHub contiene código, no el catálogo masivo. Neon es la fuente de verdad. Vercel sirve la aplicación.

Actions permitidos en V1:
- CI de PR: build, solo lectura, timeout 10 min y concurrencia cancelable.
- Mantenimiento manual: `workflow_dispatch`, solo lectura, timeout 5 min y máximo 10 elementos.

No hay cron, no hay workflows que hagan commits, no hay reintentos infinitos y no se usa Actions como motor de procesamiento masivo. `vercel.json` mantiene `git.deploymentEnabled=false`, por lo que los commits no provocan deployments automáticos.

Los despliegues se hacen manualmente y agrupados. Los procesos pesados futuros deberán ser explícitos, limitados, auditables y separados del ciclo Git → Vercel.

## Arquitectura

`Web PikoFilm / Vercel → Neon PostgreSQL`

Los procesos pesados futuros podrán consumir trabajos registrados en Neon, sin generar commits ni deployments.
