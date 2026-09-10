# PikoFilm V5 — Decisión 50

## Mejora 50 · V5-C050 — Crear índices específicos para Operaciones sólo cuando el uso real los justifique

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Neon · Rendimiento · Base de datos

**Problema detectado**

Operaciones consulta de forma intensiva las fuentes canónicas `process_runs`, `process_run_events` y `process_run_errors`, con filtros y ordenaciones recurrentes por estado, fecha, proceso, correlación y otros campos técnicos. Algunos patrones pueden beneficiarse de índices más adecuados, pero añadir índices sin medir puede aumentar escrituras, almacenamiento y complejidad sin una mejora real.

**Alcance aprobado**

1. Medir primero las consultas reales de Operaciones y sus planes de ejecución antes de crear, modificar o retirar índices.
2. Identificar qué filtros, ordenaciones y joins se repiten realmente y cuáles concentran coste o latencia relevante.
3. Crear o ajustar índices sólo cuando exista un consumidor claro y una mejora demostrable en tiempos, filas procesadas o coste del plan.
4. Revisar antes los índices existentes para detectar solapamientos o duplicidades y evitar añadir estructuras redundantes.
5. No crear índices “por si acaso” ni basarse únicamente en snapshots puntuales de `idx_scan`; la decisión deberá apoyarse en carga representativa y EXPLAIN/medición real.
6. Evaluar el impacto de cualquier índice nuevo en escrituras, mantenimiento y tamaño, especialmente sobre tablas grandes como `process_run_events`.
7. Coordinar esta mejora con la Mejora 49 para que el diseño de consultas y el diseño de índices evolucionen juntos y no como soluciones separadas.
8. Mantener intacta la semántica funcional y la capacidad de diagnóstico de Operaciones.
9. Si un índice actual demuestra estar realmente duplicado o sin uso durante una ventana representativa, su retirada se tratará dentro de la mejora específica de gobernanza de índices correspondiente, no como una limpieza automática derivada de esta decisión.

**Resultado esperado para el usuario**

Operaciones deberá responder más rápido cuando el cuello de botella esté en el acceso a datos, pero sin llenar Neon de índices innecesarios. Cada cambio deberá tener una razón medible y una mejora demostrada.

**Decisión del usuario:** aprobada con prioridad P2 y con la condición explícita de medir primero las consultas y planes reales, evitar índices especulativos y revisar solapamientos antes de añadir nada.
