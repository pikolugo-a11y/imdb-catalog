# PikoFilm V4 — Handoff canónico de continuidad

Última actualización: 2026-09-10

Este documento existe para poder abrir una conversación nueva sin depender del historial del chat. Debe leerse al comienzo de cualquier nueva sesión junto con `AGENTS.md`, `docs/README.md`, `docs/BASELINE_V4_START.md` y las fuentes canónicas del dominio que se vaya a trabajar.

## Punto exacto actual

- Repositorio: `pikolugo-a11y/imdb-catalog`.
- `Calidad V4` está **implementada y mergeada a `main`** mediante PR **#502**.
- Merge de Calidad V4: `b1db67c0315229fd3ec3f04f693b5475a2872d3d`.
- Calidad queda basada en las **75 decisiones aprobadas** del contrato `docs/product/V4_CALIDAD.md`.
- `Actividad V4` está **cerrada funcionalmente e implementada** en PR **#504**, con contrato canónico `docs/product/V4_ACTIVIDAD.md`.
- Actividad V4 sustituye el antiguo popover Lifecycle por una superficie global `/actividad` de pasado, presente y futuro.
- El único bloque funcional de V4 pendiente después de Actividad es **Operaciones V4**.
- El usuario realiza exclusivamente los deployments de producción en Vercel. ChatGPT **no despliega Vercel**.

## Calidad V4 cerrada

La implementación incluye:

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

## Actividad V4 cerrada

Fuente funcional: `docs/product/V4_ACTIVIDAD.md`.

La implementación de PR #504 incluye:

- cronología global derivada de `process_runs`, `process_run_events` y `process_run_errors`, sin crear un log paralelo;
- ventana funcional detallada de 30 días;
- filtros, búsqueda funcional y resolución de entidades humanas desde tablas canónicas;
- agrupación de actividad masiva sin perder cobertura funcional;
- tratamiento funcional de errores sin exponer mensajes técnicos crudos;
- calendario futuro apoyado en un modelo mínimo `process_plans`, enlazado con `process_runs` al ejecutarse;
- planificación y redistribución automática de mantenimiento rutinario dentro de límites seguros;
- respeto a prioridades, bloqueos, fechas y picos deliberados;
- detección de picos de carga usando referencia histórica real;
- acciones manuales de calendario trazadas mediante `PROC-PLAN-001`;
- reconciliación/planificación automática mediante `PROC-PLAN-002` y cron horario;
- agrupación de vencimientos por proceso para no duplicar Batch activos;
- aplazamiento seguro cuando un Batch incompatible ya está en curso;
- extracción del mantenimiento automático de Calidad del antiguo cron `dashboard-snapshot`;
- purga automática de planes terminales tras 30 días;
- refresco visual moderado e incremental mientras se consulta Actividad;
- retirada del estado leído/no leído en `localStorage` del antiguo popover Lifecycle;
- Global Plex sync continúa estrictamente manual;
- tests de Actividad V4 integrados en el gate global de CI.

Principio arquitectónico permanente: **Actividad explica qué pasó y qué resultado tuvo; Operaciones explica cómo ocurrió técnicamente.**

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

## Estado de verticales cerradas que no deben perderse

Entre los bloques ya cerrados están Personas, Sagas, Novedades, Calidad y Actividad V4. Sus contratos/documentación canónica prevalecen sobre recuerdos conversacionales.

Especialmente:

- Personas V4: cerrada e implementada.
- Sagas V4: cerrada e implementada.
- Novedades V4: cerrada e implementada.
- Calidad V4: **75/75 decisiones cerradas, implementada y mergeada en PR #502**.
- Actividad V4: **decisiones cerradas e implementación completa en PR #504**.

## Qué queda en V4

Sólo queda:

1. **Operaciones V4**.

No retroceder a rediseñar verticales ya cerrados salvo regresión real detectada en pruebas o validación de producción.

## Regla de continuidad para la próxima conversación

La próxima conversación debe empezar leyendo este documento y verificando `main` antes de decidir nada nuevo.

No asumir que hay que rehacer Calidad o Actividad. No volver a una decisión anterior por pérdida de contexto. Si aparece una discrepancia entre este handoff y el sistema vivo, verificar Git/código/producción y corregir la documentación de forma explícita.

## Prompt recomendado para arrancar un chat nuevo

> Seguimos con PikoFilm V4 en el repo `pikolugo-a11y/imdb-catalog`. Antes de responder, lee `AGENTS.md`, `docs/README.md`, `docs/BASELINE_V4_START.md` y especialmente `docs/CURRENT_V4_HANDOFF.md`. Calidad V4 está cerrada en PR #502 y Actividad V4 está cerrada en PR #504; no las rehagas. Tú haces UX, implementación, tests, PR y merge; yo hago sólo el deploy de producción en Vercel y la validación visual/funcional. Cada decisión aprobada debe persistirse en Git antes de avanzar. Sólo nos queda Operaciones V4. Continúa exactamente desde el handoff y dime cuál es el siguiente paso.
