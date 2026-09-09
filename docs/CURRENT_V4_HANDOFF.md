# PikoFilm V4 — Handoff canónico de continuidad

Última actualización: 2026-09-09

Este documento existe para poder abrir una conversación nueva sin depender del historial del chat. Debe leerse al comienzo de cualquier nueva sesión junto con `AGENTS.md`, `docs/README.md`, `docs/BASELINE_V4_START.md` y las fuentes canónicas del dominio que se vaya a trabajar.

## Punto exacto actual

- Repositorio: `pikolugo-a11y/imdb-catalog`.
- `Calidad V4` está **implementada y mergeada a `main`** mediante PR **#502**.
- Merge de Calidad V4: `b1db67c0315229fd3ec3f04f693b5475a2872d3d`.
- Calidad queda basada en las **75 decisiones aprobadas** del contrato `docs/product/V4_CALIDAD.md`.
- UX elegida: **modelo híbrido**.
- La antigua rama `feat/calidad-v4-hybrid` ya no contiene trabajo pendiente respecto a `main`; quedó absorbida por PR #502.
- El usuario realiza exclusivamente los deployments de producción en Vercel. ChatGPT **no despliega Vercel**.

## Calidad V4 recién cerrada

La implementación mergeada incluye:

- hub principal de Calidad con lectura funcional;
- separación transversal entre `Requieren atención`, `En seguimiento automático` y `Al día`;
- Centro de Calidad común para dominios que no necesitan una gran pantalla protagonista;
- `Películas` como superficie especializada de validación física/deuda histórica;
- `Series` como superficie especializada rica más ficha de detalle;
- continuación automática de procesos de Series después del **sync global Plex manual**;
- mantenimiento automático por dominio cuando fue aprobado;
- mantenimiento técnico masivo de PikoQuality trasladado a Operaciones, conservando controles individuales funcionales;
- contratos/tests que protegen la arquitectura V4.

El sync global Plex **sigue siendo manual**. No debe introducirse polling automático de Plex.

## Cómo trabajamos

Regla permanente de producto y desarrollo:

1. Las decisiones funcionales se discuten **una a una** cuando haga falta decisión del usuario.
2. ChatGPT es responsable del **diseño UX/UI** y puede proponer/implantar la mejor solución visual manteniendo coherencia con PikoFilm. Se puede usar V3 como base conceptual/visual, pero V4 no debe copiarla mecánicamente.
3. El usuario no tiene que definir verbalmente botones, columnas, espacios o detalles visuales salvo que quiera corregir algo después de probarlo.
4. Cada decisión funcional o UX aprobada se **documenta inmediatamente en Git antes de pasar a la siguiente**. El chat no es la memoria canónica.
5. Una vez existe autorización de implantación: ChatGPT implementa, prueba, revisa CI, abre PR y **hace el merge**. No debe pedir al usuario que haga el merge.
6. Tras el merge, ChatGPT avisa al usuario para que él haga el **deploy de producción en Vercel**.
7. Después del deploy, el usuario hace la aceptación funcional/visual y ChatGPT corrige lo necesario.
8. Evitar proliferación de ramas: **una rama de trabajo por bloque** siempre que sea posible.

## Fuente de verdad UX

Para Calidad:

- contrato funcional: `docs/product/V4_CALIDAD.md`;
- solución UX: **híbrida**;
- boceto seleccionado en la biblioteca de trabajo: `V4-UX-014-calidad-estructura-hibrida.png`;
- V3 puede servir como referencia de lenguaje y patrones conocidos, pero el diseño final es responsabilidad de ChatGPT y debe sentirse como una evolución V4 coherente, no un clon de V3.

## Qué queda después de Calidad

El siguiente trabajo de V4, según el punto alcanzado con el usuario, es:

1. **Actividad V4**.
2. **Operaciones V4**.

El usuario ha dejado explícitamente indicado que éstos son los dos bloques que quedan después de Calidad. No retroceder a rediseñar verticales ya cerrados salvo regresión real detectada en pruebas.

## Estado de verticales cerradas que no deben perderse

Entre los bloques ya cerrados antes de Calidad están Personas, Sagas y Novedades V4, además de las superficies previas del plan V4 que ya estaban cerradas. Sus contratos/documentación canónica prevalecen sobre recuerdos conversacionales.

Especialmente:

- Personas V4: cerrada e implementada.
- Sagas V4: cerrada e implementada.
- Novedades V4: cerrada e implementada.
- Calidad V4: **75/75 decisiones cerradas, implementada y mergeada en PR #502**.

## Regla de continuidad para la próxima conversación

La próxima conversación debe empezar leyendo este documento y verificando `main` antes de decidir nada nuevo.

No asumir que hay que rehacer Calidad. No volver a una decisión anterior por pérdida de contexto. Si aparece una discrepancia entre este handoff y el sistema vivo, verificar Git/código/producción y corregir la documentación de forma explícita.

## Prompt recomendado para arrancar un chat nuevo

> Seguimos con PikoFilm V4 en el repo `pikolugo-a11y/imdb-catalog`. Antes de responder, lee `AGENTS.md`, `docs/README.md`, `docs/BASELINE_V4_START.md` y especialmente `docs/CURRENT_V4_HANDOFF.md`. Calidad V4 acaba de quedar implementada y mergeada en PR #502; no la rehagas. Tú haces UX, implementación, tests, PR y merge; yo hago sólo el deploy de producción en Vercel y la validación visual/funcional. Cada decisión aprobada debe persistirse en Git antes de avanzar. Nos quedan Actividad V4 y Operaciones V4. Continúa exactamente desde el handoff y dime cuál es el siguiente paso.
