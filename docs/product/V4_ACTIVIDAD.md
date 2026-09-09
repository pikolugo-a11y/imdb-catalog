# PikoFilm V4 — Actividad

Estado: **contrato funcional en construcción**.

Este documento fija las decisiones aprobadas para Actividad V4. Cada decisión se persiste aquí antes de avanzar a la siguiente. La implementación debe respetar `AGENTS.md`, `docs/PROJECT_RULES.md`, la arquitectura canónica y la frontera de observabilidad basada en `process_runs` + eventos/errores.

## Decisión 1 — Propósito de Actividad

**Aprobada.**

Actividad V4 será el **historial funcional, humano y comprensible de lo que PikoFilm ha hecho**.

Debe permitir entender hechos como, por ejemplo:

- se actualizó una película o serie;
- se sincronizó Plex;
- se recalculó PikoScore;
- se admitió, excluyó o restauró un título;
- se refrescaron datos, calidad, personas o sagas;
- una acción o proceso falló;
- cuando exista una entidad afectada, se podrá navegar hacia ella.

Actividad **no** será la consola técnica del sistema. Los detalles de `process_runs`, workers, Batch, colas, leases, reintentos, métricas, errores técnicos y mantenimiento administrativo pertenecen a **Operaciones V4**.

### Separación funcional aprobada

- **Actividad V4** = visión funcional orientada al usuario: qué ocurrió en PikoFilm y sobre qué entidad.
- **Operaciones V4** = visión técnica/administrativa: cómo se ejecutó, estado operativo, errores, retry, Batch, workers y mantenimiento.

Esta separación no crea una nueva fuente de verdad de observabilidad: Actividad debe construirse sobre la información canónica existente y sus read models/derivados cuando corresponda, sin inventar un sistema paralelo de logs.

## Decisión 2 — Contenido de cada entrada

**Aprobada.**

Actividad mostrará únicamente acontecimientos con **significado funcional** para el usuario. No mostrará ruido interno de ejecución como leases, heartbeats, reclamación de workers, intentos técnicos intermedios, progreso interno de items o detalles equivalentes; esos datos pertenecen a Operaciones V4.

Cada entrada de Actividad debe responder de forma clara a dos preguntas:

1. **Qué hizo PikoFilm.**
2. **Cuál fue el resultado.**

Por tanto, no basta con registrar que un proceso se ejecutó. La entrada debe expresar el efecto funcional y su desenlace, por ejemplo: datos actualizados correctamente, título excluido, sincronización Plex completada con cambios, PikoScore recalculado, acción sin cambios necesarios o actualización fallida.

Cuando exista una entidad funcional afectada, la entrada debe identificarla y permitir navegar hacia ella. El lenguaje será humano y orientado al catálogo, no una transcripción de estados o nombres técnicos internos.

## Decisión 3 — Cobertura completa y agrupación

**Aprobada.**

Actividad V4 debe tener **cobertura funcional completa de todo lo que ocurre en PikoFilm**, incluido el trabajo automático. No será una selección editorial de unos pocos eventos representativos ni una muestra parcial de procesos visibles.

La implementación deberá recoger todos los cambios, acciones y resultados con significado funcional que produzcan los procesos del sistema, tanto manuales como automáticos, siempre traducidos a lenguaje comprensible para el usuario. La existencia de cientos de ejecuciones automáticas no justifica omitir actividad: obliga a resumirla y presentarla mejor.

### Regla de agrupación

Cuando una acción global o masiva afecte a muchas entidades, Actividad mostrará una **entrada principal resumida** que explique qué se hizo y cuál fue el resultado agregado, por ejemplo:

- sincronización Plex completada;
- 23 títulos actualizados;
- 4 títulos nuevos detectados;
- 2 títulos sin cambios;
- 1 incidencia funcional encontrada.

Cuando tenga sentido, esa entrada permitirá consultar el detalle de las entidades afectadas sin convertir la cronología principal en cientos de filas.

Las acciones individuales mostrarán directamente la entidad afectada y su resultado.

### Garantía funcional

La agrupación es sólo una decisión de presentación. **No puede provocar pérdida de información funcional.** Todo cambio relevante debe quedar representado directa o indirectamente en Actividad y poder explicarse en lenguaje de usuario.

Actividad no mostrará detalles puramente internos de ejecución —workers, leases, heartbeats, trazas, estados técnicos intermedios— salvo cuando deban traducirse a una consecuencia funcional visible. El detalle técnico completo seguirá perteneciendo a Operaciones V4.

## Decisión 4 — Tratamiento funcional de fallos

**Aprobada.**

Los fallos también forman parte de Actividad cuando tengan una consecuencia funcional para el usuario. Deben explicarse en lenguaje comprensible, no mediante mensajes técnicos crudos.

Cada fallo visible en Actividad debe expresar:

1. **Qué no se pudo completar o qué salió mal funcionalmente.**
2. **Cuál es la consecuencia actual.**
3. **Qué ocurrirá después**, cuando exista un siguiente paso conocido: reintento automático, pendiente de revisión manual, bloqueo hasta corregir un dato, proceso detenido, etc.

Ejemplos de intención de lenguaje:

- `No se pudieron actualizar los datos de Heat.` Resultado: `La actualización quedó pendiente y PikoFilm volverá a intentarlo automáticamente.`
- `No se pudo identificar correctamente Heat.` Resultado: `Necesita revisión manual antes de continuar.`

Actividad no debe mostrar stack traces, códigos internos, excepciones, nombres de worker ni causas técnicas detalladas. Esos datos pertenecen a Operaciones V4.

Cuando exista una entidad funcional afectada, la actividad de error debe permitir navegar hacia ella. Cuando sea útil para diagnóstico o administración, podrá ofrecer un acceso desde la actividad hacia la vista técnica correspondiente en Operaciones, sin contaminar el lenguaje principal de usuario.

## Decisión 5 — Retención y eficiencia

**Aprobada.**

Actividad V4 debe ser rápida de cargar y barata de mantener. La retención detallada de actividad funcional será de **30 días**. Todo registro de actividad funcional con más de 30 días se eliminará mediante una política de purga controlada.

No se conservará indefinidamente un histórico detallado de Actividad ni se crearán miles de logs redundantes que aumenten el coste de Neon. La implementación debe reutilizar la observabilidad canónica existente y persistir sólo la información funcional mínima necesaria para explicar qué hizo PikoFilm y cuál fue el resultado, evitando duplicación de datos técnicos.

### Rendimiento

La vista principal debe consultar únicamente el rango y volumen necesarios para renderizar la pantalla actual. Debe usar paginación o carga incremental, filtros aplicados en PostgreSQL y consultas selectivas; no debe descargar el histórico completo ni ejecutar agregaciones costosas en el frontend.

Los procesos globales o masivos se presentarán agrupados y sus detalles se cargarán sólo bajo demanda cuando el usuario los consulte.

### Retención

- detalle funcional disponible: últimos 30 días;
- registros anteriores a 30 días: purga automática/controlada;
- la purga debe respetar integridad referencial y no borrar estado funcional vigente del catálogo;
- si datos técnicos de `process_runs`/eventos/errores tienen una retención distinta necesaria para Operaciones, se decidirá expresamente en Operaciones V4 y no se asumirá desde Actividad.

El objetivo es mantener cobertura funcional completa dentro de la ventana de 30 días sin convertir Actividad en una fuente de coste creciente o una segunda plataforma de logging.
