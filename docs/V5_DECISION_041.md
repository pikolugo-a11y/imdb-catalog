# PikoFilm V5 — Decisión 41

### Mejora 41 · V5-C041 — Reducir el coste de la página de Inicio

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Inicio · Rendimiento · Neon · Arquitectura de datos

**Problema detectado**

La página de Inicio reúne varios cálculos, agregaciones y señales para resumir el estado general de PikoFilm. Parte de ese trabajo puede repetirse con más frecuencia de la necesaria y aumentar tanto el tiempo de carga como el coste de consultas en Neon.

**Alcance aprobado**

1. Medir primero el coste real de carga de Inicio y descomponerlo por bloques, consultas, agregaciones, round-trips y renderizado.
2. Identificar qué datos necesitan frescura inmediata y cuáles pueden reutilizarse temporalmente sin alterar la verdad funcional que ve el usuario.
3. Reducir o reestructurar agregaciones costosas, cálculos repetidos y lecturas redundantes antes de introducir nuevas estructuras.
4. Reutilizar caché segura, snapshots o read models únicamente cuando la medición demuestre una mejora clara y exista un criterio explícito de frescura/invalidez.
5. No ocultar lentitud con skeletons o mensajes como solución principal; el objetivo es reducir el tiempo real de carga.
6. Mantener exactamente la semántica de los indicadores, contadores, avisos y señales que ya ofrece Inicio.
7. Evitar una segunda fuente de verdad: cualquier snapshot o representación derivada debe poder reconstruirse desde las fuentes canónicas.
8. Integrar esta mejora con las Mejoras 14, 16 y 19 para usar la misma línea base, criterios de caché y validación antes/después.
9. Cubrir con pruebas cualquier cambio que pueda afectar a frescura, recuentos o coherencia funcional de Inicio.

**Resultado esperado para el usuario**

La página de Inicio deberá abrir más rápido y hacer menos trabajo innecesario en Neon, manteniendo los mismos datos y sin mostrar información engañosamente obsoleta.

**Decisión del usuario:** aprobada con prioridad P1.
