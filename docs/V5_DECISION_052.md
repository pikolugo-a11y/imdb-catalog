# PikoFilm V5 — Decisión 52

## Mejora 52 · V5-C052 — Mostrar mejor la relación entre ejecución principal, hijos y continuaciones

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Observabilidad · Diagnóstico · UX

**Problema detectado**

Cuando una ejecución principal desencadena otros procesos, pasos internos, hijos o continuaciones, puede resultar difícil reconstruir visualmente desde Operaciones qué ejecución originó a cuál y en qué punto exacto de la cadena se produjo un fallo.

**Alcance aprobado**

1. Mostrar de forma clara en Operaciones la jerarquía y relación entre ejecución principal, hijos y continuaciones.
2. Reutilizar la correlación canónica ya existente (`run_id`, relaciones de proceso, Batch y cualquier vínculo equivalente disponible) en lugar de crear una segunda fuente de verdad.
3. Permitir abrir una ejecución y navegar hacia sus hijos, su padre o su continuación cuando exista una relación real.
4. Hacer visible dónde se interrumpió una cadena cuando un hijo o continuación falle, evitando obligar al usuario a reconstruir manualmente la secuencia a partir de logs dispersos.
5. Mantener separada la semántica funcional de Actividad y la trazabilidad técnica de Operaciones: esta mejora afecta principalmente a Operaciones.
6. No modificar por esta mejora cómo se lanzan, encadenan o ejecutan los procesos; es una mejora de lectura y diagnóstico.
7. Mantener la presentación coherente con la regla de oro visual V5 y evitar una representación excesivamente compleja cuando una relación simple padre→hijo sea suficiente.
8. Cubrir con pruebas los casos de ejecución sin hijos, un hijo, varios hijos, continuación y fallo en distintos niveles de la cadena.

**Resultado esperado para el usuario**

Al abrir una ejecución en Operaciones será posible entender rápidamente de qué proceso viene, qué trabajos generó después y en qué punto exacto falló una cadena compleja, sin cambiar el comportamiento de ejecución del sistema.

**Decisión del usuario:** aprobada con prioridad P2.