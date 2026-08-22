# PikoFilm — Roadmap de Funcionalidades

**Fecha:** 22/08/2026  
**Objetivo:** evoluciones futuras que aumenten el valor de PikoFilm como base de datos/gobierno audiovisual.  
**Restricción permanente:** no implementar reproducciones, progreso, visto/no visto ni historial de consumo; eso pertenece a Plex.

## 1. Historial de lifecycle por título
Guardar transiciones relevantes (`de → a`, fecha, causa, actor). La ficha podría explicar cómo llegó el título a su estado actual sin depender del histórico limitado de Admin.

## 2. Próxima acción recomendada
En cada ficha, mostrar una única acción contextual basada en lifecycle: Obtener identidad, Validar, Actualizar datos, Actualizar notas, PikoScore, Validar archivo, PikoQuality, etc.

## 3. Antigüedad de bloqueo
Calcular cuánto tiempo lleva un título en la misma fase y priorizar colas por “más antiguo pendiente”. Muy útil con decenas de miles de registros.

## 4. Prioridad de atención PikoFilm
Score operativo independiente de PikoScore: combina antigüedad del bloqueo, gravedad del problema, presencia Plex y facilidad de resolverlo. No tiene relación con visionados.

## 5. Explicación completa de PikoScore
Panel por título con ratings ajustados, confianza por fuente, volumen de votos, efecto España, consenso, RT/Meta y modificación final.

## 6. Laboratorio de calibración PikoScore
Vista estadística para comparar distribución PikoScore por décadas, países y géneros, detectar sesgos y simular una nueva fórmula antes de cambiar versión.

## 7. Versionado/simulación de fórmula
Permitir ejecutar PikoScore 2.x candidato sobre una muestra sin sobrescribir score productivo. Mostrar diferencias antes de promover la fórmula.

## 8. Delta de ratings
Guardar el último valor usado y mostrar al refrescar: IMDb +0,1 / +2.400 votos, FA -0,1, TMDb +150 votos. Ayuda a entender por qué cambió PikoScore.

## 9. Fuente de salud de APIs
Dashboard de OMDb, TMDb, FilmAffinity, IMDb fallback y Plex: último éxito, latencia, errores recientes y porcentaje de disponibilidad.

## 10. Presupuesto/cuota de APIs
Si una fuente tiene límites, registrar llamadas agregadas por día y alertar antes de alcanzarlos. Sin almacenar payloads.

## 11. Identidad: detector de posibles duplicados
Detectar dos IMDb que parecen representar el mismo título/año o varios candidatos apuntando a la misma identidad TMDb/FA y ofrecer revisión antes de contaminar Catálogo.

## 12. Herramienta de fusión/corrección de identidad
Cuando un título fue catalogado con IMDb incorrecto, ofrecer una migración segura hacia el IMDb correcto preservando relaciones válidas y descartando derivados incompatibles.

## 13. Snapshot/rollback de edición de IDs
Antes de cambiar IMDb/TMDb/FA guardar un snapshot mínimo de IDs y permitir deshacer la última corrección si fue un error.

## 14. Evidencia de identidad enriquecida
Además de título/año, incorporar runtime, país y tipo como señales opcionales del score de identidad, con pesos explicables y sin bloquear si faltan.

## 15. Cola de “datos difíciles”
Subclasificar DATA_INCOMPLETE por causa repetida: FA inaccesible, poster ausente, país no disponible, runtime dudoso, etc., para localizar problemas sistémicos.

## 16. Calidad de datos por fuente
Dashboard que diga qué porcentaje del Catálogo tiene IMDb/FA/TMDb/RT/Meta, sinopsis, poster, país, runtime, géneros y créditos.

## 17. Frescura de metadata no-rating
Definir caducidad independiente para algunos datos mutables (por ejemplo poster/sinopsis de títulos nuevos) sin refrescar automáticamente todo el catálogo.

## 18. Comparador de versiones físicas
Si Plex contiene varias versiones de una película, comparar resolución, bitrate, HDR, audio, tamaño y PikoQuality en una única vista antes de decidir cuál conservar externamente.

## 19. Gestión explícita de montajes/ediciones
Distinguir duplicado real de Director’s Cut, Extended, Theatrical, etc. Permitir etiquetar versiones físicas para que no vuelvan a generar falsas alertas.

## 20. Historial técnico por fingerprint
Conservar un resumen ligero de PikoQuality por versiones anteriores del archivo para saber si una sustitución mejoró o empeoró técnicamente, sin guardar streams brutos innecesarios.

## 21. Oportunidades de mejora técnica
Vista “archivos mejorables” basada en PikoQuality, resolución/codec/audio y disponibilidad de otra versión dentro de Plex, sin descargar ni buscar archivos automáticamente.

## 22. PikoQuality por componente
Mostrar subscore Imagen / Audio / Integridad y qué factor limita el resultado, manteniendo el score global.

## 23. PikoQuality contextual por época
Opcionalmente evaluar expectativas técnicas según disponibilidad razonable del material (restauraciones antiguas, SD legítimo, etc.) sin penalizar automáticamente una película clásica por no existir en 4K.

## 24. Series: actualización unitaria completa
Acción “Actualizar esta serie” que reconstruya referencia oficial, disponibilidad y mapeo solo para esa serie, con feedback paso a paso.

## 25. Series: corrección manual de mapeo de episodios
Permitir enlazar un episodio Plex “extra” con un episodio oficial cuando la numeración de proveedor sea distinta.

## 26. Series: especiales y temporada 0
Tratamiento explícito de especiales: opcionales, obligatorios o ignorados por serie, evitando que contaminen faltantes normales.

## 27. Series: reglas por región más expresivas
Mantener España como referencia principal pero permitir estado “disponible parcialmente”, fecha futura conocida o temporada aún no estrenada.

## 28. Series: fecha de disponibilidad estimada
Cuando TMDb u otra fuente indique fecha futura, no convertir el episodio en pendiente operativo hasta que llegue una ventana razonable.

## 29. Series: PikoQuality por temporada
Cola unitaria para analizar episodios pendientes de una temporada y resumen de dispersión: detectar uno o dos capítulos con calidad muy inferior al resto.

## 30. Series: anomalía técnica intra-temporada
Detectar automáticamente episodios con bitrate/resolución/audio muy alejados de la mediana de su propia temporada.

## 31. Sagas: enviar faltante a Novedades
Desde una saga incompleta, acción “Añadir candidato” que cree una Novedad del miembro faltante, sin saltarse el lifecycle.

## 32. Sagas: universos editoriales manuales
Además de colecciones TMDb, permitir agrupaciones propias (“Universo X”, trilogías no oficiales, ciclos de director) con miembros definidos por el usuario.

## 33. Sagas: prioridad inteligente
Mejorar `completion_score` con PikoScore del faltante, número de miembros, porcentaje ya completado y facilidad de cerrar la colección.

## 34. Personas: cobertura de filmografía PikoFilm
Vista para director/actor con títulos relevantes presentes en Catálogo/Plex y títulos de alta relevancia aún fuera del universo, obtenidos de TMDb bajo demanda.

## 35. Personas: búsqueda global
Crear `/personas` con buscador y acceso a personas ya presentes en créditos, sin depender de entrar desde una ficha.

## 36. Descubrimiento por personas
Permitir generar candidatos a Novedades a partir de filmografía de un director/actor concreto aplicando umbrales de calidad/votos.

## 37. Discovery por sagas/colecciones
Detectar nuevos miembros añadidos a colecciones TMDb ya seguidas y ofrecerlos como candidatos, no como alta automática.

## 38. Discovery de próximos estrenos
Cola separada dentro de Novedades para títulos futuros con fecha de estreno, que solo pase a elegibilidad normal cuando llegue el momento y tenga votos suficientes.

## 39. Perfiles de criterios de Discovery
Guardar configuraciones nombradas (conservador, amplio, cine español, series) y elegir cuál usar en una ejecución manual.

## 40. Previsualización de Discovery
Antes de guardar nuevos umbrales, simular contra la base de candidatos conocida cuántos entrarían/saldrían.

## 41. Motivos estructurados de exclusión
Catálogo de razones con texto opcional. Permite luego analizar exclusiones por “no interesa”, “identidad incorrecta”, “tipo no deseado”, etc.

## 42. Exclusiones temporales
Permitir “ignorar hasta fecha X” para estrenos demasiado nuevos o títulos aún sin votos suficientes, sin convertirlos en exclusión permanente.

## 43. Reglas de exclusión configurables
Países/tipos/umbrales se mantienen en configuración, pero añadir una vista que explique qué regla excluyó cada candidato y permita simular cambios.

## 44. Auditoría funcional por título
Desde la ficha, pestaña “Historial” con acciones importantes: alta, cambios de IDs, ratings, PikoScore, Plex detectado, validaciones, exclusión/restauración.

## 45. Exportación de auditoría
Descargar CSV/JSON de un rango de eventos, lifecycle o errores para análisis externo. No exportar secretos ni payloads sensibles.

## 46. Centro de errores accionables
Vista transversal que agrupe fallos recientes de fuentes externas y los títulos afectados, con acceso directo al reintento unitario adecuado.

## 47. Detector de regresiones de datos
Alertar si un refresco intenta reemplazar un campo válido por vacío, reducir votos de forma imposible o cambiar año/tipo de forma sospechosa.

## 48. Reglas de protección manual
Marcar campos concretos como “confirmado manualmente” para impedir que refrescos externos los sobrescriban sin advertencia.

## 49. Salud de la base Neon
Pantalla Admin con tamaño total, tablas/índices principales, crecimiento semanal y margen hasta el límite. Solo lectura.

## 50. Mantenimiento asistido de almacenamiento
Proponer podas seguras (logs viejos, snapshots procesados, caches regenerables) y calcular ahorro estimado antes de ejecutar cualquier borrado.

## 51. Política de retención configurable
Gestionar últimos N eventos/runs por tipo, conservando errores relevantes más tiempo si se desea.

## 52. Detector de índices redundantes
Informe de índices grandes/no usados basado en estadísticas PostgreSQL antes de cualquier eliminación manual.

## 53. Backfill planner
Vista que diga cuántos títulos están sin materializar/versión vieja y permita reconciliar lifecycle por páginas controladas, separado del uso normal.

## 54. Consistencia Catálogo ↔ Plex
Auditoría que encuentre estados imposibles: `in_plex` sin item activo, ratingKey duplicado, IMDb Plex distinto al catálogo, fingerprint sin archivo, etc.

## 55. Consistencia de derivados
Auditoría para detectar PikoQuality con fingerprint antiguo, validación física antigua, referencia de serie incompatible o PikoScore de versión obsoleta.

## 56. Alertas de sustitución de archivo
Tras Actualizar Plex, destacar qué títulos ya completos cambiaron de fingerprint y por ello han vuelto a Validación de película/PikoQuality.

## 57. Resumen de cambios tras Plex Sync
Mostrar altas, bajas, archivos modificados, series con identidad cambiada y títulos reabiertos en lifecycle.

## 58. “Qué cambió desde ayer/última sync”
Vista de base de datos: nuevas entradas, exclusiones/restauraciones, lifecycle movido, ratings/PikoScore recalculados y cambios Plex. No incluye reproducciones.

## 59. Métricas de calidad del catálogo
Distribuciones de PikoScore, confianza, PikoQuality y cobertura de datos por año/país/género para detectar zonas pobres del dataset.

## 60. Pruebas de regresión desde Admin
Botones de solo diagnóstico sobre IDs de prueba conocidos que comprueben clasificadores y fuentes sin modificar masivamente el catálogo.

## Priorización sugerida

### Próximo ciclo
1. Historial lifecycle.
2. Explicación PikoScore.
3. Series unitarias.
4. Centro de errores por fuente.
5. Salud Neon.
6. Consistencia de derivados/fingerprint.

### Después
- versiones físicas/montajes;
- evolución de Series;
- Sagas/Personas como fuentes de descubrimiento;
- laboratorio estadístico de PikoScore;
- mantenimiento asistido.

Este roadmap contiene deliberadamente más de 20 propuestas para que puedan seleccionarse por valor. Ninguna depende de registrar qué ha visto o reproducido el usuario.