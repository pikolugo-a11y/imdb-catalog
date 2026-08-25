# PikoFilm — Roadmap de Funcionalidades

**Fecha:** 25/08/2026  
**Objetivo:** evoluciones futuras que aumenten el valor de PikoFilm como base de datos/gobierno audiovisual.  
**Restricción permanente:** no implementar reproducciones, progreso, visto/no visto ni historial de consumo; eso pertenece a Plex.

## Estado del roadmap
Este documento mezcla funcionalidades pendientes con ideas que ya han sido parcial o totalmente implementadas. Antes de cada nuevo ciclo debe revisarse el estado real del código y de Neon; la presencia de una idea aquí no implica que siga pendiente.

## Líneas existentes a conservar / revisar
Se mantienen como áreas de evolución: historial de lifecycle y auditoría por título; explicación, calibración y versionado de PikoScore; salud/cuotas de APIs; identidad y corrección de duplicados; calidad/frescura de metadata; PikoQuality por componente y por época; evolución de Series; Sagas y Personas como fuentes de descubrimiento; Discovery y exclusiones; salud y mantenimiento de Neon; consistencia Catálogo↔Plex y derivados; resumen de cambios tras Plex Sync; métricas globales y pruebas de regresión desde Admin.

## Investigación futura — necesidades detectadas en la comunidad Plex (25/08/2026)
Estas propuestas se añaden para **estudiar**, no para implementar todavía. Surgen de revisar peticiones y problemas repetidos de usuarios de Plex y herramientas de su ecosistema. Deben evaluarse contra las capacidades actuales de PikoFilm antes de abrir desarrollo.

### A. Centro de almacenamiento y duplicados — prioridad de estudio MUY ALTA
Objetivo: convertir los datos físicos de Plex/PikoQuality en una vista de optimización de almacenamiento.

Propuesta:
- tamaño total de la biblioteca y distribución por calidad/tipo;
- detectar películas con varios archivos/versiones;
- separar duplicado real de edición legítima;
- estimar espacio potencialmente recuperable, sin borrar automáticamente;
- comparar 1080p/4K, bitrate, HDR, audio, codec, tamaño y PikoQuality;
- recomendar qué copia merece conservarse técnicamente, siempre como recomendación;
- enlazar con ficha y PikoQuality para justificar la decisión.

Principio: **nunca considerar duplicadas dos ediciones diferentes solo porque compartan IMDb**.

Relación con roadmap previo: amplía Comparador de versiones físicas, Gestión de montajes/ediciones y Oportunidades de mejora técnica.

### B. Health Check integral de biblioteca — prioridad de estudio MUY ALTA
Objetivo: responder a “¿está sana mi biblioteca Plex?” además de “¿qué tengo?”.

Propuesta:
- anomalías de resolución/bitrate/codec;
- archivos potencialmente incompletos o técnicamente sospechosos;
- pistas de audio esperables ausentes;
- idioma original/español cuando proceda;
- subtítulos españoles/forced ausentes o inconsistentes;
- incoherencias entre episodios de una temporada;
- fingerprint cambiado sin revalidación técnica;
- unificar los hallazgos existentes de Identidad, Plex y PikoQuality en un panel de salud accionable.

No duplicar Bazarr/Subarr ni descargar subtítulos: PikoFilm audita y explica; otras herramientas ejecutan la adquisición/corrección si se decide integrar en el futuro.

### C. Ediciones y versiones como entidad de primer nivel — prioridad ALTA
Objetivo: evolucionar de `película → archivo` a `película → edición → archivo/versiones` cuando Plex y las fuentes permitan identificarlo con suficiente confianza.

Casos: Theatrical, Director's Cut, Extended, Unrated, Final Cut, Remastered y versiones alternativas de series.

Propuesta:
- inventario de ediciones presentes;
- evitar falsas alertas de duplicados;
- comparar PikoQuality entre versiones de la misma edición;
- indicar ediciones relevantes ausentes solo cuando exista una fuente fiable;
- conservar varias ediciones legítimas sin penalización de almacenamiento/duplicidad.

Relación con roadmap previo: evolución de Gestión explícita de montajes/ediciones.

### D. Calendario inteligente / Próximamente — prioridad ALTA
Objetivo: centralizar cuándo un faltante debe empezar realmente a exigirse.

Propuesta:
- próximos estrenos de películas y episodios;
- fecha de cine/TV/streaming/digital cuando esté disponible;
- estados `PRÓXIMAMENTE → NO EXIGIBLE → DISPONIBLE → PENDIENTE`;
- aprovechar la lógica ya creada para miembros recientes de Sagas;
- evitar que Sagas, Personas y Series penalicen cobertura operativa por contenido todavía no razonablemente disponible;
- vista calendario/listado con próximos cambios de estado.

Relación con roadmap previo: Discovery de próximos estrenos, Series: fecha de disponibilidad estimada y exclusiones temporales.

### E. Universos / colecciones transversales — prioridad MEDIA/ALTA
Objetivo: un nivel superior a Saga TMDb que pueda agrupar películas y series relacionadas aunque no formen una colección oficial única.

Ejemplos conceptuales: universos cinematográficos, franquicias que mezclan películas/series, ciclos definidos manualmente.

Propuesta:
- total relevante;
- en Plex;
- pendientes;
- próximos/no exigibles;
- cobertura;
- PikoScore agregado cuando tenga sentido;
- composición manual primero y posible asistencia automática después.

Relación con roadmap previo: Sagas: universos editoriales manuales.

## Criterio de priorización de esta investigación
1. **Almacenamiento + duplicados** — valor potencial 10/10, reutiliza Plex/PikoQuality.
2. **Health Check integral** — valor potencial 9,5/10, reutiliza gran parte del pipeline actual.
3. **Ediciones/versiones** — valor potencial 9/10 y necesario para que duplicados sea fiable.
4. **Calendario/Próximamente** — valor potencial 9/10, reutiliza Lifecycle y disponibilidad.
5. **Universos/colecciones** — valor potencial 8/10, reutiliza Sagas.

## Regla para el próximo desarrollo
Estas cinco ideas quedan **apuntadas para estudiar**. No iniciar implementación hasta estabilizar el trabajo actual de Personas/filmografías y revisar qué parte de cada propuesta ya cubre el modelo existente.
