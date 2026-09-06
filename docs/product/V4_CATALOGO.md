# PikoFilm V4 — Catálogo

Estado: **canónico para la superficie Catálogo V4**.

## Responsabilidad

Catálogo es la superficie principal para consultar, localizar, filtrar y comparar las obras que pertenecen a la base audiovisual maestra de PikoFilm. No controla consumo, pendientes de visionado, recomendaciones ni progreso de Plex. Plex sólo aporta el estado físico `En Plex` / `Sin Plex` y PikoQuality cuando existe una copia evaluada.

## Navegación

La navegación interna es `Todo · Películas · Series · Sagas`. `Todo` mezcla películas y series; Sagas conserva un estado independiente y su rediseño pertenece a su propio vertical. `Excluidas` es una vista secundaria integrada en el contexto de Catálogo, no una pestaña equivalente.

## Vista y datos

- Vista inicial: lista/tabla. Carátulas es alternativa y su elección forma parte de la URL.
- Página: 50 obras, con filtrado, orden y paginación en servidor.
- Columnas de escritorio: `Título · Año · Tipo · Géneros · PikoScore · PikoQuality · Plex`.
- iPhone recompone la misma información en lista compacta, sin forzar una tabla horizontal.
- PikoScore es la única valoración visible. Ratings externos siguen siendo fuentes internas, no UI.
- PikoQuality procede del dominio canónico `piko_quality` / `piko_quality_aggregates`; ausencia de valor se representa con `—`.
- `Sin Plex` es un hecho descriptivo y neutral, nunca un warning ni un “pendiente de ver”.
- Lifecycle, estados internos de procesamiento y acciones masivas no se muestran en Catálogo.

## Filtros y orden

Filtros: búsqueda local, Plex, múltiples géneros y rango libre de años. La búsqueda cubre título mostrado, título original e IMDb ID, ignorando mayúsculas y acentos. Géneros soporta `Cualquiera` (OR) y `Todos` (AND). Un rango `desde > hasta` se valida y no ejecuta consulta.

Orden disponible: Título, Año y PikoScore. PikoScore es el orden inicial descendente. Los valores nulos permanecen al final. Los desempates son deterministas para que una misma URL produzca una paginación estable.

La URL conserva scope, filtros, orden, vista y página. Abrir una Ficha y volver debe recuperar exactamente ese estado. Cambiar filtro, búsqueda, orden o tipo reinicia a página 1; cambiar sólo Lista/Carátulas conserva la página.

## Excluidas y restauración

Excluidas muestra únicamente `Título · Año · Tipo · Fecha de exclusión · Restaurar`, con búsqueda local y 50 registros por página, orden fijo por fecha de exclusión descendente. Fechas desconocidas aparecen como `—` y ordenan al final. El título puede abrir su Ficha conservando búsqueda y página.

`Restaurar` no readmite directamente una obra al Catálogo. PROC-NOV-016 la convierte/reactiva como candidato de Novedades y mantiene el bloqueo de exclusión como guard técnico mientras espera decisión humana. La fila deja de aparecer en Excluidas, el usuario permanece en esa pantalla y recibe confirmación. Novedades puede mostrar el candidato restaurado aunque exista una fila histórica en `movies`; sólo PROC-NOV-007, tras la acción explícita de admisión del usuario, retira el guard de exclusión y readmite la obra. Entrar en Novedades nunca ejecuta esa admisión automáticamente.

Si la restauración falla, el guard no se retira, la obra sigue en Excluidas y la UI ofrece reintento sin falso éxito.

## Arquitectura de lectura

El render de Catálogo lee exclusivamente Neon. No ejecuta fuentes externas ni procesos funcionales. PikoQuality de película se une a la evaluación vigente cuyo fingerprint coincide con el snapshot técnico; para series se usa el agregado canónico de tipo `show`. No se añade tabla ni caché nueva para V4 Catálogo.

## Capacidad V3

Se conservan búsqueda, filtros Plex/género/año, ordenación relevante, paginación, vista de carátulas, PikoScore, acceso a Excluidas y restauración. Tipo se reubica en las pestañas Películas/Series. País, duración, votos y detalle operativo se reubican en Ficha. Ratings externos y estados Lifecycle se retiran de Catálogo por decisión explícita V4. La exclusión desde fila/tarjeta se reubica en Ficha y se resolverá en ese vertical.
