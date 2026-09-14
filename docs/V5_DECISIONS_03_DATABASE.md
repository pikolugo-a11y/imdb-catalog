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
