# PikoFilm V4 — Operaciones

Estado: **contrato funcional en construcción**.

## Decisión 1 — Operaciones como hermana técnica de Actividad

**Aprobada.**

Actividad V4 y Operaciones V4 son dos vistas hermanas del mismo sistema y deben mantener una correspondencia funcional/técnica estable.

- Si un hecho funcional aparece en Actividad y tiene ejecución técnica, Operaciones debe permitir localizar esa ejecución y su detalle técnico.
- El salto desde Actividad hacia Operaciones debe conservar la correlación con la ejecución correspondiente.
- Ambas superficies comparten la misma ventana temporal de consulta y retención: **30 días** para la información detallada consultable desde la aplicación.
- No se crearán fuentes de verdad paralelas: Actividad y Operaciones reutilizan `process_runs`, `process_run_events`, `process_run_errors` y el resto de estado técnico canónico que corresponda.
- Las decisiones de Actividad que tengan dimensión técnica se consideran complementarias en Operaciones: mismo hecho, distinto nivel de lectura.

## Decisión 2 — Operaciones no es un feed técnico infinito

**Aprobada.**

La experiencia principal de Operaciones V4 será un **buscador técnico especializado y una superficie de diagnóstico**, no un gran listado cronológico de logs.

Sus dos accesos principales serán:

1. entrada directa desde una actividad concreta para abrir su ejecución técnica;
2. búsqueda técnica específica cuando el usuario quiera localizar un proceso, ejecución, error, entidad, batch o identificador concreto.

La interfaz puede mostrar resultados, resúmenes y estados recientes cuando ayuden al diagnóstico, pero evitará convertir Operaciones en una segunda cronología paralela a Actividad.

## Decisión 3 — Alcance operativo más allá de logs

**Aprobada.**

Operaciones V4 no se limita a consultar logs. Debe analizar e integrar las capacidades técnicas y administrativas reales del sistema, incluyendo cuando existan:

- reinicio y recuperación de procesos;
- límites y protecciones operativas;
- Batch Engine y su estado;
- pausa, reanudación y cancelación;
- capacidad, concurrencia y workers;
- colas, lanes, leases y heartbeats;
- reintentos y errores;
- controles de seguridad/idempotencia;
- mantenimiento técnico;
- estado de scheduler/planificador cuando tenga dimensión operativa;
- cualquier mecanismo de intervención técnica ya existente en PikoFilm.

La implementación deberá auditar primero el sistema vivo y el código actual para decidir qué controles existen realmente, cuáles deben exponerse y qué acciones necesitan protección adicional. Operaciones no inventará controles que el backend no pueda ejecutar de forma segura.

## Decisión 4 — Portada orientada a búsqueda y acceso directo

**Aprobada.**

La portada de Operaciones V4 estará diseñada alrededor de un **buscador técnico principal**, no alrededor de un listado de ejecuciones recientes.

El buscador debe poder localizar, según la información canónica disponible, por elementos como:

- IMDb ID o entidad afectada;
- título o persona cuando pueda resolverse desde datos canónicos;
- `run_id`;
- proceso o código de proceso;
- error, paso o texto técnico;
- Batch relacionado;
- identificadores técnicos útiles para diagnóstico.

Cuando el usuario llegue desde Actividad mediante `Ver detalle técnico en Operaciones`, Operaciones abrirá directamente la ejecución correlacionada y su contexto técnico, sin obligar a realizar una búsqueda intermedia.

La portada podrá mostrar únicamente un **resumen operativo compacto** del estado actual y un acceso claro al **Centro de control** para acciones administrativas como reinicios, Batch Engine, límites, capacidad y mantenimiento. No mostrará por defecto un feed largo de ejecuciones.

Los resultados de búsqueda se cargarán sólo cuando exista una consulta o navegación concreta, manteniendo Operaciones como herramienta de investigación y diagnóstico y no como segunda cronología de Actividad.

## Decisión 5 — Control seguro: observar mucho, intervenir sólo donde el sistema lo soporta

**Aprobada.**

El Centro de control de Operaciones V4 mostrará con claridad el **estado efectivo** y las protecciones operativas del sistema, pero no convertirá todos los parámetros internos en controles editables.

Debe permitir observar, cuando aplique:

- estado global del Batch Engine;
- Batch activos y su estado;
- concurrencia solicitada y límites efectivos;
- items pendientes, ejecutándose, reintentándose o fallidos;
- leases, heartbeats y reconciliación de trabajo interrumpido;
- política de reintentos y límites relevantes;
- estado del scheduler/planificador y otras protecciones del sistema.

Las acciones disponibles se limitarán a intervenciones **explícitamente soportadas y seguras por el backend**, como las ya existentes de pausar, reanudar o cancelar Batch y reiniciar un título cuando corresponda.

Parámetros delicados como concurrencia máxima, duración de leases o política de reintentos se mostrarán como **límites/protecciones del sistema** y no se ofrecerán como sliders o campos editables por defecto. Sólo se expondrán cambios configurables si existe una necesidad operativa real, una semántica clara y una implementación segura y auditable.

Principio rector: **Operaciones debe permitir entender mucho y romper poco**. Toda intervención manual relevante debe quedar trazada en la observabilidad canónica.

## Decisión 6 — Retención técnica coordinada de 30 días

**Aprobada.**

Operaciones V4 tendrá la misma ventana de retención detallada que Actividad V4: **30 días** para la información técnica consultable desde la aplicación.

Esta regla se aplica de forma coordinada a la observabilidad y al estado técnico histórico asociado, incluyendo al menos:

- `process_runs`;
- `process_run_events`;
- `process_run_errors`;
- datos históricos de Batch vinculados a ejecuciones ya terminales cuando su conservación deje de ser necesaria para el estado operativo actual;
- cualquier otro detalle técnico que sólo exista para diagnosticar ejecuciones pasadas.

La purga debe preservar siempre:

- ejecuciones todavía activas, pausadas, reintentables o pendientes de reconciliación;
- integridad referencial;
- estado técnico vigente necesario para que workers, Batch Engine, planificador u otros mecanismos sigan funcionando;
- cualquier resumen agregado o estado actual que no sea mero detalle histórico.

La correspondencia temporal con Actividad es intencionada: mientras un hecho funcional sea consultable en Actividad, su detalle técnico correlacionado debe seguir disponible en Operaciones; cuando expire la ventana detallada, ambas superficies deben dejar de ofrecer ese nivel de detalle de forma coherente.

La implementación deberá auditar las relaciones y claves foráneas antes de introducir la purga para evitar borrar ejecuciones padre, items Batch o errores que todavía sean necesarios para procesos vivos.

## Decisión 7 — Fuentes y límites con verificación de cumplimiento real

**Aprobada.**

Operaciones V4 tendrá una sección de primer nivel **Fuentes y límites** dentro del Centro de control.

Para cada proveedor externo gestionado por la arquitectura canónica debe mostrar, cuando aplique:

- disponibilidad actual;
- cuota usada y restante;
- concurrencia configurada y límite duro;
- reparto reservado para Batch;
- estado del circuit breaker;
- `blocked_until` o equivalente;
- errores/rate limits recientes;
- Batch pausados automáticamente por una restricción de la fuente.

La edición sólo se permitirá para parámetros que el backend ya soporte y valide, siempre dentro de los hard caps y protecciones del sistema. Operaciones nunca permitirá superar un límite duro ni inventará una configuración que los procesos no puedan aplicar de forma segura.

### Garantía de cumplimiento

No basta con que la configuración pueda editarse o verse en la UI. La implementación de Operaciones V4 debe **auditar y demostrar que los procesos reales consumen y respetan la configuración efectiva**.

La auditoría debe seguir el recorrido completo:

`UI/acción -> persistencia de configuración -> funciones de gobernanza -> worker/proceso -> llamada externa`

Si un proceso llama directamente a una fuente gobernada sin pasar por el mecanismo canónico, usa límites hardcodeados ignorando la configuración persistida, o lee una fuente/configuración distinta de la que Operaciones modifica, se considerará una incidencia arquitectónica a corregir antes de dar esta parte por cerrada.

Operaciones debe diferenciar claramente entre **valor configurado**, **límite duro** y **valor efectivo aplicado**, para que sea verificable que un cambio tiene efecto real.

## Decisión 8 — Gobernanza obligatoria y fail-closed para fuentes gobernadas

**Aprobada.**

Toda llamada de los procesos canónicos a una fuente externa gobernada por Operaciones debe pasar obligatoriamente por el mecanismo canónico de gobernanza. Para TMDb, OMDb y MDBList no se admite que `apiGate` sea una protección opcional que pueda omitirse silenciosamente.

- Batch y ejecuciones manuales usan la misma configuración persistida y las mismas protecciones; sólo cambia su `lane` cuando corresponda.
- Si un proceso canónico intenta consultar una fuente gobernada sin disponer de `apiGate`, la operación debe fallar de forma segura **antes de realizar el `fetch`**.
- Los wrappers y rutas manuales deben crear e inyectar `createApiGate(...)` igual que los workers Batch.
- Los caminos legacy que sigan realizando llamadas directas a TMDb/OMDb/MDBList deben migrarse al mecanismo gobernado o quedar fuera de uso antes de considerar cerrada esta parte de Operaciones V4.
- La concurrencia interna de un proceso no puede convertirse en un bypass del límite efectivo de la fuente: cada llamada externa debe adquirir su permiso individual.
- La observabilidad debe permitir distinguir una denegación por gobernanza de un error del proveedor.

Principio permanente: **una fuente declarada como gobernada no puede ser consultada sin gobernanza**. La ausencia de gate es un error de programación, no un permiso implícito para continuar.

## Decisión 9 — Recuperación contextual y segura

**Aprobada.**

Operaciones V4 no tendrá un botón genérico de «reiniciar» ni un «reiniciar todo PikoFilm». La recuperación será contextual: primero se localiza la entidad, ejecución o Batch afectado y después el sistema ofrece únicamente las acciones de recuperación que sean válidas y seguras para su estado real.

- Para un título podrá ofrecerse el reinicio completo a Novedades cuando proceda, mostrando previamente qué estado o datos se invalidarán y exigiendo confirmación explícita.
- Para un Batch sólo se ofrecerán pausa, reanudación, cancelación, reintento u otras acciones cuando el backend las soporte y el estado actual permita ejecutarlas sin romper invariantes.
- Para una ejecución individual, Operaciones podrá orientar hacia el reintento o recuperación canónica correspondiente, pero no inventará acciones genéricas que el proceso no tenga implementadas.
- Ninguna recuperación manual relevante será invisible: debe quedar trazada en la observabilidad canónica y generar su hecho funcional correspondiente en Actividad cuando tenga consecuencia funcional.
- Toda acción debe preservar idempotencia, integridad y los límites/protecciones de las fuentes externas.

Si en el futuro fuese necesaria una recuperación global, deberá diseñarse como una operación específica para un fallo concreto, con semántica, protecciones y observabilidad propias; nunca como un reset indiscriminado del sistema.

## Decisión 10 — Salud operativa por excepción y ciclo de vida de incidencias

**Aprobada.**

La portada de Operaciones V4 tendrá una franja compacta de **salud operativa por excepción**, no un dashboard voluminoso. Cuando todo esté correcto mostrará un resumen mínimo; cuando exista una anomalía destacará sólo lo que requiere atención y permitirá entrar directamente en su diagnóstico técnico.

La salud operativa podrá señalar, cuando aplique, motor Batch pausado, Batch detenidos, workers o heartbeats ausentes, colas atascadas, leases vencidas, scheduler/planificador sin ejecutar, fuentes bloqueadas, límites agotados y errores técnicos relevantes.

### Los errores tienen estado operativo, pero no se borran

Un error histórico y una incidencia activa no son lo mismo.

- `process_run_errors` y la ejecución original conservan la verdad histórica durante los 30 días acordados.
- Operaciones distinguirá al menos entre incidencia **activa**, **resuelta automáticamente** y **descartada/resuelta manualmente**.
- Si el mismo proceso sobre la misma entidad o alcance técnico se ejecuta posteriormente con éxito y demuestra que la condición anterior ya no persiste, la incidencia debe dejar de aparecer como activa automáticamente, conservando el error histórico para diagnóstico.
- El usuario podrá usar una acción equivalente a **Descartar / Marcar como resuelto** cuando haya verificado que el problema ya no requiere atención. Esta acción no elimina ni altera el error original; sólo cambia su estado operativo de atención.
- Las incidencias resueltas o descartadas seguirán siendo localizables mediante búsqueda y dentro del detalle de la ejecución original mientras estén dentro de la retención de 30 días.
- Si vuelve a producirse la misma condición después de haberse resuelto o descartado, debe aparecer como una nueva incidencia activa; descartar no silencia futuros errores del mismo tipo.
- La resolución manual debe quedar auditada como intervención técnica en la observabilidad canónica y, si tiene consecuencia funcional relevante, reflejarse también en Actividad.

Principio rector: **Operaciones muestra lo que necesita atención ahora sin falsificar ni borrar lo que ocurrió antes**.

## Decisión 11 — Agrupación inteligente de errores repetidos

**Aprobada.**

Operaciones V4 no mostrará cada repetición del mismo fallo como una incidencia independiente cuando todas representen la misma causa operativa. Los errores repetitivos se agruparán de forma conservadora por una huella técnica estable que combine, cuando corresponda, proceso, paso, código/clase de error, fuente y alcance o entidad afectada.

- Cada grupo mostrará al menos número de ocurrencias, primera aparición, última aparición, entidades afectadas y cuántas siguen requiriendo atención.
- La agrupación es sólo una presentación operativa: cada `process_run_error` y cada ejecución original permanecen intactos y accesibles durante la retención acordada.
- Desde el grupo se podrá abrir el detalle y navegar a las ejecuciones/entidades concretas que lo componen.
- No se agruparán errores sólo porque su texto se parezca: si cambian la causa, el proceso, la fuente o el alcance relevante deben mantenerse como incidencias distintas.
- La resolución automática se evaluará sobre el alcance real afectado. Un éxito posterior para una entidad no resolverá indebidamente los fallos todavía activos de otras entidades del mismo grupo.
- Si todas las ocurrencias relevantes quedan resueltas o descartadas, el grupo deja de aparecer como incidencia activa, aunque siga siendo localizable históricamente.
- Una nueva recurrencia posterior a la resolución reactiva la incidencia correspondiente sin perder el historial anterior.

Objetivo: **reducir ruido sin ocultar alcance, recurrencia ni trazabilidad técnica**.