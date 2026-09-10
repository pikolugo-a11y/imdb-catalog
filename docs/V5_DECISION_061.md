# PikoFilm V5 — Decisión 61

## Mejora 61 · V5-C061 — Retención controlada de `process_run_events`

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Observabilidad · Neon · Retención

**Problema detectado**

`process_run_events` es una de las tablas grandes del sistema y seguirá creciendo mientras PikoFilm funcione. Aunque la Mejora 51 reduzca payloads redundantes o sobredimensionados, conservar indefinidamente todo el detalle granular puede aumentar almacenamiento y encarecer consultas históricas sin aportar valor proporcional.

**Alcance aprobado**

1. Definir una política de retención razonable para eventos técnicos detallados de `process_run_events`.
2. Mantener siempre la información necesaria para diagnóstico y trazabilidad: ejecuciones, errores, estados finales, correlaciones y evidencia técnica relevante.
3. No eliminar información reciente o necesaria para investigar incidencias activas, degradaciones, procesos en curso o anomalías relevantes.
4. Los eventos antiguos y de bajo valor podrán compactarse o eliminarse después de una ventana suficiente y explícitamente definida.
5. `process_runs` y `process_run_errors` continúan siendo fuentes canónicas principales y no quedan sometidas automáticamente a la misma política por esta mejora.
6. Antes de aplicar borrados o compactación, medir crecimiento, distribución temporal, volumen por tipo de evento y consumidores reales del histórico.
7. La política debe ser segura, verificable y reversible en su diseño; no se aplicarán purgas agresivas por defecto.
8. Integrar esta mejora con la reducción de payloads de la Mejora 51 para minimizar crecimiento futuro antes de retirar histórico útil.

**Observabilidad**

- La ejecución de tareas de retención o compactación deberá quedar trazada técnicamente en **Operaciones** con ventana afectada, volumen procesado, resultado y errores si los hubiera.
- No debe generar ruido funcional en **Actividad** salvo que una operación de retención tenga una consecuencia funcional relevante.

**Resultado esperado para el usuario**

PikoFilm conservará el historial técnico realmente útil para investigar y entender procesos, evitando a la vez que `process_run_events` crezca indefinidamente con detalle antiguo de poco valor y termine penalizando Neon o la propia página de Operaciones.

**Decisión del usuario:** aprobada.
