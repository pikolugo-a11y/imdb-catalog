# PikoFilm — Baseline de arranque V4

Estado: **canónico**.

Este documento fija el cierre PRE-V4 y el punto de partida auditado desde el que V4 empieza desde cero.

## Baseline funcional

PRE-V4 P0–P8 queda completado. La aplicación V3 fue recorrida y validada en producción sobre las superficies principales: Home, Catálogo, filtros, ficha de película, ficha de serie, Personas y ficha, Novedades, Excluidas, Calidad, Identidad, Validación de identidad, Datos/PikoScore, Películas, Series y detalle, Personas, PikoQuality, Recuperación Lifecycle, Sagas y detalle, y Operaciones/runs/errores.

El único bloqueo funcional detectado durante P8 fue `/catalogo/excluidas`, que fallaba por `NeonDbError 42601: syntax error at or near "year"`. La consulta fue corregida en `lib/excluded-v3-queries.js`, integrada en `main` mediante PR #455 y desplegada en producción. El usuario revalidó visualmente que Excluidas vuelve a cargar correctamente con sus 180 registros, filtros, resumen, ordenación y vista de tarjetas.

El deployment de producción que contiene la corrección corresponde al commit `d01172e7a46d6266284ac97198a3de8e8ab4b71f` y quedó `READY`. Tras la revalidación no se observaron errores `error/fatal` en los logs runtime del deployment.

## Gate PRE-V4

- CI de `main`: verde para la PR #455.
- Issues heredadas abiertas: **0**.
- Documentación viva: reducida a fuentes canónicas.
- Catálogo de procesos y Batch: consolidado y coherente con el código vivo.
- Neon: limpieza PRE-V4 completada; no queda legacy destructivo conocido que bloquee V4.
- Railway: servicios persistentes auditados por responsabilidad; no se eliminó ninguno por nombre o apariencia.
- P8: recorrido funcional/UX completado y bloqueo de Excluidas corregido y revalidado en producción.
- V4: no hereda backlog V3/PRE-V4. Sus decisiones e issues se crean desde cero.

## Contexto UX para V4

`docs/product/V4_UX_FOUNDATION.md` conserva las conclusiones del recorrido visual de V3: fortalezas que conviene preservar, fricciones observadas y principios de diseño candidatos para V4. No es backlog, especificación cerrada ni lista automática de requisitos.

Hallazgo no bloqueante conservado como contexto: la colección de Sagas `El padrino` mostró una asociación visualmente sospechosa con `Las aventuras de Jackie Chan`. La UI de Sagas funciona; la causa de datos no se presupone y deberá redescubrirse/auditarse sólo si V4 decide trabajar esa dimensión.

## Regla para nuevas sesiones

Este baseline es contexto, no arquitectura paralela. Para desarrollar V4, una sesión nueva debe comenzar en `/AGENTS.md`, seguir `docs/README.md` y consultar las fuentes canónicas del dominio afectado. El sistema vivo continúa mandando.

## Punto de partida

La PR de cierre final PRE-V4 integra este documento y retira el plan temporal `PRE_V4_READINESS_PLAN.md`. El **merge commit de esa PR en `main`** es el commit baseline definitivo de V4.
