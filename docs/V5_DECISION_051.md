# Mejora 51 · V5-C051 — Compactar payloads técnicos en Operaciones

**Estado:** APROBADA
**Prioridad definitiva:** P2
**Categoría:** Operaciones · Observabilidad · Neon · Eficiencia

**Problema detectado**

`process_run_events` acumula un volumen importante y parte de ese crecimiento puede proceder de payloads técnicos demasiado grandes, repetidos o con información que ya existe en otras fuentes canónicas.

**Alcance aprobado**

1. Auditar los tipos de evento y payloads almacenados actualmente en `process_run_events` y estructuras relacionadas.
2. Identificar campos redundantes, respuestas externas completas innecesarias, duplicidades entre eventos y datos técnicos que puedan representarse de forma más compacta sin perder capacidad diagnóstica.
3. Mantener siempre la información necesaria para reconstruir estado, error, tiempos, correlación, origen, entidad/proceso afectado y contexto suficiente para investigar incidencias reales.
4. No eliminar información útil sólo para ahorrar espacio. Cualquier compactación debe basarse en uso real y evidencia de redundancia o sobredimensionamiento.
5. Evitar almacenar secretos, credenciales o payloads sensibles en claro, reforzando la regla ya vigente de auditoría segura.
6. Cuando un dato grande exista de forma canónica en otra tabla o fuente, preferir referencia/correlación frente a duplicación completa si sigue siendo fácil de diagnosticar.
7. Medir antes y después tamaño medio de eventos, crecimiento de tabla y coste de consultas históricas relevantes.
8. Coordinar la mejora con la optimización general de Operaciones y con cualquier política futura de retención, sin crear otra fuente de verdad paralela.

**Condición explícita del usuario**

La reducción se aplicará únicamente a payloads redundantes o sobredimensionados; la trazabilidad útil para diagnóstico y correlación debe quedar intacta.

**Resultado esperado para el usuario**

Operaciones conservará el mismo nivel de diagnóstico útil, pero Neon almacenará menos volumen innecesario y las consultas históricas podrán ser más ligeras y sostenibles.

**Decisión del usuario:** aprobada con prioridad P2.
