# V4 — Actividad y Operaciones orientadas a la persona (2026-09-12)

Decisión funcional aprobada para cerrar V4.

## Principio

**Actividad responde «¿qué pasó?»** y **Operaciones responde «¿hay algo que tenga que hacer?»**.

La observabilidad técnica sigue existiendo y no se elimina, pero deja de ser la capa principal de experiencia.

## Actividad

1. La entidad humana es protagonista: se muestra el nombre de película, serie, persona o saga antes que sus IDs internos.
2. El resultado explica el efecto funcional cuando hay evidencia estructurada: por ejemplo, un episodio que pasó de faltante a presente.
3. Las acciones manuales se redactan como decisiones del usuario (`Tú`) y las automáticas como `Automático`.
4. IDs, `run_id`, códigos `PROC-*`, executor y detalles equivalentes quedan en el detalle técnico.
5. Las comprobaciones automáticas repetitivas sin cambios se agrupan para evitar ruido.
6. Nunca se inventa un resultado. Si una automatización necesita contar cambios concretos, el proceso canónico debe emitir un diff estructurado antes/después.

## Operaciones

1. La portada muestra únicamente estado vivo, trabajos en marcha, incidencias que siguen abiertas y acciones disponibles.
2. Si todo funciona correctamente, la página debe poder decirlo de forma explícita y quedar visualmente limpia.
3. El historial de ejecuciones, IDs, procesos, executor y filtros técnicos se conserva en **Diagnóstico avanzado**, cerrado por defecto y abierto automáticamente cuando existen filtros de búsqueda.
4. Cuando una ejecución corresponde a una entidad conocida, se muestra su nombre humano como información principal.
5. Operaciones no sustituye a Actividad: el historial funcional cotidiano se consulta en Actividad; Operaciones sirve para actuar o investigar.

## Series

Para `PROC-SER-002`, el worker conserva una instantánea del diagnóstico antes y después de actualizar Plex. Sólo se informa de un episodio «recuperado» cuando existe una transición demostrable de `missing` a `present`/`covered_combined`, y de un nuevo faltante cuando ocurre la transición inversa. El resultado estructurado se persiste en la observabilidad del proceso para que Actividad pueda explicarlo sin inferencias posteriores.
