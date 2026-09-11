# V5-C066 — Batch dry-run

**Estado:** RECHAZADA
**Prioridad original:** P3

## Decisión

No se implementará un modo de simulación/dry-run para los Batch en V5.

## Alcance

- No se añade una segunda vía de ejecución simulada para los procesos Batch.
- No se obliga a cada proceso a mantener semántica dual real/simulada.
- Se prioriza la simplicidad operativa y evitar divergencias entre lo que una simulación diga que ocurriría y lo que finalmente ocurra en ejecución real.
- Esta decisión no afecta a validaciones, checks previos, healthchecks ni a mejoras de observabilidad ya aprobadas.
