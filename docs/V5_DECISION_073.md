# V5-C073 — Accesibilidad automática en CI

- Estado: APROBADA
- Prioridad: P2

## Decisión

Añadir comprobaciones automáticas de accesibilidad en CI para detectar regresiones relevantes antes de mergear cambios.

## Alcance

- Detectar controles sin nombre accesible.
- Detectar problemas básicos de navegación por teclado.
- Detectar formularios/controles mal etiquetados.
- Detectar problemas de contraste cuando la herramienta elegida pueda verificarlos de forma fiable.
- Integrar la comprobación en el flujo de CI sin alterar la UX funcional existente.

## Criterio

La comprobación debe centrarse en regresiones útiles y accionables, evitando ruido excesivo o reglas que bloqueen cambios por falsos positivos sin impacto real.
