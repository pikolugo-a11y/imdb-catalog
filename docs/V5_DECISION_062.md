# PikoFilm V5 — Decisión 62

## Mejora 62 · V5-C062 — Retirar tablas de compatibilidad realmente huérfanas

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Datos · Limpieza legacy · Neon · Mantenibilidad

**Problema detectado**

Con la evolución de PikoFilm pueden permanecer tablas antiguas o de transición que ya no forman parte de la arquitectura viva. Mantener estructuras sin consumidores reales añade confusión, coste de mantenimiento y riesgo de reutilización accidental.

**Alcance aprobado**

1. Realizar un consumer sweep completo antes de retirar cualquier tabla candidata.
2. Revisar código vivo, consultas, procesos, jobs, workers, crons, funciones SQL y dependencias funcionales.
3. Retirar únicamente tablas cuya orfandad quede demostrada de forma concluyente.
4. No borrar una tabla por llamarse `legacy`, `compat`, por su antigüedad o por parecer obsoleta.
5. Si existe un consumidor legítimo, la tabla se mantiene hasta que ese consumidor sea migrado de forma segura.
6. Revisar claves foráneas, vistas, funciones, triggers, índices y otras dependencias antes de cualquier eliminación.
7. Aplicar la retirada de forma compatible y recuperable, evitando cambios destructivos prematuros.
8. Coordinar esta limpieza con la Mejora 5 sobre schema readiness y con la futura versión/fingerprint explícita del esquema.

**Condición estricta del usuario**

Sólo se retirarán tablas cuya orfandad quede demostrada por completo, después de revisar código, procesos, consultas, jobs y dependencias funcionales.

**Observabilidad**

La retirada técnica debe quedar registrada en Operaciones con la estructura afectada, verificaciones realizadas y resultado. Actividad sólo debe reflejarlo si produce una consecuencia funcional relevante para el usuario.

**Resultado esperado para el usuario**

Neon conserva únicamente estructuras con una función real o una transición todavía necesaria, reduciendo deuda técnica y evitando que futuras evoluciones se apoyen por error en tablas abandonadas.

**Decisión del usuario:** aprobada.
