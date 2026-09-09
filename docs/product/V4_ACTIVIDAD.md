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

## Decisión 6 — Cronología única con filtros

**Aprobada.**

Actividad V4 tendrá una **única cronología global** de lo que ocurre en PikoFilm. No habrá historiales funcionales separados e independientes por módulo.

La vista principal mostrará los acontecimientos más recientes de todos los dominios y permitirá acotar la cronología mediante filtros rápidos, al menos por:

- Todo;
- Catálogo;
- Plex;
- Calidad;
- Personas;
- Sagas;
- Novedades;
- Errores.

Además, la UX podrá ofrecer filtro por fecha y búsqueda textual cuando aporten valor, siempre aplicados de forma eficiente en PostgreSQL.

La cronología única debe preservar la visión global de **qué está haciendo PikoFilm**, mientras que los filtros sirven únicamente para reducir el conjunto visible. Filtrar no crea fuentes de actividad paralelas ni duplica registros.

La selección exacta de controles, disposición, densidad visual y comportamiento responsive pertenece al diseño UX/UI de implementación, responsabilidad de ChatGPT, respetando este contrato funcional.

## Decisión 7 — Origen comprensible de cada actividad

**Aprobada.**

Cada entrada de Actividad V4 indicará de forma visible pero discreta **qué originó la acción**, usando lenguaje comprensible para el usuario y sin exponer nombres técnicos de workers, servicios, colas o procesos internos.

El origen debe permitir distinguir, como mínimo, entre acciones iniciadas por el usuario y trabajo iniciado automáticamente por PikoFilm. Cuando aporte contexto funcional real, también podrá expresarse el sistema externo o mecanismo reconocible que originó el hecho, por ejemplo Plex.

Ejemplos de intención de lenguaje:

- `Datos actualizados de Heat` — **Automático**.
- `Título excluido` — **Tú**.
- `Sincronización Plex completada` — **Plex**.
- `Revisión de calidad completada` — **Automático**.

La taxonomía final de etiquetas de origen debe ser pequeña, estable y orientada al usuario. No debe trasladar a Actividad términos como nombres de workers Railway, lanes, leases, jobs, identificadores internos o códigos PROC.

El origen es contexto de presentación y trazabilidad funcional; no sustituye a la información principal obligatoria de cada entrada: **qué hizo PikoFilm y cuál fue el resultado**.

## Decisión 8 — Actividad en curso y resultado final

**Aprobada.**

Actividad V4 podrá mostrar procesos o acciones funcionalmente relevantes **mientras estén en curso**, cuando esa información ayude al usuario a entender qué está haciendo PikoFilm en ese momento.

Una actividad en curso debe expresar el trabajo funcional y su progreso en lenguaje de usuario, por ejemplo:

- `Actualizando datos de 48 títulos` — **En curso**.
- Resultado actual: `31 completados, 17 pendientes`.

La misma actividad debe evolucionar hasta reflejar su desenlace final. No se deben crear varias entradas duplicadas para representar inicio, progreso y final del mismo hecho funcional cuando puedan mantenerse como una única actividad correlacionada.

### Regla de actualización

- inicio relevante -> actividad visible como **En curso**;
- progreso -> actualización de la misma actividad cuando aporte información útil;
- finalización -> la misma actividad pasa a resultado final: completada, completada con incidencias, sin cambios, fallida, cancelada u otro desenlace funcional equivalente;
- el detalle técnico de estados internos, heartbeats, leases, intentos y workers permanece en Operaciones V4.

La implementación debe evitar escrituras de progreso excesivas. Sólo se persistirá o recalculará el progreso con la granularidad necesaria para una UX útil y eficiente, sin convertir Actividad en un stream de telemetría de alta frecuencia.

## Decisión 9 — Resultado concreto y ausencia de cambios

**Aprobada.**

El resultado de una actividad debe explicar **qué cambió realmente** siempre que el proceso disponga de esa información. No debe limitarse a estados genéricos como `correcto` o `completado` cuando pueda expresar el efecto funcional producido.

Ejemplos de intención de lenguaje:

- `Datos actualizados de Heat.` Resultado: `Se actualizaron duración, país y 2 valoraciones.`
- `Ficha de persona actualizada.` Resultado: `Se añadieron 3 títulos a la filmografía.`
- `Sincronización Plex completada.` Resultado: `12 títulos cambiaron de estado físico y 2 aparecieron nuevos.`

Cuando una comprobación o actualización termine correctamente **sin producir cambios**, Actividad debe decirlo expresamente, por ejemplo: `Comprobado: no había cambios.`

### Contrato de resultado funcional

Los procesos deberán exponer o permitir derivar un resumen funcional pequeño de su efecto cuando sea razonable y eficiente. Ese resumen debe priorizar cambios significativos para el usuario, no dumps de campos, payloads técnicos ni diferencias internas irrelevantes.

En procesos globales o masivos, el resultado podrá agregarse por cantidades y categorías y cargar el detalle de afectados sólo bajo demanda. En procesos individuales, podrá enumerar directamente los cambios principales.

La exigencia de explicar el cambio no justifica duplicar grandes estados en Actividad: se conservará únicamente el resumen mínimo necesario y se reutilizarán los datos canónicos existentes cuando resulte más eficiente.

## Decisión 10 — Prioridad visual por relevancia funcional

**Aprobada.**

Actividad V4 mantendrá accesible toda la actividad funcional dentro de la ventana de retención, pero no tratará todas las entradas con el mismo peso visual.

La cronología aplicará una jerarquía visual basada en relevancia funcional:

- actividad rutinaria completada correctamente -> presentación compacta;
- actividad con cambios relevantes -> mayor énfasis visual;
- actividad que requiere atención, quedó bloqueada, falló o necesita intervención -> énfasis claro y prioritario.

Esta jerarquía es exclusivamente de presentación. **No puede ocultar ni descartar actividad funcional.** Todo seguirá disponible en la cronología y mediante filtros.

El objetivo es que el usuario pueda detectar de inmediato qué necesita atención sin tener que revisar manualmente cientos de actividades correctas o rutinarias.

La definición exacta de iconografía, color, densidad, badges, agrupación y responsive pertenece a la implementación UX/UI, manteniendo coherencia con PikoFilm V4 y sin introducir lenguaje técnico innecesario.

## Decisión 11 — Detalle funcional primero

**Aprobada.**

Al abrir una entrada de Actividad, la experiencia debe mostrar primero un **detalle funcional orientado al usuario**, no una consola técnica ni una vista de ejecución interna.

Ese detalle debe poder incluir, según corresponda:

- qué ocurrió;
- cuál fue el resultado;
- qué cambios concretos se produjeron;
- entidad o entidades afectadas;
- origen de la acción;
- fecha y hora;
- estado actual;
- siguiente paso conocido cuando exista.

Cuando una actividad global o masiva tenga afectados concretos, el detalle funcional podrá permitir consultar esa lista bajo demanda sin volcar cientos de filas en la cronología principal.

### Acceso a Operaciones

Cuando exista necesidad de diagnóstico o administración técnica, Actividad podrá ofrecer un acceso secundario y discreto del tipo **`Ver detalle técnico en Operaciones`**.

Ese salto debe conservar la correlación con la ejecución técnica correspondiente cuando exista, pero los identificadores, códigos internos, stack traces, workers, retries y demás telemetría no deben contaminar el detalle funcional principal.

La regla de navegación es por tanto:

`Actividad -> explicación funcional -> entidad afectada / detalle de cambios`

Y sólo cuando sea necesario:

`Actividad -> Ver detalle técnico en Operaciones -> ejecución/diagnóstico`

Actividad sigue siendo la superficie para entender **qué hizo PikoFilm y qué resultado tuvo**; Operaciones sigue siendo la superficie para entender **cómo se ejecutó técnicamente**.

## Decisión 12 — Búsqueda funcional eficiente

**Aprobada.**

Actividad V4 permitirá buscar dentro de la ventana de retención de 30 días por **entidad y por texto funcional**.

La búsqueda debe poder localizar, cuando existan, actividades relacionadas con:

- títulos de películas o series;
- personas;
- sagas;
- texto visible de la actividad o de su resumen funcional.

El caso de uso esperado es poder escribir, por ejemplo, `Heat` y recuperar lo que PikoFilm hizo con esa entidad durante los últimos 30 días sin recorrer manualmente toda la cronología.

### Rendimiento de búsqueda

La búsqueda debe resolverse cerca de PostgreSQL y sobre el conjunto mínimo necesario. No se cargará el histórico en el navegador para filtrarlo en cliente.

La implementación debe usar consultas selectivas y los índices estrictamente necesarios según el modelo final, evitando índices redundantes o estructuras de búsqueda costosas que no aporten valor real dentro de una ventana pequeña de 30 días.

La búsqueda es una herramienta de navegación sobre la misma fuente funcional de Actividad; no crea una copia, índice documental externo ni un segundo sistema de logging.
