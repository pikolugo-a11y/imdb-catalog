# PikoFilm V2 — Documento funcional

**Estado:** versión estable ampliada con Novedades V1 · 19/08/2026  
**Propósito:** especificación funcional viva de la aplicación PikoFilm. Debe actualizarse antes de cada fusión/despliegue con cambios funcionales relevantes.

## 1. Visión y objetivo
PikoFilm es un sistema personal de gobierno de catálogo audiovisual. Unifica el catálogo editorial de títulos, la biblioteca física de Plex, una bandeja de descubrimiento continuo de nuevos candidatos y las fuentes externas usadas para identificar, enriquecer y estructurar películas y series. La aplicación permite decidir qué debería existir, qué existe, qué falta, qué está en adquisición, qué debe excluirse, qué tiene problemas de identidad/calidad, qué sagas o series están incompletas y qué nuevos títulos deberían entrar en el catálogo.

El principio funcional central es que cada pantalla responda a una pregunta concreta y que las acciones del usuario modifiquen el estado sin destruir información ni mezclar universos.

## 2. Conceptos funcionales
### 2.1 Catálogo
Universo editorial PikoFilm. Incluye películas y series seleccionadas y enriquecidas. Un título puede estar en Plex, faltar en Plex o estar en proceso de adquisición. Los títulos excluidos se mantienen registrados pero desaparecen de las vistas operativas normales.

### 2.2 Plex
Inventario físico. Representa lo que Plex declara actualmente como presente. La Biblioteca Plex nunca debe utilizarse para representar títulos del catálogo que faltan físicamente.

### 2.3 Novedades
Universo temporal de candidatos todavía no incorporados. IMDb es el punto de entrada de elegibilidad por rating/votos. El usuario decide posteriormente si incorpora, excluye o retira una propuesta. Novedades no es una segunda copia del catálogo.

### 2.4 Identidad
La identidad audiovisual se apoya principalmente en IMDb, TMDb y FilmAffinity; en series puede existir además TVDb. Los identificadores permiten cruzar universos y son editables manualmente. Una corrección manual confirmada tiene prioridad sobre heurísticas automáticas.

### 2.5 Exclusión
Excluir no borra. Una exclusión aparta un título de Catálogo, Novedades, Calidad, Dashboard, Sagas y análisis operativos donde no tenga sentido seguir tratándolo. Puede restaurarse posteriormente.

## 3. Inicio / Dashboard
El Inicio es el centro de control ejecutivo y operativo. Presenta KPIs de catálogo, cobertura Plex, faltantes, en proceso, títulos Plex fuera del catálogo, incidencias de calidad/identidad, episodios faltantes, sagas incompletas y procesos fallidos. Incluye evolución 7/30/90 días y 1 año, distribuciones por resolución/codec/género/país y cobertura por décadas.

## 4. Catálogo
Permite buscar y filtrar por tipo, estado, género, año y otros criterios. Cada ficha reúne metadatos editoriales, puntuaciones, estado Plex, imágenes, identificadores y acciones. Los estados principales respecto a Plex son `En Plex`, `Falta` y `En proceso`.

Excluir aparta el título sin borrarlo. Existe una vista específica de excluidos y la restauración es reversible.

## 5. Biblioteca / Plex
La Biblioteca contiene exclusivamente elementos activos presentes en Plex. Distingue elementos ya incorporados y elementos fuera del catálogo. Está paginada en servidor para mantener buen rendimiento con miles de títulos.

`Actualizar Plex` refresca inventario, altas, cambios y bajas. En series, la sincronización Plex es responsable de detectar cambios de identidad y de invalidar referencias derivadas antiguas para que el análisis de Series reconstruya posteriormente la referencia correcta.

Una serie borrada de Plex deja de participar inmediatamente en Calidad de Series, KPIs y refrescos operativos aunque su referencia histórica permanezca almacenada. Este comportamiento evita falsos faltantes como el caso `Love is in the Air`.

## 6. Calidad — Películas
Analiza duración, nombre de archivo, duplicados y calidad técnica con criterios relativos. No considera SD/720p malas por definición ni elimina archivos automáticamente. Las incidencias pueden marcarse como excepción o esperando sincronización y se reevaluarán cuando cambie la huella técnica. Los títulos excluidos no participan.

## 7. Calidad — Identidad
Detecta ausencia o incoherencia de IMDb/TMDb/FilmAffinity y permite reintento automático o edición manual. Los IDs confirmados manualmente no deben ser borrados ni sustituidos silenciosamente por el enriquecimiento automático.

## 8. Calidad — Series
TMDb aporta estructura oficial de temporadas/episodios y disponibilidad España. Se distinguen episodios realmente accionables, desconocidos y episodios Plex que sobran/no encajan. `Todos` conserva el filtro seleccionado.

Las series excluidas y los shows inactivos en Plex no participan. Si Plex corrige una identidad, el siguiente ciclo Plex → Series reconstruye la referencia; el caso Castle 2003→2009 se mantiene como regresión conceptual.

`Actualizar / Reanalizar Series` dispone de mayor margen de ejecución y trazabilidad temporal por fases para reducir fallos por timeout y facilitar el diagnóstico.

## 9. Sagas
Permite conocer sagas incompletas/completas/no iniciadas, cobertura, miembros presentes y faltantes. Las colecciones TMDb forman la base automática y los universos PikoFilm permiten agrupaciones editoriales más complejas. Los excluidos no alteran cobertura ni pendientes.

## 10. Personas
Cuando hay créditos disponibles, permite navegar por personas y consultar su filmografía relacionada dentro del universo PikoFilm.

## 11. Administración
Admin registra procesos operativos, estado, inicio/fin, duración, procesados, errores y resumen estructurado. Incluye sincronización Plex, enriquecimiento individual, Calidad, Series, Sagas, Identidad y discovery IMDb.

## 12. Enriquecimiento individual
El pipeline individual incorpora o actualiza un título a partir de IMDb/identidad Plex y completa TMDb, FilmAffinity/Wikidata, metadatos, arte, reparto, sagas y puntuaciones disponibles.

### 12.1 Rating IMDb inmediato para altas desde Plex
Cuando un título recién incorporado desde Plex tiene IMDb ID válido pero todavía no ha pasado por el refresco batch diario, `Actualizar datos` intenta completar rating y votos desde el dataset oficial IMDb `title.ratings.tsv.gz`, en streaming y con timeout acotado, sin scraping.

Si el título existe en el snapshot IMDb actual, sus datos deben quedar disponibles inmediatamente y persistirse para no repetir el trabajo. Si todavía no existe en el dataset o el acceso expira, el resto del enriquecimiento continúa y se mantiene el estado `IMDb pendiente de dataset` sin perder los datos TMDb/FA obtenidos.

El caso de regresión es `First Lady` (`tt15787006`, TMDb `158808`), añadida desde Plex.

## 13. Reglas transversales
1. Plex es fuente de presencia física; Catálogo es fuente editorial.
2. IMDb es el punto de entrada de Novedades.
3. No borrar datos para representar una exclusión reversible.
4. No analizar excluidos en Calidad/Series/Sagas/Dashboard operativo.
5. No sobreescribir silenciosamente identidad confirmada manualmente.
6. Separar sincronizaciones rápidas de análisis externos pesados.
7. Mantener trazabilidad de procesos.
8. Preferir procesamiento incremental, streaming y SQL agregado.
9. Ningún diagnóstico debe eliminar archivos automáticamente.
10. Las documentaciones funcional y técnica se actualizan con cada cambio relevante antes de fusionar/desplegar.

## 14. Novedades V1 — Descubrimiento continuo
### 14.1 Objetivo
Mantener vivo el catálogo después de la carga masiva inicial detectando películas, series y miniseries que pasan a cumplir los criterios IMDb o que el usuario quiere forzar manualmente.

### 14.2 Fuente
No se hace scraping de IMDb. El discovery utiliza `title.ratings.tsv.gz` y `title.basics.tsv.gz` en streaming.

### 14.3 Criterios configurables
Los umbrales se guardan en configuración y pueden cambiarse sin despliegue. Valores iniciales:
- Películas generales: IMDb ≥ 6,0 y ≥ 10.000 votos.
- Series/miniseries generales: IMDb ≥ 7,0 y ≥ 5.000 votos.
- Películas españolas: IMDb ≥ 6,0 y ≥ 7.500 votos.
- Series/miniseries españolas: IMDb ≥ 6,5 y ≥ 4.000 votos.

### 14.4 Rescate España
Si un título no cumple la regla general pero entra en la zona española, PikoFilm resuelve país solo para ese subconjunto. Una coproducción es válida si España participa. La tarjeta muestra `Rescate España 🇪🇸`.

### 14.5 India
India permanece excluida globalmente de las propuestas automáticas. La exclusión es configurable y no está concebida como regla irreversible.

### 14.6 Cruces
Una propuesta automática solo aparece si cumple una regla activa, no está ya en catálogo, no está en `catalog_exclusions` y no pertenece a un país globalmente excluido.

### 14.7 Estados y fluctuaciones
Los automáticos representan la situación IMDb actual: pueden entrar o salir de Novedades cuando cambian rating/votos. Se conserva histórico de detección; no se borra el candidato.

### 14.8 Añadir IMDb manualmente
El usuario puede introducir cualquier `tt...` aunque no cumpla criterios. Si ya está en catálogo se informa; si está excluido se exige restauración explícita. Un candidato manual permanece hasta incorporación, exclusión o retirada manual y no desaparece por fluctuaciones IMDb.

### 14.9 Excluir
`Excluir` desde Novedades reutiliza `catalog_exclusions`. El título desaparece y no vuelve a proponerse hasta restauración. Se consulta/restaura desde la vista normal de excluidos.

### 14.10 Añadir y ampliar datos
Reutiliza el pipeline existente de enriquecimiento. Al completar con éxito, el título entra en Catálogo y desaparece naturalmente de Novedades. Si falla, permanece reintentable.

### 14.11 Ejecución
El discovery IMDb se ejecuta **solo bajo petición manual explícita**. No existe cron diario ni polling periódico. El workflow de GitHub Actions se inicia únicamente mediante `workflow_dispatch` y el worker impone además un límite duro de **una ejecución exitosa cada 7 días**. Si se intenta ejecutar antes, la ejecución falla antes de procesar los datasets e informa de la próxima fecha permitida. La UI debe reflejar esta política y no dejar solicitudes `pending` sin ejecutor.

### 14.12 Rendimiento
La UI lee datos persistidos y está paginada. El worker filtra primero ratings, después basics, resuelve país solo donde es necesario y hace escrituras por lotes.

## 15. Flujos end-to-end principales
### Nuevo título detectado en Plex
Actualizar Plex → Biblioteca fuera de catálogo → Añadir → rating IMDb on-demand si falta → enriquecimiento → Catálogo → cruce Plex.

### Novedad automática
Petición manual de discovery IMDb (máximo semanal) → reglas/país → anti-join catálogo/excluidas → Novedades → Añadir y ampliar datos → Catálogo.

### Novedad manual
Introducir IMDb → validación → comprobar catálogo/exclusión → Novedades → enriquecer o excluir/retirar.

### Serie mal asociada
Corregir en Plex → Actualizar Plex → invalidar referencia → Actualizar Series → reconstruir TMDb → recalcular faltantes/extras.

### Exclusión
Excluir desde Catálogo o Novedades → desaparecer de operaciones → conservar registro → restaurar cuando se desee.

## 16. Estado de aceptación y regresión
La baseline V2 validó Biblioteca, altas desde Plex, edición/protección de IDs, exclusiones, Calidad, Dashboard, filtro `Todos` y reconciliación Castle. La ampliación actual añade como regresiones obligatorias: `Love is in the Air` no debe aparecer en Calidad si está inactiva en Plex; `First Lady` debe poder completar rating/votos IMDb desde el dataset oficial al actualizar; Novedades debe respetar catálogo/excluidas, rescate España e India excluida. El discovery IMDb no debe ejecutarse automáticamente y debe respetar el límite semanal.

## 17. Documentación especializada
Para detalle adicional de Novedades se mantienen también `docs/NOVEDADES_V1_FUNCTIONAL.md` y `docs/NOVEDADES_V1_TECHNICAL.md`. Este documento sigue siendo la referencia funcional global de PikoFilm y debe permanecer sincronizado con ellos.