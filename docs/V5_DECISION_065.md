# V5-C065 — ETA de Batch

Estado: APROBADA
Prioridad: P2

## Decisión

Mostrar en la interfaz de los procesos Batch una estimación del tiempo restante calculada a partir del progreso real y de la velocidad reciente de la ejecución.

## Condiciones

- No cambia la lógica ni la planificación de los Batch; es una mejora de información para el usuario.
- La estimación debe derivarse de datos reales de progreso y ritmo reciente, nunca de una duración fija inventada.
- Mientras no haya evidencia suficiente para estimar con fiabilidad, mostrar `Calculando…` o equivalente, no una cifra engañosa.
- La ETA debe ajustarse durante la ejecución cuando cambie el ritmo.
- Si el progreso disponible no permite una estimación razonable, se omite la ETA sin afectar al estado funcional del Batch.
- Debe reutilizar la observabilidad y el estado Batch ya existentes, evitando crear una segunda fuente de verdad.
- No debe añadir polling adicional únicamente para la ETA; se actualizará con el mecanismo de refresco/progreso que quede aprobado para la superficie correspondiente.
- La UX debe distinguir claramente progreso conocido de tiempo estimado.
- No afecta al orden de implementación: se ejecutará según dependencias, riesgo y prioridad del roadmap V5.
