# PikoFilm V5 — Decisiones Punto 3 · Base de datos y modelo de datos

Fecha: 2026-09-14

Documento canónico de decisiones de la Fase 2 del Punto 3. Cada propuesta se revisa individualmente con el usuario y debe quedar persistida antes de presentar la siguiente.

## DB-01 — Contrato único de retención por clase de dato

**Estado: APROBADA**

### Decisión

V5 definirá una política central de retención para todas las tablas, en lugar de depender de que cada módulo implemente o recuerde su propia limpieza.

Clasificación base:

- **Foto actual / estado vigente:** no caduca automáticamente y nunca puede desaparecer por una purga de histórico.
- **Dato canónico / decisiones manuales vigentes:** sin TTL automático salvo regla funcional explícita.
- **Histórico operativo, runs, logs y eventos técnicos:** 30 días por defecto; el usuario no necesita conservar históricos antiguos si ya no aportan valor operativo.
- **Auditoría funcional relevante:** retención explícita según necesidad, sin depender accidentalmente de la vida de un log técnico.
- **Read models / cachés reconstruibles:** política propia, reconstruibles desde fuentes canónicas.
- **Snapshots y raw payloads técnicos:** TTL definido por utilidad real y coste.

### Invariante aprobada por el usuario

> Cualquier histórico puede purgarse tras X días; lo que debe quedar garantizado es la foto actual. La foto actual nunca puede desaparecer.

Esta condición es obligatoria en el diseño V5: ningún estado vigente puede existir únicamente como consecuencia de conservar histórico. Si una superficie necesita una foto actual, ésta debe tener representación persistente o ser reconstruible de forma determinista desde datos canónicos que no estén sujetos a la purga del histórico.

### Alcance esperado

- un único mecanismo de housekeeping incremental y seguro;
- contratos de retención documentados por clase de dato/tabla;
- protección explícita de estado actual, decisiones manuales y datos canónicos;
- visibilidad operativa de cumplimiento de retención, volumen purgable y espacio recuperable;
- eliminación segura de históricos sin degradar la foto actual ni la capacidad funcional del sistema.

### Límites

- Esta decisión no autoriza ninguna purga inmediata ni modificación de datos históricos en Neon.
- No implica que todos los datos tengan 30 días de TTL; 30 días es el valor por defecto para histórico operativo/técnico.
- No se debe borrar un histórico si todavía es la única fuente de una verdad funcional vigente; antes deberá existir una fuente actual/canónica separada.

### Motivo

La auditoría detectó que la retención de 30 días está bien implementada en algunas tablas (`process_runs` y dependencias, `process_plans`) pero no existe un contrato global. Al mismo tiempo, observabilidad e históricos ya representan una fracción material del almacenamiento. Centralizar la política permite controlar coste y crecimiento sin comprometer el estado actual del producto.

## DB-02 — Elegibilidad canónica de Personas y filmografía sólo de películas

**Estado: EN REVISIÓN — requisitos funcionales del usuario fijados; pendiente de aprobación de la propuesta completa.**

### Condiciones ya fijadas por el usuario

- PikoFilm sólo debe conservar en la filmografía de Personas **películas reales que interesen funcionalmente**.
- Los créditos que el clasificador ya considera secundarios/rechazados (`short`, `self_or_archive`, `bonus_or_special`) **no deben conservarse como filmografía canónica**, porque el usuario no quiere consultarlos ni mantenerlos.
- La vista **“Otros créditos” debe desaparecer del frontal**; no se debe mantener una superficie sólo para exponer datos que el producto ha decidido rechazar.
- La migración V5 deberá **eliminar de la base los registros rechazados existentes**, pero ninguna purga se ejecutará en producción durante esta fase de definición y requerirá migración probada y autorización expresa.
- La clasificación debe ampliarse para detectar más elementos que TMDb publica dentro de `movie_credits` pero que no son películas útiles para PikoFilm: grabaciones de conciertos, representaciones teatrales filmadas, ceremonias/eventos, competiciones deportivas, recopilatorios de programas y otros especiales equivalentes.
- No se autoriza una exclusión basada únicamente en palabras del título: se han observado falsos positivos reales. La clasificación final deberá apoyarse en identidad/tipo de obra y señales estructuradas de las fuentes.
- Las películas legítimas no deben excluirse por pertenecer a géneros como Documental, Música o Película de TV; el género aislado no determina que una obra sea basura.

### Evidencia cuantitativa observada en Neon durante la revisión

- `person_filmography`: 549.892 filas y ~204 MB totales antes de cualquier cambio V5.
- Créditos ya marcados como rechazados: 73.630 `short`, 52.364 `self_or_archive` y 355 `bonus_or_special`, unas 126.349 filas en total y ~35 MB de payload de fila aproximado antes de contar índices/TOAST.
- Los 294.785 créditos hoy etiquetados `feature_film` representan 103.742 obras TMDb distintas; 6.791 de esas obras todavía no tienen IMDb resuelto.
- Una pasada conservadora por señales inequívocas detectó al menos 677 obras adicionales actualmente tratadas como `feature_film` que parecen eventos/representaciones/recopilatorios no cinematográficos, afectando 1.260 créditos. Esta cifra es sólo un suelo, no el universo final a purgar.

### Dirección técnica pendiente de cerrar

La propuesta completa deberá combinar:

1. una regla única de elegibilidad de personas (>5 películas del catálogo como actor o >5 como director, corrigiendo la representación real de `credit_type='director'` además del legacy `crew + Director`);
2. normalización de obra y relación persona↔obra para no repetir metadatos de una misma película por cada persona;
3. almacenamiento únicamente de relaciones aceptadas como películas útiles;
4. desaparición de `Otros créditos` del frontend y de sus conteos;
5. clasificación más fiable mediante metadata estructurada (preferentemente tipo de título IMDb cuando exista y señales TMDb adicionales) con exclusiones automáticas sólo cuando sean inequívocas;
6. migración branch-first con comparación de paridad, métricas antes/después y limpieza de producción sólo tras validación y autorización.

### Límite de esta anotación

Esta sección **no marca DB-02 como aprobada todavía** y no autoriza ningún `DELETE`, `TRUNCATE`, migración ni mutación de Neon. Sólo persiste los requisitos funcionales y la evidencia revisada para que la siguiente versión de la propuesta no pueda reintroducir “Otros créditos” ni conservar basura rechazada por defecto.
