# V5-C072 — Pruebas E2E de recorridos críticos

Estado: APROBADA
Prioridad: P1

## Decisión

Añadir pruebas E2E en navegador para un conjunto reducido de recorridos críticos de PikoFilm, centradas en validar comportamiento real de usuario y no sólo contratos internos.

## Alcance

- Calidad: abrir incidencias y recorridos principales.
- Identidad: corrección manual y validación del resultado visible.
- Acciones manuales críticas: ejecución y resultado esperado.
- Actividad / Operaciones: reflejo coherente del resultado técnico y funcional.
- Navegación móvil básica en los flujos principales.

## Criterios

- Mantener el conjunto acotado a recorridos de alto impacto.
- Evitar duplicar pruebas unitarias o contractuales ya existentes.
- Integrar la ejecución en CI de forma estable y mantenible.
- Priorizar señales de regresión funcional reales sobre cobertura exhaustiva.

## Motivo

Actualmente gran parte de la cobertura valida código y contratos, pero no siempre reproduce el flujo completo como lo haría un usuario real en navegador. Esta decisión añade una red de seguridad para los recorridos con mayor coste de fallo.
