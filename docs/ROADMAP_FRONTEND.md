# PikoFilm — Roadmap de Frontal

**Fecha:** 22/08/2026  
**Objetivo:** mejoras de UX/UI detectadas al recorrer todas las pantallas actuales. No describe bugs de backend ni migraciones de código salvo cuando impactan directamente en la experiencia.

## Prioridad P0 — coherencia del flujo

### F01. Calidad como mapa real del lifecycle
**Pantalla:** `/calidad`  
Rehacer los contadores y bloques para que representen todas las fases actuales: Identidad, Validación, Datos, PikoScore, Validación de película, Series y PikoQuality. El usuario debe ver dónde está el trabajo sin interpretar estados técnicos.

### F02. Eliminar acciones masivas de la portada de Calidad
**Pantalla:** `/calidad`  
La portada debe navegar a colas unitarias, no ofrecer “Actualizar todo”, “Analizar películas” o “Actualizar todas”. Dejar únicamente contadores, explicación de etapa y acceso a la cola.

### F03. Paso físico de películas visible como fase propia
**Pantallas:** `/calidad`, `/calidad/peliculas`, `/calidad/pikoquality`  
Representar claramente `Validación de película → PikoQuality` como dos pasos consecutivos. Hoy el concepto “Técnica” agrupa demasiado y oculta por qué un título está en una pantalla u otra.

### F04. Series con la misma filosofía unitaria
**Pantalla:** `/calidad/series`  
Cada serie pendiente de referencia debe tener su propia acción “Preparar/Actualizar serie”. Quitar la dependencia visual de “Actualizar todas las series”.

### F05. PikoQuality: separar universo película de métricas globales
**Pantalla:** `/calidad/pikoquality`  
La cola superior es de películas `TECH_PENDING`, mientras parte de las métricas inferiores mezclan episodios. Separar visualmente “Trabajo pendiente de películas” de “Resumen técnico global/series” o mover este último a otra vista.

### F06. Dashboard enlazado al nuevo Novedades Plex
**Pantalla:** `/`  
Sustituir enlaces antiguos a `/plex?mode=uncatalogued` por `/novedades?source=plex` y renombrar “Plex fuera catálogo” a un concepto consistente con Novedades.

## Prioridad P1 — productividad diaria

### F07. Filtro por lifecycle en Catálogo
**Pantalla:** `/catalogo`  
Añadir filtro directo “Fase” para localizar Identidad, Datos, PikoScore, Películas, Series, PikoQuality o Complete. Es especialmente útil con >20.000 títulos.

### F08. Orden por urgencia del lifecycle
**Pantalla:** `/catalogo`  
Permitir ordenar por fase/antigüedad del bloqueo para encontrar los títulos que llevan más tiempo pendientes.

### F09. Stepper de lifecycle en la ficha
**Pantalla:** `/catalogo/[imdbId]`  
Mostrar una línea simple: Entrada → Identidad → Validación → Datos → PikoScore → Rama física → Complete. Marcar fase actual, completadas y motivo del bloqueo.

### F10. “Por qué está aquí” en todas las colas
**Pantallas:** Calidad/*  
Añadir junto al estado una explicación breve derivada de `blocking_reason`, evitando que el usuario tenga que inferir por qué un título no avanzó.

### F11. Feedback persistente de acciones unitarias
**Pantallas:** Identidad, Validación, Datos, Películas, PikoQuality, Series  
Después de una acción mostrar resultado, fuentes usadas, campos actualizados y siguiente estado. Mantener el mensaje visible aunque la fila desaparezca de la cola.

### F12. Navegación “siguiente caso”
**Pantallas:** colas de Calidad  
Tras completar un título, ofrecer “Ir al siguiente pendiente” sin automatizar el procesamiento. Reduce clics respetando la regla unitaria.

### F13. Datos: filtros operativos
**Pantalla:** `/calidad/datos`  
Añadir filtros por `Datos incompletos`, `Ratings caducados` y `Listos para PikoScore`, además de orden por cobertura, antigüedad de ratings y antigüedad de PikoScore.

### F14. Datos: mostrar fecha y hora
**Pantalla:** `/calidad/datos`  
Ahora se presenta principalmente fecha. Para pruebas y diagnóstico conviene mostrar fecha/hora de `ratings_refreshed_at` y `pikoscore_calculated_at`.

### F15. PikoScore explicable desde la ficha
**Pantalla:** ficha película/serie  
Añadir un panel desplegable con score, confianza, fecha, versión, notas usadas y modificador crítico. No hace falta mostrar matemática completa por defecto.

### F16. Identidad: destacar exactamente qué ID falta
**Pantalla:** `/calidad/identidad`  
Además del color, mostrar un texto compacto “Falta TMDb”, “Falta FA” o ambos. Facilita escaneo visual.

### F17. Validación de identidad: diferencias en lugar de evidencia plana
**Pantalla:** `/calidad/validacion-identidad`  
Resaltar solo diferencias de título/año entre fuentes y explicar qué factor bajó el score. Mantener el detalle completo disponible.

### F18. Películas: estado de análisis en tarjetas
**Pantalla:** `/calidad/peliculas`  
Diferenciar visualmente “Pendiente de analizar” y “Incidencia detectada”. Mostrar fingerprint abreviado/fecha de validación en un detalle técnico opcional.

### F19. Películas: confirmación clara de “Ya la corregí”
**Pantalla:** `/calidad/peliculas`  
Es una acción destructiva sobre referencias derivadas. Añadir confirmación que explique: “se retirará del Catálogo y volverá por Novedades tras Actualizar Plex; no se borra el archivo”.

### F20. PikoQuality: resultado antes de desaparecer
**Pantalla:** `/calidad/pikoquality`  
Mostrar toast persistente con score/banda y “ha pasado a Complete”. Evita la sensación de que el botón simplemente hizo desaparecer la fila.

### F21. Series: contadores lifecycle en lugar de vistas ambiguas
**Pantalla:** `/calidad/series`  
Mostrar claramente Por sincronizar / Revisión / PikoQuality pendiente / Al día. Mantener filtros de faltantes/extras dentro de la fase de revisión.

### F22. Serie detalle: acción de refresco unitario visible
**Pantalla:** `/calidad/series/[ratingKey]`  
Incluir “Actualizar esta serie” y feedback de referencia, disponibilidad y mapeos. Hoy la actualización depende demasiado de la pantalla general.

### F23. Serie detalle: distinguir dato oficial y decisión manual
**Pantalla:** detalle de serie  
En disponibilidad ES, indicar si el estado procede de fuente externa o fue fijado manualmente y cuándo.

## Prioridad P2 — claridad y consistencia

### F24. Novedades: estado visual más compacto
**Pantalla:** `/novedades`  
Unificar chips Origen/Estado y reducir textos “Resolviendo/Preparando” a estados coherentes con ayuda contextual bajo demanda.

### F25. Novedades: detalle de último error
**Pantalla:** `/novedades`  
Para filas `error` o `atascado`, ofrecer un desplegable con la última causa y acción recomendada sin obligar a ir a Admin.

### F26. Novedades: filtros en cabecera realmente uniformes
**Pantalla:** `/novedades`  
Mantener búsqueda global y filtros solo en columnas clave; ordenar directamente desde cabeceras. Revisar responsive para que no se dupliquen controles.

### F27. Criterios IMDb: simulación antes de guardar
**Pantalla:** `/novedades/criterios`  
Mostrar una estimación de cuántos candidatos actuales cumplirían cada regla antes de aplicar cambios. Solo lectura, sin ejecutar discovery.

### F28. Catálogo: acciones consistentes entre grid, tabla y ficha
**Pantallas:** `/catalogo`, ficha  
Alinear reglas de Excluir/En proceso en todas las vistas. En particular documentar/mostrar que excluir un título en Plex no elimina el archivo.

### F29. Excluidas: mostrar destino de restauración
**Pantalla:** `/catalogo/excluidas`  
Antes de restaurar indicar “volverá al Catálogo” o “volverá a Novedades”, para que la acción sea predecible.

### F30. Excluidas: motivo estructurado + texto libre
**Pantalla:** Excluidas  
Presentar motivos frecuentes como categorías (manual, error de identidad, no interesa, etc.) sin perder comentario libre. Mejora búsqueda y análisis.

### F31. Sagas: aclarar “en catálogo” vs “en Plex”
**Pantallas:** `/sagas`, detalle  
La cobertura debe dejar claro qué número representa miembros del catálogo y cuál archivos presentes en Plex. Evitar el término genérico “owned” en UI.

### F32. Personas: ordenar y filtrar filmografía
**Pantalla:** `/personas/[id]`  
Añadir orden por año/PikoScore y filtros por tipo, no solo presencia Plex.

### F33. Admin: lenguaje humano por defecto
**Pantalla:** `/admin`  
Mostrar resumen legible de cada evento y dejar JSON crudo bajo “Detalle técnico”. Actualmente demasiada información aparece como JSON directo.

### F34. Admin: búsqueda por IMDb/ratingKey
**Pantalla:** `/admin`  
Permitir localizar toda la traza de un título o archivo físico concreto.

### F35. Admin: filtros por subsistema/acción
**Pantalla:** `/admin`  
Además de status/job, filtrar `pikoscore`, `identity`, `movie_file_validation`, `pikoquality`, `plex`, etc.

### F36. Admin: información de retención
**Pantalla:** `/admin`  
Indicar que el histórico se limita y mostrar política vigente para que la ausencia de eventos antiguos no parezca pérdida accidental.

## Prioridad transversal

### F37. Sistema visual único
Consolidar botones, badges, tablas, cards, breadcrumbs, filtros, empty states y toasts. Actualmente conviven CSS V1/V2/V3 y estilos por pantalla.

### F38. Accesibilidad
Revisar contraste, foco visible, labels, `aria`, tablas responsive y botones de solo icono. Todas las acciones críticas deben ser accesibles con teclado.

### F39. Responsive de tablas operativas
Las colas son densas. En móvil priorizar Título → Estado → Acción y permitir desplegar datos secundarios, en lugar de scroll horizontal extremo.

### F40. Estados de carga unitarios
Todos los botones que consultan APIs deben mostrar “procesando”, bloquear doble clic y conservar el resultado final.

### F41. Enlaces de retorno consistentes
Preservar filtros/paginación al abrir una ficha desde Catálogo o Calidad y al volver.

### F42. Empty states útiles
Cuando una cola está vacía, explicar “todo al día” y cuál es la siguiente fase, no solo “sin resultados”.

### F43. Fechas y zonas horarias uniformes
Usar formato España consistente, distinguir fecha de detección, refresco, cálculo y validación, y mostrar hora cuando sea operativamente relevante.

### F44. Performance budget del frontal
Definir límites: ninguna página debe traer decenas de miles de filas para contar; usar `COUNT/GROUP BY`, paginar y evitar recalcular lifecycle al render.

## Orden sugerido

1. F01–F06: coherencia con arquitectura nueva.
2. F07–F23: productividad del flujo diario.
3. F24–F36: mejoras por pantalla.
4. F37–F44: consolidación transversal.

Este roadmap no implica implementar todo de una vez. Cada cambio debe conservar el principio de procesamiento unitario y la separación Catálogo/Plex/Novedades.