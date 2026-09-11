# V5-C068 — Auditoría estática de bypass de fuentes gobernadas

Estado: RECHAZADA
Prioridad propuesta: P1

## Decisión
No se añadirá en V5 una auditoría estática/CI específica para detectar llamadas directas que se salten el gobierno de APIs o fuentes externas.

## Alcance
- No se introduce un gate de CI para bloquear `fetch()` directos a fuentes gobernadas.
- No se crea una whitelist adicional de adaptadores permitidos.
- Se mantienen las protecciones y contratos existentes del gobierno de APIs.
- La decisión no impide corregir bypasses concretos si se detectan durante mantenimiento o incidencias reales.
