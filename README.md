# PikoFilm 2.0

Centro de selección, correlación y control de calidad para una biblioteca Plex.

## Objetivos prioritarios

1. Mantener un catálogo curado de películas y series seleccionables para incorporar a Plex.
2. Correlacionar ese catálogo con el contenido real de Plex.
3. Auditar la calidad de Plex y detectar errores de identificación, títulos faltantes y problemas de integridad.

## Películas y series

Los dos dominios comparten catálogo y cruce con Plex, pero tienen motores de diagnóstico diferentes.

- **Películas:** identificación, presencia, duplicados, calidad/resolución, colecciones y títulos faltantes.
- **Series:** serie → temporada → episodio, episodios presentes/faltantes, identificación, numeración, duración y disponibilidad efectiva en España.

Una serie puede estar incompleta globalmente y, a la vez, estar completamente al día respecto a los episodios disponibles en España.

## V1

Navegación principal prevista:

- Inicio
- Catálogo
- Plex
- Calidad
  - Películas
  - Series
- Sagas

Estados operativos del catálogo: `Falta`, `En proceso`, `En Plex`.

## Seguridad operativa

- Sin GitHub Actions en V1.
- Sin workflows automáticos.
- Sin conexión automática GitHub → Vercel durante el desarrollo.
- Los despliegues de Vercel serán manuales y agrupados.
- Neon es la fuente de verdad de datos; GitHub contiene código, no el catálogo masivo.
- La V1 observa, correlaciona y diagnostica Plex; no modifica automáticamente la biblioteca.

## Arquitectura

`Neon PostgreSQL → API PikoFilm → Web PikoFilm`

La vista `catalog_read_model` será el punto de partida del catálogo de lectura. Las funciones específicas de diagnóstico utilizarán las tablas especializadas de Plex y series.
