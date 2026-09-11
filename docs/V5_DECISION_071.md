# V5-C071 — Descubrimiento automático de tests

- Estado: APROBADA
- Prioridad: P1

## Decisión

Evitar que pruebas automáticas nuevas queden fuera del CI por depender de una lista manual de archivos en `test:quality`.

## Condiciones

- Implementar descubrimiento automático de tests válidos o, como mínimo, una validación que falle si existe un test del repositorio que no está incluido en la suite canónica.
- No cambiar el comportamiento funcional de PikoFilm.
- Mantener separadas las suites cuando tenga sentido por coste o responsabilidad, pero sin permitir tests huérfanos por olvido.
- El CI debe seguir siendo la puerta de entrada antes de mergear cambios.
- La solución debe ser simple y mantenible; no introducir un framework de testing nuevo si no es necesario.
