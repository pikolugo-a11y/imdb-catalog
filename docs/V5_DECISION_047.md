# Decisión V5-C047 — Actividad sin recarga automática

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Actividad · Rendimiento · UX · Eficiencia

## Reformulación solicitada por el usuario

La propuesta inicial de sustituir la recarga completa cada 30 segundos por un refresco incremental automático queda descartada. El usuario prefiere que **Actividad no se actualice automáticamente** mientras la página está abierta.

## Alcance aprobado

1. Eliminar la recarga periódica automática de Actividad (`setInterval`, refresh periódico o mecanismo equivalente).
2. No sustituirla por otro polling, long-polling, refresco por foco/visibilidad ni mecanismo automático equivalente salvo decisión posterior explícita.
3. Añadir un botón visible y claro **“Actualizar”** para que el usuario decida cuándo refrescar la información.
4. Al pulsar “Actualizar”, refrescar los datos de Actividad de forma fiable y mostrar el estado actualizado sin alterar filtros, contexto o navegación salvo que técnicamente sea imprescindible.
5. Mantener coherencia visual con el sistema canónico V5 y estados claros de acción en curso/fin si la actualización tarda perceptiblemente.
6. Medir la reducción de solicitudes y trabajo de Vercel/Neon respecto al comportamiento actual para confirmar el beneficio real.
7. Mantener intacta la generación automática de actividad por parte de procesos y automatismos: lo que cambia es únicamente cuándo la pantalla consulta y muestra novedades.

## Resultado esperado para el usuario

Actividad dejará de recargarse sola. La página permanecerá estable mientras el usuario la consulta y sólo buscará novedades cuando pulse **“Actualizar”**, reduciendo tráfico y trabajo innecesario sin perder control sobre la frescura de la información.

**Decisión del usuario:** aprobada con prioridad P1 y con actualización exclusivamente manual mediante botón.