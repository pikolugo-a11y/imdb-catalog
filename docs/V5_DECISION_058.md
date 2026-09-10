# PikoFilm V5 — Decisión 58

## Mejora 58 · V5-C058 — Detectar y retirar índices duplicados o solapados

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Neon · Rendimiento · Índices · Mantenimiento

**Problema detectado**

La base de datos puede contener índices distintos que cubren columnas o patrones de acceso muy similares. Mantener índices redundantes incrementa espacio, coste de escrituras y mantenimiento sin aportar necesariamente una mejora real de lectura.

**Alcance aprobado**

1. Inventariar los índices que puedan ser duplicados, casi duplicados o funcionalmente solapados.
2. Revisar sus consumidores reales, restricciones asociadas y planes de consulta antes de retirar nada.
3. Utilizar evidencia de uso representativa y `EXPLAIN`/planes reales cuando proceda.
4. Retirar únicamente índices cuyo papel quede cubierto por otro índice y cuya eliminación no perjudique consultas, integridad ni procesos poco frecuentes.
5. Coordinar este trabajo con las Mejoras 50 y 57 para evitar análisis o cambios duplicados.
6. Medir, cuando sea relevante, el efecto en tamaño, coste de escritura y rendimiento de las consultas afectadas.
7. No sustituir un conjunto redundante por una nueva colección de índices especulativos.

**Condición del usuario**

Aprobada únicamente con retirada basada en evidencia real; no se eliminará ningún índice por similitud aparente sin comprobar consumidores y planes.

**Observabilidad**

Las intervenciones de mantenimiento relevantes deben quedar registradas técnicamente en Operaciones. No deben generar actividad funcional salvo que exista una consecuencia real para el usuario.

**Resultado esperado para el usuario**

Neon mantendrá sólo los índices que aporten valor real, reduciendo mantenimiento y coste sin degradar búsquedas, procesos o integridad de datos.

**Decisión del usuario:** aprobada.
