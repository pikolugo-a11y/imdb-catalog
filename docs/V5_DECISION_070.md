# V5-C070 — Salud básica de fuentes externas

Estado: APROBADA
Prioridad: P3

## Decisión

Añadir en Operaciones una comprobación ligera y comprensible del estado de las fuentes externas relevantes (por ejemplo TMDb, Watchmode y Plex), sin alterar los procesos funcionales existentes ni redefinir su arquitectura.

## Condiciones

- Debe ser una comprobación ligera, con coste y frecuencia controlados.
- No debe introducir polling agresivo ni tráfico innecesario.
- No cambia la lógica funcional actual de TMDb, Watchmode, Plex ni otros proveedores.
- Debe distinguir entre estado correcto, degradado y fallo persistente con lenguaje comprensible.
- Debe reutilizar evidencia operativa existente siempre que sea suficiente antes de crear comprobaciones nuevas.
- Los resultados pertenecen a Operaciones y no deben generar ruido funcional en Actividad salvo que exista una consecuencia real para el usuario.
