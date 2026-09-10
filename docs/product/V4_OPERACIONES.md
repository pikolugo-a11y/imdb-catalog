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
