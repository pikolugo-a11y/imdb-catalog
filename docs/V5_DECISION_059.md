# PikoFilm V5 — Decisión 059

## Mejora 59 · V5-C059 — Reducir tablas con demasiado desgaste interno en Neon

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Neon · Rendimiento · Mantenimiento · Eficiencia

**Problema detectado**

En varias tablas se observó acumulación relevante de `dead tuples`, compatible con un patrón de actualizaciones/borrados frecuentes. Aunque este comportamiento es normal en PostgreSQL, una acumulación sostenida puede aumentar el tamaño efectivo de tablas e índices y empeorar determinadas consultas o costes de mantenimiento.

**Alcance aprobado**

1. Medir primero el churn real por tabla y la evolución de `dead tuples` durante una ventana representativa.
2. Comprobar si `autovacuum` y `autoanalyze` están actuando con la frecuencia y eficacia adecuadas antes de modificar configuración.
3. Identificar la causa del churn cuando sea relevante: escrituras repetitivas, actualizaciones innecesarias, estrategias de upsert, procesos de refresco o patrones equivalentes.
4. Optimizar la estrategia de escritura o mantenimiento únicamente donde exista un beneficio medible y un consumidor real.
5. Ajustar parámetros específicos de tablas sólo cuando la evidencia lo justifique y de forma reversible/segura.
6. No utilizar `VACUUM FULL`, reconstrucciones agresivas ni mantenimiento disruptivo como rutina preventiva.
7. Coordinar esta mejora con las decisiones V5 sobre índices y observabilidad SQL para evitar actuaciones aisladas o contradictorias.

**Condición de seguridad**

Ninguna acción de mantenimiento agresivo se aplicará por defecto. El orden será siempre **medir → diagnosticar → actuar sólo si hay beneficio demostrado**.

**Observabilidad**

Las intervenciones técnicas relevantes, cambios de parámetros y resultados de mantenimiento deberán quedar trazados en Operaciones. No se generará Actividad funcional salvo que exista una consecuencia visible o una incidencia real para el usuario.

**Resultado esperado para el usuario**

Neon mantendrá las tablas con menor acumulación innecesaria y menor coste de mantenimiento, sin introducir operaciones agresivas ni cambios de riesgo que no estén respaldados por medición real.

**Decisión del usuario:** aprobada.
