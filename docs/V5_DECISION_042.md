# Mejora 42 · V5-C042 — Usar una única fuente canónica para la última sincronización de Plex

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Inicio · Plex · Observabilidad · Coherencia de datos

**Problema detectado**

La página de Inicio puede obtener la fecha o estado de la última sincronización global de Plex desde una fuente histórica distinta de la observabilidad canónica V4. Eso puede provocar que Inicio y Operaciones muestren interpretaciones diferentes del mismo proceso.

**Alcance aprobado**

1. Verificar primero si la sincronización global de Plex queda representada de forma completa y fiable en la fuente canónica `process_runs`.
2. Si `process_runs` contiene toda la información funcional necesaria, hacer que Inicio derive de ahí la fecha/estado de la última sincronización de Plex.
3. Si la trazabilidad canónica es incompleta, corregir primero esa representación antes de migrar Inicio; no se forzará un cambio parcial que pierda información.
4. Mantener la sincronización global de Plex como proceso manual; esta mejora no introduce polling ni automatización adicional.
5. Evitar mantener dos fuentes de verdad paralelas para el mismo hecho. Las tablas históricas podrán conservarse únicamente mientras tengan consumidores reales y una función distinta demostrada.
6. Asegurar que Inicio y Operaciones interpreten el mismo hecho canónico con reglas coherentes de éxito, fallo, ejecución en curso y ausencia de evidencia.
7. Cubrir con pruebas la equivalencia de la fecha/estado visible antes y después de la migración.

**Resultado esperado para el usuario**

La fecha y el estado de la última sincronización de Plex que aparezcan en Inicio deberán coincidir con la trazabilidad real de Operaciones, evitando contradicciones entre pantallas y manteniendo intacto el carácter manual de la sincronización global.

**Decisión del usuario:** aprobada con prioridad P2 y con la condición de migrar a `process_runs` sólo cuando la representación canónica sea completa y fiable.
