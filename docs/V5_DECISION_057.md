# PikoFilm V5 — Decisión 57

## Mejora 57 · V5-C057 — Retirar índices realmente no utilizados tras una ventana representativa

**Estado:** APROBADA  
**Prioridad definitiva:** P2  
**Categoría:** Neon · Rendimiento · Índices · Mantenimiento

### Problema detectado

En la auditoría PRE-V5 aparecen varios índices con `idx_scan = 0`, pero una fotografía puntual no demuestra por sí sola que sean inútiles. Algunos pueden corresponder a procesos poco frecuentes, restricciones, integridad o consultas que no han ocurrido durante la ventana observada.

### Alcance aprobado

1. Observar el uso de índices durante una ventana suficientemente representativa antes de plantear cualquier retirada.
2. Verificar consumidores reales, restricciones, claves, integridad y planes de consulta antes de eliminar un índice.
3. No retirar ningún índice basándose únicamente en una captura puntual de `idx_scan = 0`.
4. Eliminar sólo índices demostrados como huérfanos, redundantes o innecesarios mediante evidencia de uso y análisis de consultas.
5. Comparar impacto esperado en espacio, coste de escritura, mantenimiento y rendimiento de lectura antes de aplicar cambios.
6. Coordinar esta mejora con V5-C050 y V5-C058 para evitar crear nuevos índices mientras se mantienen otros equivalentes o solapados.
7. Toda retirada deberá ser reversible y realizarse con un plan seguro de implantación si existe cualquier riesgo operacional.

### Condición obligatoria

La ausencia de escaneos en una única medición no autoriza ningún borrado. La decisión se apoya en una ventana representativa y verificación técnica completa.

### Observabilidad

Las retiradas realizadas y su justificación deberán quedar trazadas en Operaciones como mantenimiento técnico relevante, sin generar ruido en Actividad salvo que exista una consecuencia funcional visible.

### Resultado esperado para el usuario

Neon mantendrá únicamente los índices que aporten una función real, reduciendo espacio, coste de escritura y mantenimiento sin arriesgar el rendimiento de las consultas legítimas.

**Decisión del usuario:** aprobada con validación obligatoria sobre ventana representativa y sin borrados por una única fotografía de uso.
