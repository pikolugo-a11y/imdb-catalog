# PikoFilm V5 — Decisión 49

### Mejora 49 · V5-C049 — Medir y reducir el coste real de la página de Operaciones

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Rendimiento · Neon · UX

**Problema detectado**

Operaciones reúne ejecuciones, eventos, errores, estados y acciones de mantenimiento. Esa riqueza puede convertirla en una de las superficies más costosas si carga históricos, payloads técnicos o relaciones pesadas aunque el usuario sólo necesite primero el estado actual.

**Alcance aprobado**

1. Medir primero el coste real de carga de Operaciones, separando consultas, joins, agregaciones, eventos, errores, payloads e históricos.
2. Priorizar una carga inicial rápida del resumen, estado actual e incidencias relevantes.
3. Diferir históricos extensos, payloads técnicos pesados y detalle profundo hasta que el usuario los solicite o abra.
4. Mantener toda la capacidad de diagnóstico existente; la optimización no puede ocultar ni eliminar información necesaria para investigar fallos.
5. Evitar consultas duplicadas y recuperar sólo las columnas/datos necesarios para cada nivel de detalle.
6. Coordinar esta mejora con la Mejora 14 de rendimiento global y con la observabilidad canónica basada en `process_runs`, `process_run_events` y `process_run_errors`.
7. Mantener coherencia con la regla de incidencias de la Mejora 48 y con el sistema visual V5.
8. Medir antes/después tiempos de respuesta, consultas, filas procesadas y coste cuando sea posible.
9. Cerrar la mejora sólo si existe una reducción objetiva del coste o una justificación documentada de los límites inevitables.

**Resultado esperado para el usuario**

Operaciones deberá abrir más rápido mostrando primero lo necesario para saber si PikoFilm está bien o qué requiere atención. El detalle histórico y técnico seguirá disponible cuando haga falta, pero dejará de penalizar innecesariamente la carga inicial.

**Decisión del usuario:** aprobada con prioridad P2.
