# PikoFilm — PRE-V4 readiness

Estado: **activo hasta superar P8 y el gate final**.

Objetivo: dejar una baseline limpia, coherente y verificable antes de empezar V4 desde cero.

## Principios

- El sistema vivo manda.
- Auditar antes de borrar.
- Una responsabilidad, una implementación canónica.
- Batch reutiliza la operación individual canónica.
- Neon destructivo sólo mediante migración revisable + smoke.
- No inferir legacy por nombres.
- Git conserva la historia; la documentación vigente no debe conservar ruido histórico.
- V4 arrancará con **0 issues abiertas heredadas**.
- No se define backlog V4 durante PRE-V4.

## Estado de fases

- P0 — baseline V3: **cerrado**.
- P1 — auditoría exhaustiva del repositorio: **cerrado**.
- P2 — limpieza física de GitHub/código: **cerrado**.
- P3 — auditoría/limpieza Neon: **cerrado**.
- P4 — Railway/execution plane: **cerrado**.
- P5 — catálogo definitivo de procesos/Batch: **cerrado**.
- P6 — documentación canónica: **cerrado**.
- P7 — issues + limpieza documental final: **cerrado cuando `main` contenga este cleanup y GitHub confirme 0 issues abiertas**.
- P8 — auditoría funcional/UX completa: **pendiente**.

## Gate final PRE-V4

Antes de iniciar V4 deben cumplirse todos:

1. CI de `main` en verde.
2. 0 issues abiertas heredadas.
3. Documentación de `main` limitada a fuentes canónicas vigentes.
4. Catálogo de procesos y Batch coherentes con código vivo.
5. Neon sin legacy destructivo pendiente que bloquee evolución.
6. Railway reducido a servicios con responsabilidad demostrada.
7. P8 completado sobre la aplicación desplegada y validada por el usuario.
8. Cualquier defecto bloqueante encontrado en P8 corregido y revalidado.
9. Crear un único baseline final/tag/commit de partida para V4.
10. V4 crea sus decisiones e issues desde cero a partir de esa baseline; no hereda automáticamente propuestas V3/PRE-V4.

## P8 — auditoría funcional y UX

Recorrer como mínimo Home, Catálogo, fichas película/serie, Novedades, Calidad y colas, Series, Personas, Sagas, PikoQuality, Excluidas, Admin/Operaciones/Batch y vistas de runs/errores.

Para cada pantalla revisar: propósito, jerarquía de información, terminología, componentes, interacción, estados loading/error/empty/success, responsive/accesibilidad, rendimiento percibido y coherencia con Lifecycle/procesos canónicos.

Los hallazgos PRE-V4 se corrigen sólo si afectan a la baseline que debe quedar cerrada. Las ideas de evolución no se convierten en backlog V4 durante esta fase.
