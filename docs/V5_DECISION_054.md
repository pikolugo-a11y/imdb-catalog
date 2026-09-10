# PikoFilm V5 — Decisión 054

## Mejora 54 · V5-C054 — Detectar si workers o crons llevan demasiado tiempo sin ejecutarse

**Estado:** APROBADA  
**Prioridad definitiva:** P1  
**Categoría:** Operaciones · Observabilidad · Fiabilidad · Automatización

## Problema detectado

Un servicio puede figurar como desplegado y, aun así, haber dejado de ejecutar trabajo real. Del mismo modo, un cron puede seguir declarado pero no haber dejado evidencia reciente de ejecución. Eso crea fallos silenciosos difíciles de detectar a tiempo.

## Alcance aprobado

1. Definir para cada worker y cron relevante una expectativa de frescura basada en su cadencia real.
2. Detectar y mostrar en Operaciones cuándo la última ejecución, heartbeat o evidencia técnica supera el umbral esperado.
3. Distinguir estados como saludable, retrasado/degradado, fallando y sin evidencia suficiente, evitando falsos positivos.
4. Integrar este control con el healthcheck integral aprobado en la Mejora 7, reutilizando las mismas fuentes canónicas de verdad.
5. Para crons, comprobar no sólo que la ruta exista, sino que haya evidencia reciente de ejecución real y resultado.
6. Para workers, usar heartbeat/última ejecución/capacidad desplegada cuando exista evidencia fiable, sin inferir salud sólo por estado de deployment.
7. No crear polling agresivo ni una nueva capa de telemetría pesada si la información ya puede derivarse de `process_runs`, infraestructura y señales existentes.
8. Los umbrales deben ser configurables por tipo de proceso/cadencia y documentados; no se usarán límites arbitrarios iguales para todos.

## Observabilidad y ruido

- **Operaciones:** es la superficie principal para mostrar frescura, retrasos, degradación y ausencia de evidencia.
- **Actividad:** sólo debe reflejarse cuando la falta de frescura represente una incidencia funcional relevante; las comprobaciones normales de salud no deben generar ruido.
- Los controles de frescura deben reutilizar la trazabilidad canónica `process_runs`, `process_run_events` y `process_run_errors` cuando aplique.

## Resultado esperado para el usuario

PikoFilm podrá avisar de forma clara cuando un worker o cron que debería estar funcionando lleva demasiado tiempo sin dejar evidencia real, reduciendo los fallos silenciosos y facilitando el diagnóstico desde Operaciones.

**Decisión del usuario:** aprobada.
