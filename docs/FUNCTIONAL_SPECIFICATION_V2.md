# PikoFilm V2 — Documento funcional

**Estado:** versión estable cerrada · 19/08/2026  
**Propósito:** especificación funcional exhaustiva de la aplicación PikoFilm en su V2 estabilizada.

## 1. Visión y objetivo
PikoFilm es un sistema personal de gobierno de catálogo audiovisual. Unifica tres universos que deben mantenerse conceptualmente separados: el catálogo editorial de títulos que interesa conservar/seguir, la biblioteca física realmente presente en Plex y las fuentes externas usadas para identificar, enriquecer y estructurar películas y series. La aplicación no es un simple visor de Plex: permite decidir qué debería existir, qué existe, qué falta, qué está en adquisición, qué debe excluirse, qué tiene problemas de identidad/calidad y qué sagas o series están incompletas.

El principio funcional central es que cada pantalla responda a una pregunta concreta y que las acciones del usuario modifiquen el estado sin destruir información ni mezclar universos.

## 2. Conceptos funcionales
### 2.1 Catálogo
Universo editorial PikoFilm. Incluye películas y series seleccionadas y enriquecidas. Un título puede estar en Plex, faltar en Plex o estar en proceso de adquisición. Los títulos excluidos se mantienen registrados pero desaparecen de las vistas operativas normales.

### 2.2 Plex
Inventario físico. Representa lo que Plex declara actualmente como presente. La Biblioteca Plex nunca debe utilizarse para representar títulos del catálogo que faltan físicamente.

### 2.3 Identidad
La identidad audiovisual se apoya principalmente en IMDb, TMDb y FilmAffinity; en series puede existir además TVDb. Los identificadores permiten cruzar universos y son editables manualmente. Una corrección manual confirmada tiene prioridad sobre heurísticas automáticas.

### 2.4 Exclusión
Excluir no borra. Una exclusión aparta un título de Catálogo, Calidad, Dashboard, Sagas y análisis operativos donde no tenga sentido seguir tratándolo. Puede restaurarse posteriormente.

## 3. Inicio / Dashboard
El Inicio es el centro de control ejecutivo y operativo.

### 3.1 KPIs
Presenta, según disponibilidad de datos: tamaño del catálogo, desglose películas/series, títulos en Plex, faltantes, en proceso, títulos Plex fuera del catálogo, incidencias de calidad, incidencias de identidad, episodios faltantes, sagas incompletas y procesos fallidos recientes. Los indicadores accionables enlazan con su vista filtrada.

### 3.2 Cobertura
Calcula la cobertura de Plex respecto al catálogo y la muestra como porcentaje, no solo como volumen absoluto.

### 3.3 Necesita atención
Concentra accesos a problemas operativos: IDs incompletos, calidad, episodios accionables, sagas cercanas a completarse, títulos Plex por incorporar y procesos fallidos.

### 3.4 Evolución
Permite periodos 7/30/90 días y 1 año. Usa snapshots históricos para mostrar evolución de catálogo, Plex y cobertura. Si todavía no hay histórico suficiente muestra un estado vacío explícito.

### 3.5 Distribuciones
Incluye distribuciones de películas Plex por resolución, codec, géneros y países, además de cobertura histórica por décadas.

### 3.6 Décadas
La visualización por décadas muestra volumen total, parte disponible en Plex, porcentaje de cobertura, cobertura global, década con mejor cobertura y década con más pendientes. En móvil admite desplazamiento horizontal.

## 4. Catálogo
### 4.1 Listado
Permite buscar y filtrar el catálogo por tipo, estado, género, año y otros criterios disponibles. Soporta presentación visual y navegación a ficha.

### 4.2 Estados respecto a Plex
- **En Plex:** existe asociación física actual.
- **Falta:** pertenece al catálogo pero no está en Plex.
- **En proceso:** el usuario ha indicado que está consiguiéndolo; al aparecer posteriormente en Plex puede resolverse el estado operativo.

### 4.3 Ficha
La ficha reúne metadatos editoriales, puntuaciones, estado Plex, imágenes, identificadores y acciones. Permite actualizar datos y editar identidad.

### 4.4 Exclusión y restauración
Excluir aparta el título sin borrarlo. La navegación evita quedarse en una ficha inválida tras la exclusión. Existe una vista específica de excluidos desde la que pueden restaurarse.

## 5. Biblioteca / Plex
### 5.1 Universo
Contiene exclusivamente elementos activos presentes en Plex.

### 5.2 Clasificación
Permite distinguir todos los elementos, los ya incorporados al catálogo y los que todavía están fuera del catálogo. La vista operativa prioriza los no incorporados.

### 5.3 Rendimiento
El listado está paginado en servidor para no cargar miles de títulos de una sola vez. Los cambios entre vistas/filtros deben ser rápidos.

### 5.4 Añadir al catálogo
Un elemento Plex fuera del catálogo puede incorporarse. El alta ejecuta enriquecimiento individual y trata de completar IMDb, TMDb, FilmAffinity y metadatos disponibles. Tras la sincronización Plex, el nuevo título debe quedar correctamente asociado y marcado como presente.

### 5.5 Sincronización Plex
`Actualizar Plex` refresca el inventario y registra altas, cambios y bajas. La sincronización alimenta todas las funciones que dependen de presencia física. En series, además, es responsable de detectar cambios de identidad del show y de invalidar referencias derivadas antiguas para que el análisis de Series las reconstruya; el análisis de Series no duplica esa responsabilidad.

## 6. Calidad — Películas
Herramienta operativa para encontrar problemas reales sin castigar indiscriminadamente material antiguo o SD.

### 6.1 Duración
Compara duración física Plex con referencia de catálogo y genera incidencias cuando la desviación relativa y absoluta es suficientemente significativa. La incidencia explica valores y diferencia.

### 6.2 Nombre de archivo
Normaliza ruido habitual de releases y contrasta nombre/año contra la identidad esperada. Busca sospechosos fuertes, no coincidencia literal perfecta.

### 6.3 Duplicados
Agrupa por identidad real y compara copias. Si las duraciones son compatibles puede utilizar resolución, bitrate, codec, tamaño y otros datos para ayudar a decidir cuál conservar. Nunca elimina automáticamente.

### 6.4 Calidad técnica
Evalúa la calidad de forma relativa. SD o 720p no son malas por definición; una resolución alta tampoco garantiza calidad si existe compresión extrema.

### 6.5 Riesgo y estados
Las causas permanecen visibles y el usuario puede confirmar excepciones o indicar que un caso ha sido corregido y espera la siguiente sincronización. Una nueva huella técnica provoca reevaluación.

### 6.6 Exclusiones
Los títulos excluidos no participan en Calidad.

## 7. Calidad — Identidad
Cola transversal para películas y series.

### 7.1 Qué detecta
Ausencia de IMDb/TMDb/FilmAffinity, formatos inválidos y casos que no pueden resolverse correctamente con la identidad disponible.

### 7.2 Flujo
El usuario puede reintentar resolución automática; si no funciona, editar IDs manualmente, guardar y volver a actualizar. Si el problema queda resuelto, desaparece de la cola.

### 7.3 Protección de IDs manuales
Los IDs introducidos y confirmados manualmente no deben ser borrados ni sustituidos silenciosamente por el enriquecimiento automático. Esta regla fue validada en la batería final.

### 7.4 Edición desde fichas
IMDb, TMDb y FilmAffinity pueden editarse también desde la ficha. En series puede mostrarse TVDb cuando existe.

## 8. Calidad — Series
### 8.1 Objetivo
Mostrar episodios realmente accionables y diagnosticar referencias incorrectas, evitando confundir episodios futuros/desconocidos con faltantes.

### 8.2 Referencia oficial
TMDb aporta estructura de temporadas y episodios, nombres, fechas y runtimes. La referencia se almacena para no depender de consultas externas en cada lectura.

### 8.3 Disponibilidad España
La disponibilidad se resuelve principalmente por temporada con estados `ES_AVAILABLE`, `ES_NOT_YET`, `ES_PARTIAL`, `UNKNOWN` y excepciones manuales. Los overrides manuales prevalecen.

### 8.4 Faltantes accionables
Un episodio debe existir oficialmente, faltar en Plex y ser considerado disponible/accionable en España. Los casos desconocidos no se convierten automáticamente en pendientes principales.

### 8.5 Detalle de serie
Permite navegar por temporadas y por estados de episodios. `Todos` muestra todos los episodios oficiales y conserva correctamente el filtro solicitado. La vista puede mostrar faltantes, desconocidos y episodios Plex que no encajan con la referencia.

### 8.6 Sobran / no encajan
PikoFilm detecta episodios presentes en Plex que no casan con la referencia oficial y destaca series con sobrecobertura anómala. Esto sirve para localizar asociaciones erróneas, no solo episodios que faltan.

### 8.7 Cambio de identidad
Si Plex corrige una serie previamente mal identificada, la sincronización Plex invalida la referencia derivada anterior. El siguiente análisis de Series reconstruye la referencia con la identidad nueva y recalcula diagnósticos. El caso Castle 2003→2009 fue utilizado como prueba de aceptación y quedó resuelto.

### 8.8 Exclusiones
Series excluidas quedan fuera del análisis.

## 9. Sagas
### 9.1 Objetivo
Responder qué sagas se han empezado y qué falta para completarlas.

### 9.2 Estados
`INCOMPLETE`, `COMPLETE` y `NOT_STARTED`. La experiencia prioriza incompletas y permite destacar las que están a una sola película.

### 9.3 Cobertura
Cada saga muestra tenidas/total, porcentaje y faltantes. La cobertura se recalcula contra Plex sin necesidad de reconstruir siempre la fuente externa.

### 9.4 Miembros
La ficha de saga presenta sus miembros y diferencia `En Plex`, `En catálogo pero falta` y, cuando existe información de colección, miembros todavía fuera del catálogo.

### 9.5 Fuentes
Las colecciones TMDb son la base automática; los universos PikoFilm permiten agrupaciones editoriales más complejas.

### 9.6 Exclusiones
Los títulos excluidos no deben alterar cobertura ni aparecer como trabajo pendiente.

## 10. Personas
La aplicación dispone de navegación por personas/créditos cuando los datos están disponibles, permitiendo consultar la filmografía relacionada dentro del universo PikoFilm.

## 11. Administración
### 11.1 Propósito
Admin es la consola operativa para saber qué proceso se ejecutó, cuándo, cuánto tardó, qué procesó y por qué falló.

### 11.2 Procesos
Registra sincronización Plex, enriquecimiento individual, Calidad, Series, Sagas, Identidad y otros procesos operativos mediante un registro general, con tablas específicas cuando el dominio necesita detalle adicional.

### 11.3 Información visible
Estado, inicio/fin, duración, procesados, errores y resumen estructurado. Las ejecuciones fallidas deben poder diagnosticarse sin depender exclusivamente de Vercel/GitHub.

## 12. Enriquecimiento individual
El pipeline individual permite incorporar o actualizar un título. Parte de los IDs disponibles, consulta fuentes externas configuradas y completa metadatos. Puede funcionar como descubrimiento automático o guiado por IDs manuales. Las correcciones manuales tienen precedencia.

## 13. Reglas transversales
1. Plex es fuente de presencia física; Catálogo es fuente editorial.
2. No borrar datos para representar una exclusión reversible.
3. No analizar excluidos en calidad/series/sagas/dashboard operativo.
4. No sobreescribir silenciosamente identidad confirmada manualmente.
5. Separar sincronización ligera de Plex de análisis externos pesados.
6. Mantener trazabilidad de procesos.
7. Preferir procesamiento incremental y SQL agregado frente a recomputaciones globales.
8. La UI debe conservar contexto y utilizar controles visibles para conjuntos pequeños de opciones.
9. Ningún diagnóstico debe eliminar archivos automáticamente.

## 14. Flujos funcionales de extremo a extremo
### 14.1 Nuevo título detectado en Plex
Actualizar Plex → aparece en Biblioteca como fuera de catálogo → Añadir → enriquecimiento → queda en Catálogo → siguiente cruce/sync confirma `En Plex`.

### 14.2 Corrección de identidad
Calidad/Identidad o ficha → editar IDs → guardar → actualizar datos → preservar IDs manuales → recalcular asociaciones → desaparecer de incidencia si queda resuelto.

### 14.3 Serie mal asociada
Corregir identidad en Plex → Actualizar Plex → invalidar referencia derivada → Actualizar Series → reconstruir TMDb → recalcular faltantes/extras → eliminar falsos diagnósticos.

### 14.4 Archivo de película corregido
Corregir/reemplazar archivo → marcar esperando sync si procede → Actualizar Plex → detectar nueva huella → reanalizar calidad → resolver o actualizar incidencia.

### 14.5 Exclusión
Excluir → salir de vistas operativas → no participar en análisis → conservar registro → restaurar cuando se desee.

## 15. Estado de aceptación de V2
La batería funcional final validó navegación y rendimiento de Biblioteca, altas desde Plex y enriquecimiento, sincronización posterior, edición/protección de IDs, exclusiones, Calidad Películas, Dashboard, filtro `Todos` en detalle de Series y reconciliación real de identidad de Castle.

Queda únicamente una mejora menor no bloqueante registrada como issue: robustecer el timeout de `Actualizar Series`, que actualmente puede requerir un segundo intento cuando la ejecución queda demasiado cerca del límite de la petición.

## 16. Alcance futuro
La V2 queda diseñada para crecer sin cambiar sus principios: más fuentes, métricas históricas, mejores reglas de disponibilidad, optimización del pipeline y nuevas visualizaciones deben añadirse respetando separación de responsabilidades, identidad canónica, incrementalidad y trazabilidad.
