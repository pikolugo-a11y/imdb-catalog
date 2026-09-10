# Mejora 48 · V5-C048 — Unificar la semántica de incidencia activa

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Actividad · Operaciones · Inicio · Observabilidad · Coherencia funcional

**Problema detectado**

Distintas superficies de PikoFilm pueden interpretar de forma ligeramente diferente cuándo una incidencia debe considerarse activa, resuelta, degradada o simplemente histórica. Eso puede provocar contradicciones entre Inicio, Actividad y Operaciones aunque todas estén describiendo el mismo hecho.

**Alcance aprobado**

1. Definir una única regla canónica para clasificar incidencias como activas, resueltas, degradadas, sin evidencia reciente o históricas, reutilizando las fuentes canónicas V4/V5.
2. Aplicar esa misma semántica en Inicio, Actividad y Operaciones, evitando criterios paralelos por página.
3. Mantener la información funcional real; esta mejora no inventa incidencias nuevas ni cambia estados sin evidencia, sino que unifica su interpretación.
4. Correlacionar las vistas con los mismos hechos técnicos y funcionales cuando exista `run_id`, proceso, Batch o entidad afectada.
5. Evitar duplicar fuentes de verdad: una incidencia debe tener un estado canónico y distintas superficies sólo presentar ese estado según su contexto.
6. Cuando no exista evidencia suficiente para declarar una incidencia resuelta o activa, mostrar un estado explícito de incertidumbre/falta de evidencia en vez de asumir.
7. Integrar esta mejora con el chequeo de salud de Operaciones aprobado en la Mejora 7 y con cualquier lógica de atención/estado de Inicio aprobada en la Mejora 43.
8. Cubrir con pruebas los principales estados y transiciones para impedir que futuras superficies vuelvan a redefinir la semántica por su cuenta.

**Resultado esperado para el usuario**

Si PikoFilm muestra una incidencia como activa en una pantalla, no deberá aparecer como resuelta o simplemente histórica en otra sin una razón real. Inicio, Actividad y Operaciones hablarán el mismo idioma sobre el estado de cada incidencia.

**Decisión del usuario:** aprobada con prioridad P1.
