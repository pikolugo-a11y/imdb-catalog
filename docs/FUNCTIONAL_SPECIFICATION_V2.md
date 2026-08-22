# PikoFilm — Especificación funcional canónica

**Versión documental:** Lifecycle + PikoScore 2.0  
**Fecha:** 22/08/2026  
**Estado:** documentación de la versión actual validada mediante un flujo completo de película.  
**Ámbito:** comportamiento funcional vigente. Los cambios futuros se registran en los roadmaps, no aquí.

## 1. Propósito

PikoFilm es una base de datos personal de gobierno audiovisual. Su objetivo es mantener un catálogo editorial coherente, enriquecerlo con fuentes externas, correlacionarlo con la biblioteca física de Plex, detectar problemas de identidad/datos/archivos y ofrecer una puntuación propia PikoScore y una puntuación técnica PikoQuality.

PikoFilm **no sustituye a Plex como reproductor ni como gestor de consumo**. No se registran reproducciones, progreso, historial de visionado, visto/no visto ni hábitos de consumo.

## 2. Principios funcionales

1. **Catálogo es la fuente única editorial.** Todo título catalogado debe poder verse desde `/catalogo`, con independencia de la fase en la que esté.
2. **Plex es la fuente de verdad física.** Indica qué archivos existen realmente y permite detectar altas, bajas y sustituciones.
3. **Novedades es la única puerta de entrada operativa.** Discovery, altas manuales y títulos nuevos detectados en Plex confluyen en una misma cola y se distinguen por `origen`.
4. **El lifecycle decide qué pantalla debe tratar cada título.** Una pantalla no debe procesar títulos que aún no hayan alcanzado su estado.
5. **Excluidas están fuera del flujo.** No deben reaparecer en colas automáticas hasta restauración explícita.
6. **Los procesos de títulos son unitarios.** El usuario procesa una película/serie cada vez y recibe feedback inmediato.
7. **Los datos generales, los ratings y PikoScore son procesos distintos.** Calcular PikoScore nunca consulta fuentes externas.
8. **La rama física solo existe si el título está en Plex.** Una película sin archivo puede quedar completa después de PikoScore.
9. **La validez física es por archivo/fingerprint, no eterna por IMDb.** Si cambia el archivo, se repiten las comprobaciones físicas.
10. **Toda operación relevante deja traza en Admin.**
11. **Los despliegues a producción son manuales.** El usuario decide cuándo desplegar y realiza la aceptación funcional/visual.

## 3. Universos de datos

### 3.1 Catálogo
Es la colección editorial de películas, series y miniseries que PikoFilm gestiona. El registro principal vive en `movies` y se complementa con metadata, géneros, créditos, estado Plex y lifecycle.

Un título puede estar:
- fuera de Plex;
- en proceso de conseguirse;
- en Plex;
- en cualquier fase intermedia de calidad/identidad;
- completo;
- excluido.

### 3.2 Plex
Representa los elementos físicos activos de Plex. Un elemento de Plex puede existir antes de estar catalogado. La sincronización Plex no crea un flujo paralelo: los nuevos elementos se convierten en Novedades de origen Plex.

### 3.3 Novedades
Staging de candidatos todavía no incorporados al Catálogo. Tres orígenes:
- `discovery`: descubrimiento por datasets IMDb;
- `plex`: detectado físicamente en Plex;
- `manual`: IMDb introducido por el usuario.

### 3.4 Exclusiones
`catalog_exclusions` es un archivo reversible. Excluir no borra el historial ni el archivo de Plex. Impide que el título participe en el lifecycle operativo.

### 3.5 Datos derivados
Identidad validada, referencia de series, validación física, PikoQuality, sagas y auditoría son derivados del Catálogo/Plex y pueden reconstruirse cuando cambian sus fuentes.

## 4. Lifecycle canónico

| Estado | Significado | Pantalla |
|---|---|---|
| `IDENTITY_PENDING` | falta IMDb/TMDb/FilmAffinity o identidad mínima válida | Calidad → Identidad |
| `IDENTITY_VALIDATION` | están los IDs pero falta demostrar que corresponden al mismo título | Calidad → Validación de Identidad |
| `IDENTITY_REVIEW_REQUIRED` | validación dudosa o probable error | Calidad → Validación de Identidad |
| `DATA_INCOMPLETE` | identidad válida, faltan datos obligatorios | Calidad → Datos |
| `PIKOSCORE_PENDING` | datos completos; PikoScore inexistente/caducado o fórmula antigua | Calidad → Datos |
| `MOVIE_FILE_PENDING` | película en Plex; archivo actual nunca validado | Calidad → Películas |
| `MOVIE_FILE_REVIEW` | validación del archivo detectó incidencia | Calidad → Películas |
| `SERIES_SYNC_PENDING` | serie en Plex sin referencia oficial de episodios | Calidad → Series |
| `SERIES_REVIEW` | serie con faltantes, extras o disponibilidad por confirmar | Calidad → Series |
| `TECH_PENDING` | PikoQuality pendiente para archivo/episodios actuales | Calidad → PikoQuality / rama Series |
| `TECH_REVIEW` | incidencia técnica pendiente de decisión | Calidad → Películas |
| `COMPLETE` | no queda trabajo aplicable | Catálogo |
| `EXCLUDED` | fuera del flujo por decisión del usuario | Catálogo → Excluidas |

### 4.1 Orden de evaluación

El lifecycle aplica siempre el primer bloqueo existente:

`Exclusión → Identidad → Validación identidad → Datos → PikoScore → rama Plex → Complete`

Si no hay presencia física en Plex, el título puede pasar de PikoScore directamente a `COMPLETE`.

## 5. Entrada al sistema

### 5.1 Discovery automático bajo demanda

1. El usuario pulsa **Buscar novedades**.
2. Se solicita una única ejecución manual del discovery IMDb.
3. El worker aplica rating/votos, reglas España y países excluidos.
4. Los candidatos válidos aparecen en `/novedades` con origen Discovery.
5. El usuario decide **Añadir** o **Excluir**.

No existe un cron periódico de discovery. Hay control de frecuencia/cooldown.

### 5.2 Alta manual

1. El usuario escribe `tt...` en Novedades.
2. Se comprueba que no esté ya catalogado y que no esté excluido.
3. Se obtiene identidad/datos mínimos usando fuentes rápidas disponibles.
4. Aparece en la misma tabla con origen Manual.
5. El usuario lo añade al Catálogo.

Retirar un candidato manual no equivale a excluirlo.

### 5.3 Entrada desde Plex con IMDb

1. **Actualizar Plex** detecta un archivo nuevo.
2. Si no existe en Catálogo, se siembra una Novedad con origen Plex.
3. Con IMDb válido se obtienen los datos mínimos necesarios para Novedades.
4. El usuario pulsa **Añadir**.
5. Desde ese momento sigue exactamente el mismo lifecycle que cualquier otra entrada.

### 5.4 Entrada desde Plex sin IMDb

1. Plex detecta el elemento físico pero no dispone de IMDb.
2. Novedades muestra el registro como **Sin IMDb**.
3. El usuario puede escribir el IMDb en la propia fila.
4. Una vez guardado, se crea/resuelve el candidato común y continúa por Novedades.

### 5.5 Restauración de una exclusión

Una exclusión puede restaurarse. Si el título todavía existe en Catálogo se reactiva allí; si era solo un candidato, vuelve a Novedades. La restauración es explícita.

## 6. Pantallas

## 6.1 Dashboard `/`

Centro de control. Resume Catálogo, presencia Plex, faltantes, en proceso, trabajo de calidad, identidad, episodios, sagas y procesos fallidos. Incluye evolución temporal y distribuciones por resolución, codec, géneros, países y décadas.

Su función es orientar; no debe ejecutar procesos pesados durante el render.

## 6.2 Novedades `/novedades`

Única bandeja de entrada.

### Información
- título / IMDb;
- año y tipo;
- país;
- IMDb y votos cuando ya están disponibles;
- origen: Discovery / Plex / Manual;
- estado: Sin IMDb / Preparando / Lista / Error;
- fecha de detección.

### Acciones
- **Actualizar Plex**;
- **Buscar novedades** cuando el cooldown lo permita;
- alta manual por IMDb;
- guardar IMDb de un elemento Plex sin identidad;
- **Añadir** al Catálogo;
- **Excluir**;
- reintentar un manual fallido/atascado;
- retirar un candidato manual.

Las vistas de carátulas no forman parte del objetivo operativo de esta pantalla: la tabla es la vista canónica.

## 6.3 Criterios de Novedades `/novedades/criterios`

Configura rating/votos mínimos por películas/series y reglas específicas para España, además de países excluidos globalmente. Los cambios se aplican en el siguiente discovery; guardar criterios no ejecuta discovery.

## 6.4 Catálogo `/catalogo`

Punto único para consultar la base editorial completa. Tiene vista carátulas y tabla, búsqueda, filtros, ordenación, paginación y acceso a Excluidas.

Cada título muestra un badge de lifecycle. En tabla el badge enlaza a la pantalla que actualmente debe tratarlo.

Estados de presencia independientes del lifecycle:
- `En Plex`;
- `En proceso`;
- `Falta`.

Las acciones de adquisición no deben confundirse con el lifecycle de calidad.

## 6.5 Ficha de película `/catalogo/[imdbId]`

Presenta datos editoriales, sinopsis, reparto/equipo, IDs, PikoScore y ratings. Permite actualizar datos, editar identidad y acciones editoriales permitidas.

La ficha no debe recalcular masivamente nada al abrirse.

## 6.6 Ficha de serie `/catalogo/[imdbId]`

Además de datos/ratings incluye:
- cobertura Plex;
- temporadas y episodios oficiales;
- PikoQuality agregada cuando existe;
- acceso a revisión episodio a episodio;
- edición de IDs;
- actualización de datos;
- exclusión del Catálogo, incluso si físicamente sigue en Plex.

Excluir una serie en Plex no elimina los archivos.

## 6.7 Excluidas `/catalogo/excluidas`

Archivo reversible con búsqueda, tipo, motivo, rango de fechas, orden y grid/lista. La restauración devuelve cada registro al contexto adecuado.

## 6.8 Calidad `/calidad`

Debe ser un **mapa de colas del lifecycle**, no un motor paralelo. Sus contadores se basan en `catalog_lifecycle` y cada bloque lleva a la cola correspondiente.

La versión objetivo es unitaria. Los botones masivos que todavía quedan visibles se consideran legado y están inventariados en `ROADMAP_MIGRATION.md`.

## 6.9 Identidad `/calidad/identidad`

Solo contiene `IDENTITY_PENDING`.

Objetivo único: completar IMDb, TMDb y FilmAffinity.

Por fila:
- **Obtener identidad**: procesa solo el título actual;
- **Corregir**: edición manual de IDs;
- abrir ficha.

Si consigue los tres IDs, desaparece automáticamente y pasa a Validación de Identidad. Los resultados ambiguos/fallos se informan en el propio proceso, no en una bandeja separada.

## 6.10 Validación de Identidad `/calidad/validacion-identidad`

Comprueba que IMDb, TMDb y FilmAffinity describen el mismo título mediante evidencia de título original/año y score.

Subestados:
- `evidence_pending`: faltan datos necesarios para evaluar;
- `ready`: evidencia suficiente, pendiente de evaluación;
- `doubtful`: 60–84;
- `probable_error`: <60.

Una evaluación ≥85 se considera válida y sale de la fase.

Acciones unitarias:
- actualizar evidencia;
- validar/revalidar;
- editar IDs;
- decisión manual Correcta / Dudosa / ID incorrecto;
- retirar decisión manual.

Editar IDs invalida la evidencia dependiente y obliga a revalidar.

## 6.11 Datos y PikoScore `/calidad/datos`

Comparte pantalla pero contiene dos trabajos claramente separados.

### A. `DATA_INCOMPLETE`
Botón **Actualizar datos**. Intenta completar la ficha usando fuentes externas. Los datos críticos incluyen identidad editorial, ratings/votos, duración, país, géneros, sinopsis y carátula.

### B. `PIKOSCORE_PENDING`
Si los ratings están caducados: **Actualizar notas**. Solo consulta ratings/votos y críticos; no vuelve a descargar reparto, sinopsis, poster, etc.

Si los ratings están frescos: **Calcular PikoScore**. Cálculo 100% local con datos almacenados.

La pantalla muestra cobertura, principales faltantes, última lectura de notas, caducidad, PikoScore anterior, fecha y confianza.

## 7. PikoScore 2.0

PikoScore no es una media simple.

### 7.1 Fuentes núcleo
- IMDb rating + votos;
- FilmAffinity rating + votos;
- TMDb rating + votos.

Los votos regulan la confianza mediante shrinkage bayesiano. Una nota extrema con uno o pocos votos se acerca fuertemente a una referencia estadística y no puede comportarse como un 10 consolidado.

### 7.2 Pesos
No españolas: IMDb 40%, FA 35%, TMDb 25%.

Españolas: IMDb 30%, FA 45%, TMDb 25%, además de medianas/priores de votos específicos. No existe un bonus fijo por nacionalidad.

### 7.3 Crítica profesional
Rotten Tomatoes y Metacritic aportan un modificador limitado a ±0,35 puntos. Rotten Tomatoes no se convierte directamente en una nota 0–10.

### 7.4 Confianza
Se calcula a partir de volumen de votos y consenso entre fuentes. Se almacena por separado del score.

### 7.5 Frescura dinámica
- estreno <3 meses: 14 días;
- 3–12 meses: 30 días;
- 1–3 años: 90 días;
- 3–10 años: 180 días;
- >10 años: 365 días.

`ratings_refreshed_at` y `pikoscore_calculated_at` son independientes. Un cambio de fórmula puede obligar a recalcular PikoScore sin volver a consultar Internet si los ratings siguen frescos.

## 8. Rama de película con archivo físico

Después de PikoScore, si no está en Plex → `COMPLETE`.

Si está en Plex:

`MOVIE_FILE_PENDING → MOVIE_FILE_REVIEW (si hay incidencia) → TECH_PENDING → COMPLETE`

## 8.1 Validación de película `/calidad/peliculas`

La validación pertenece al **fingerprint del archivo actual**.

Comprueba:
- duración Plex vs duración de catálogo;
- similitud nombre/año del fichero;
- varias versiones físicas/duplicados.

### Salidas
1. **Sin incidencia**: pasa automáticamente a PikoQuality.
2. **Incidencia + Es correcta**: se acepta la excepción y pasa a PikoQuality.
3. **Ya la corregí**: significa que el usuario modificó referencia/nombre/archivo. Se elimina la referencia catalogada dependiente y la siguiente sincronización Plex debe volver a introducirla por Novedades para rehacer el ciclo.

Ninguna acción borra físicamente archivos de Plex.

## 8.2 PikoQuality `/calidad/pikoquality`

Solo una película ya validada puede entrar como `TECH_PENDING`.

**Analizar PikoQuality**:
- procesa una película;
- obtiene detalle/streams del archivo actual desde Plex;
- calcula score técnico;
- guarda score + banda + versión + fingerprint;
- recalcula lifecycle en la misma operación.

Si todo está correcto, pasa directamente a `COMPLETE`. No existe botón adicional de confirmación.

Si el archivo cambia, el PikoQuality anterior queda obsoleto porque su fingerprint ya no coincide.

## 9. Rama de series

Después de PikoScore, una serie sin Plex puede quedar `COMPLETE`. En Plex necesita referencia oficial y diagnóstico episodio a episodio.

### 9.1 `SERIES_SYNC_PENDING`
Falta crear/reconstruir la referencia oficial de temporadas/episodios.

### 9.2 `SERIES_REVIEW`
Se revisan:
- episodios presentes;
- faltantes accionables en España;
- disponibilidad desconocida;
- episodios Plex que no encajan con referencia oficial.

Un episodio ausente no se considera automáticamente “faltante” si no se sabe que está disponible en España.

### 9.3 Detalle `/calidad/series/[ratingKey]`
Permite navegar por temporada, filtrar estados y marcar manualmente disponibilidad de temporada en España. Muestra PikoScore, PikoQuality agregada y cobertura Plex.

La conversión completa de esta rama a procesos unitarios es una deuda de migración explícita.

## 10. Sagas

Agrupa colecciones, calcula cobertura y prioriza incompletas. Los excluidos no cuentan. La pantalla distingue incompletas, a una película, completas, no iniciadas y todas.

Sagas no registra visionados: representa completitud editorial/física.

## 11. Personas

Las fichas de persona muestran únicamente la filmografía relacionada con el universo PikoFilm y el estado editorial/Plex de esos títulos. No representan consumo.

## 12. Administración `/admin`

Consola de trazabilidad:
- `pipeline_runs`: procesos, tiempos, contadores, status, errores y summary;
- sincronizaciones Plex;
- `admin_events`: acciones unitarias y detalles técnicos.

Toda nueva operación funcional debe dejar evidencia suficiente para explicar qué ocurrió sin depender de logs externos.

Política operativa actual de espacio: se han conservado únicamente los últimos 1.000 eventos Admin y los últimos 1.000 pipeline runs; la automatización de esta retención queda en roadmap.

## 13. Exclusiones

La exclusión tiene precedencia máxima sobre el lifecycle.

Reglas:
- no participa en Identidad/Datos/Calidad/Series;
- no reaparece por discovery o Plex mientras siga excluida;
- se puede restaurar;
- excluir desde la ficha no elimina el archivo físico;
- las acciones quedan auditadas.

## 14. Cambios de identidad

Editar IMDb/TMDb/FA es una operación de alto impacto:
- invalida evidencia derivada de los IDs modificados;
- obliga a volver a Validación de Identidad;
- puede invalidar referencia de series;
- los cálculos derivados deben reconstruirse usando la nueva identidad.

Los IDs confirmados manualmente no deben sobrescribirse silenciosamente.

## 15. Fingerprint de archivo

La validez técnica nunca se almacena como “esta película fue revisada alguna vez”. Se vincula a la versión física actual.

Un fingerprint diferente implica:
- repetir Validación de película;
- repetir PikoQuality;
- conservar histórico únicamente cuando aporte trazabilidad y no bloquee el nuevo flujo.

## 16. Feedback y errores

Los procesos unitarios deben devolver:
- éxito/fallo;
- qué fuentes respondieron;
- qué datos se actualizaron o faltan;
- estado al que pasa el título.

Un fallo de una fuente secundaria no debe destruir datos buenos existentes. En ratings, la fecha de refresco solo se actualiza cuando las tres fuentes núcleo quedan verificadas.

## 17. Rendimiento funcional

Las páginas son vistas de trabajo, no procesos. Abrir una pantalla no debe provocar miles de recalculados o escrituras. Las operaciones costosas se ejecutan al pulsar una acción concreta sobre un título o mediante mantenimiento explícito.

## 18. Casos de regresión del flujo nuevo

### `tt6720618`
Caso con archivo Plex usado para validar el recorrido completo:
`Novedades/Plex → Identidad → Validación → Datos → PikoScore → Validación de archivo → PikoQuality → Complete`.

### `tt21187592`
Caso sin archivo Plex:
`Novedades/manual → Identidad → Validación → Datos → PikoScore → Complete`.

Ambos sirven como regresiones conceptuales, no como datos de configuración.

## 19. No objetivos

PikoFilm no debe implementar:
- historial de reproducciones;
- visto/no visto;
- progreso de episodio/película;
- estadísticas de consumo;
- recomendaciones basadas en reproducciones propias;
- control de usuarios Plex o sesiones de reproducción.

Todo ello pertenece a Plex u otras herramientas específicas.

## 20. Aceptación y deployment

1. El código se prepara y mergea en `main`.
2. **No se despliega automáticamente.**
3. El usuario decide cuándo ejecutar el deployment manual en Vercel.
4. El usuario prueba el flujo real.
5. Una funcionalidad se considera validada tras su prueba funcional/visual.

## 21. Documentación asociada

- `TECHNICAL_SPECIFICATION_V2.md`: arquitectura técnica actual.
- `ROADMAP_FRONTEND.md`: mejoras visuales/UX detectadas.
- `ROADMAP_MIGRATION.md`: legado a borrar/adaptar.
- `ROADMAP_FUNCTIONAL.md`: futuras capacidades.
- `PROJECT_RULES.md`: reglas operativas permanentes.
- `PROJECT_STATUS.md`: foto del estado del proyecto.

Los documentos V1/V2/V3 parciales y pilotos anteriores se consideran históricos y no deben prevalecer sobre esta especificación.