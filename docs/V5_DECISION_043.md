# PikoFilm V5 — Decisión 43

### Mejora 43 · V5-C043 — Unificar y abaratar la lógica de “requiere atención” en Inicio

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Inicio · Rendimiento · Coherencia · Neon

**Problema detectado**

La portada puede construir avisos y señales de atención mediante consultas o reglas separadas. Esto puede repetir trabajo y también crear pequeñas divergencias entre lo que Inicio considera que necesita atención y lo que otras superficies interpretan como el mismo estado funcional.

**Alcance aprobado**

1. Identificar todas las reglas y consultas que alimentan actualmente los bloques de “requiere atención” o equivalentes en Inicio.
2. Definir una lógica canónica reutilizable para cada condición funcional relevante, evitando cálculos paralelos con semántica ligeramente distinta.
3. Reducir consultas, agregaciones o transformaciones repetidas cuando puedan compartir una fuente o resultado sin pérdida de exactitud.
4. Mantener dinámicas las señales cuya frescura inmediata sea funcionalmente necesaria.
5. Aplicar caché, snapshot o reutilización sólo cuando el dato pueda conservar una frescura segura y explícita.
6. No cambiar qué se considera problema o atención salvo que la auditoría detecte una incoherencia real; cualquier cambio semántico deberá justificarse y mantener coherencia entre superficies.
7. Reutilizar fuentes canónicas existentes y evitar crear una segunda fuente de verdad para estados de atención.
8. Medir antes/después el coste de las consultas y el tiempo de carga de Inicio, coordinándolo con las Mejoras 14 y 41.
9. Cubrir con pruebas los estados principales para garantizar que Inicio y las superficies relacionadas muestran la misma interpretación funcional.

**Resultado esperado para el usuario**

Inicio deberá cargar con menos trabajo redundante y mostrar avisos coherentes con el resto de PikoFilm. Una misma situación funcional no deberá ser interpretada de forma distinta según la pantalla desde la que se consulte.

**Decisión del usuario:** aprobada con prioridad P2.
