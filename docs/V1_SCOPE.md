# PikoFilm V1 — alcance funcional

## Principio rector

PikoFilm no es una plataforma de streaming. Es una herramienta para decidir qué incorporar a Plex, correlacionar el catálogo deseado con la biblioteca real y auditar la integridad/calidad de Plex.

## 1. Inicio / Centro de control

Resumen operativo de:

- títulos del catálogo seleccionado;
- presentes y ausentes en Plex;
- títulos marcados como en proceso;
- incidencias de películas pendientes;
- series con incidencias;
- episodios disponibles que faltan;
- elementos Plex sin cruce fiable.

## 2. Catálogo

Buscador y filtros por tipo, año, género, puntuación, votos, duración, país y estado.

Estado visible en todo momento:

- Falta
- En proceso
- En Plex

La ficha debe incluir título español/original, año, duración, géneros, país, sinopsis, carátula/fondo, puntuación global e IMDb/FilmAffinity/TMDb, votos, reparto principal, colección/saga, enlaces de referencia y situación en Plex.

## 3. Plex

Inventario real de Plex separado conceptualmente del catálogo deseado.

Debe permitir distinguir:

- contenido que cruza con el catálogo;
- contenido Plex fuera del catálogo;
- contenido activo/inactivo;
- resolución y datos de fichero disponibles;
- elementos con cruce dudoso.

## 4. Calidad de películas

Motor específico para largometrajes:

- identificación dudosa o incorrecta;
- duplicados;
- película esperada pero ausente;
- calidad/resolución problemática;
- inconsistencias de metadatos;
- colecciones/sagas incompletas.

## 5. Calidad de series

Motor separado del de películas.

Jerarquía: serie → temporada → episodio.

Estados funcionales objetivo por episodio:

- presente y correcto;
- disponible en España y faltante;
- todavía no disponible en España;
- dudoso;
- identificación/numeración incorrecta;
- especial o excepción controlada.

Una serie puede estar incompleta globalmente y estar "al día" si todos los episodios ya disponibles en España están presentes.

La V1 debe aprovechar `series_reference`, `series_reference_episodes` y `series_diagnostics`. La disponibilidad efectiva en España se tratará como dato de dominio propio y no se inferirá únicamente de la fecha de emisión internacional.

## 6. Sagas / colecciones

Para cada colección:

- títulos que están en Plex;
- títulos seleccionados que faltan;
- títulos en proceso;
- porcentaje de completitud.

Los universos complejos quedan fuera de V1.

## Fuera de V1

- automatización de descargas;
- modificación automática de Plex;
- GitHub Actions;
- workflows programados;
- despliegues automáticos a Vercel;
- procesos masivos lanzados desde la interfaz;
- recomendaciones con IA;
- universos cinematográficos avanzados.

## Política de despliegue

Durante el desarrollo no se conecta el repositorio nuevo a despliegues automáticos. Se construye y revisa la V1 y se realiza un único despliegue controlado para pruebas de usuario. Las mejoras posteriores se gestionan mediante issues y se agrupan antes de nuevos despliegues.
