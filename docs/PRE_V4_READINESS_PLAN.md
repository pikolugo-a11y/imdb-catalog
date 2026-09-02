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
- P7 — issues + limpieza documental final: **cerrado**; GitHub quedó con 0 issues abiertas heredadas.
- P8 — auditoría funcional/UX completa: **auditoría ejecutada; cierre pendiente únicamente de revalidar en producción el bloqueo de Excluidas corregido en código y superar el gate final**.

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

Se recorrió sobre producción: Home, Catálogo, filtros, ficha de película, ficha de serie, Personas y ficha, Novedades, Calidad, Identidad, Validación de identidad, Datos/PikoScore, Películas, Series y detalle, Personas, PikoQuality, Recuperación Lifecycle, Sagas y detalle, y Operaciones/runs/errores.

Resultado general: las superficies observadas son funcionalmente coherentes con V3, Lifecycle y los procesos canónicos. No se detectaron regresiones bloqueantes en esos recorridos salvo `/catalogo/excluidas`.

### Bloqueo P8: Excluidas

En producción `/catalogo/excluidas` falló con excepción server-side, digest `3373281126`. Los logs de runtime mostraron `NeonDbError 42601: syntax error at or near "year"`. La causa estaba en aliases SQL no explícitos en `lib/excluded-v3-queries.js`; se corrige usando `AS` de forma inequívoca en el query de listado y estadísticas. El cierre de P8 exige desplegar el commit corregido y validar que Excluidas carga de nuevo.

### Hallazgo no bloqueante: Sagas

La colección `El padrino` mostró como miembro una obra con título/carátula de `Las aventuras de Jackie Chan`. La UI de Sagas se comportó correctamente, pero el dato sugiere una asociación o enriquecimiento incorrecto. No se atribuye la causa sin una auditoría específica de datos y no bloquea por sí solo la baseline funcional.

### Fundación UX V4

Las conclusiones del recorrido visual se consolidan en `docs/product/V4_UX_FOUNDATION.md`. Ese documento conserva fortalezas, fricciones y principios de diseño detectados en V3, pero no crea backlog ni convierte ideas antiguas en requisitos automáticos de V4.

Los hallazgos PRE-V4 se corrigen sólo si afectan a la baseline que debe quedar cerrada. Las ideas de evolución no se convierten en backlog V4 durante esta fase.
