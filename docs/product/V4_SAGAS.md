# PikoFilm — Sagas V4

Estado: **contrato funcional canónico aprobado**.

## Propósito

Sagas es la superficie de PikoFilm para comprender colecciones cinematográficas, su composición y su presencia física en Plex. No gestiona visionado, progreso de consumo, visto/no visto, recomendaciones ni hábitos de reproducción.

TMDb define el universo de miembros de una colección. PikoFilm decide qué títulos forman parte de su catálogo maestro. Plex indica presencia física real.

## Contratos funcionales

1. **Colección, no consumo.** Los estados describen presencia física: `Completa en Plex`, `Parcial en Plex` y `Sin Plex`. No se utiliza lenguaje como `Sin empezar` o `En progreso` que sugiera visionado.
2. **Completitud.** El denominador sólo contiene títulos admitidos en PikoFilm y exigibles físicamente en ese momento. Una película fuera de PikoFilm, futura o todavía en ventana cinematográfica no convierte una saga en incompleta.
3. **Prioridad predeterminada.** El listado ordena por utilidad: a una película de completar → parciales → completas → sin Plex. Dentro de cada grupo, PikoScore/relevancia ayuda a priorizar.
4. **Disponibilidad.** Se distinguen `Próximamente`, `En cines` y `Disponible/exigible`. Una película futura o todavía sin disponibilidad doméstica no penaliza la saga.
5. **Fuera de PikoFilm.** Los miembros TMDb no admitidos se muestran como descubrimiento. Pueden enviarse a Novedades, pero nunca se admiten automáticamente ni cuentan contra Plex antes de su admisión.
6. **Ficha de saga.** Muestra identidad, periodo, PikoScore agregado, estado físico global y filmografía cronológica completa. Cada miembro se etiqueta como `En Plex`, `Sin Plex`, `Fuera de PikoFilm`, `En cines` o `Próximamente`. Los títulos del catálogo abren Ficha; los externos pueden ir a Novedades.
7. **PikoScore de saga.** Es independiente de Plex y sólo agrega obras admitidas y actualmente exigibles. Futuras, ventana de cine y títulos fuera de PikoFilm no participan.

## Disponibilidad doméstica

La regla de producto distingue estreno cinematográfico de disponibilidad doméstica. El modelo persistido actual no dispone todavía de una fecha canónica de lanzamiento digital/físico separada para todas las películas. Sagas V4 aplica por tanto un **fallback conservador de 90 días desde `movie_metadata.release_date`** cuando el título no está ya en Plex:

- fecha futura o estado TMDb distinto de `released` → `Próximamente`;
- estrenada hace menos de 90 días y aún no está en Plex → `En cines` / no exigible;
- después de esa ventana → disponible y exigible;
- si Plex ya contiene el título, la presencia física demuestra disponibilidad y prevalece sobre el fallback.

Este fallback pertenece al read model de Sagas y debe sustituirse por una fecha doméstica canónica cuando el dominio de Datos la persista; no debe provocar llamadas externas durante render.

## Listado `/sagas`

- lista/tabla como vista principal de base de datos;
- 50 resultados por página;
- búsqueda persistida en URL;
- filtros: Todas, A una película, Parciales, Completas, Sin Plex;
- orden predeterminado `Prioridad de colección`;
- alternativas: PikoScore, presencia Plex, menos pendientes y nombre;
- métricas visibles: estado, En Plex/exigibles, faltantes, PikoScore, disponibilidad no exigible, fuera de PikoFilm y periodo;
- en iPhone la tabla se convierte en lista compacta, no en tarjetas editoriales grandes.

## Ficha `/sagas/[collectionId]`

La composición es cronológica por año/posición TMDb. La ficha no duplica la Ficha audiovisual con sinopsis largas, reparto o datos enciclopédicos. Su pregunta principal es: **qué compone esta colección, qué está físicamente en Plex, qué falta y qué todavía no es exigible**.

Se conserva `Actualizar esta saga` como acción explícita para refresco exacto. La navegación normal nunca dispara TMDb ni fanout externo.

## Actualización y operación

- lectura: sólo Neon/read models persistidos;
- actualización individual: acción explícita `Actualizar esta saga`;
- actualización global: `PROC-SAGA-001` mediante Batch Engine/Railway, sin límite funcional de 120 colecciones;
- progreso y controles pausar/reanudar/cancelar permanecen visibles en Sagas y Operaciones;
- la identidad IMDb de cada miembro se valida canónicamente contra TMDb durante refresco;
- miembros TMDb externos sólo entran al catálogo a través de Novedades.

## No objetivos

Sagas V4 no incorpora seguimiento de visionado, progreso, recomendaciones, auto-admisión, llamadas externas durante render ni una reescritura del backend de Batch Engine.