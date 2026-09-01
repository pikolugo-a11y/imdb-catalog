# PikoFilm — Gate obligatorio de seguridad del frontend antes de borrar

> Regla PRE-V4 vinculante. Añadida por decisión explícita del propietario del producto el 2026-09-01.

## Regla principal

**Antes de borrar, retirar, renombrar o sustituir cualquier pieza de código, configuración, ruta, Server Action, API, worker, script o infraestructura, hay que comprobar si existe algún consumidor desde el frontend validado de PikoFilm.**

Si existe un botón, formulario, enlace, menú, acción visible, acción de página, panel, auto-refresh, llamada de cliente, Server Action, endpoint invocado desde UI o cualquier otro flujo iniciado desde el frontal que dependa directa o indirectamente de la pieza candidata:

1. **NO se borra automáticamente.**
2. Se marca como `FRONTEND-CONSUMED`.
3. Se documenta exactamente qué pantalla/control lo utiliza y la cadena de llamada relevante.
4. Se advierte explícitamente al usuario antes del borrado.
5. **La decisión final de conservar, sustituir o retirar corresponde al usuario.**

El hecho de que una implementación parezca legacy, duplicada, antigua o tenga una alternativa más moderna **no es suficiente para borrarla si el frontend probado la consume**.

## Por qué existe este gate

El frontend actual es la superficie que más validación funcional y visual tiene. PRE-V4 debe preservar el comportamiento ya probado y evitar que una limpieza técnica retire accidentalmente una acción que funciona y que forma parte del producto validado.

## Comprobación mínima obligatoria para cada candidato a borrado

La matriz PRE-V4 deberá añadir estos campos antes de autorizar una eliminación:

`Elemento → imports/consumidores → consumidor frontend → pantalla/control → Server Action/API → operación canónica → executor/infraestructura → tests → clasificación → riesgo → decisión del usuario → acción`

El campo **consumidor frontend** sólo puede quedar en uno de estos estados:

- `NO`: búsqueda y trazado realizados sin consumidor frontend encontrado.
- `SÍ`: existe consumidor; requiere decisión explícita del usuario antes de retirar.
- `INDIRECTO`: el frontend llama una capa que termina dependiendo del candidato; requiere la misma decisión explícita.
- `UNKNOWN`: no se ha demostrado aún; **bloquea el borrado**.

## Qué cuenta como consumidor frontend

Como mínimo revisar:

- `app/**/page.*`
- `app/**/layout.*`
- componentes React montados;
- botones y formularios con `action={...}`;
- Server Actions (`'use server'`);
- event handlers/client components;
- enlaces que llegan a rutas operativas;
- fetches desde cliente;
- componentes de Batch/control;
- acciones de Admin/Calidad/Novedades/Plex/Series/Personas/Sagas/PikoQuality;
- auto-refresh/polling iniciado por UI;
- rutas API/cron si una pantalla depende de sus resultados;
- redirects/aliases de rutas utilizados por navegación visible.

## Regla para infraestructura

También se aplica a Railway/GitHub Actions/Neon:

- si un botón del frontend encola trabajo para un pool Railway, ese worker/configuración no se retira sin informar al usuario;
- si una acción visible dispara un workflow de GitHub, no se retira sin informar al usuario;
- si una pantalla depende de una tabla/view/read model Neon, no se elimina ni sustituye sin informar al usuario;
- si una UI muestra un proceso aparentemente legacy, se debe decidir primero si se migra el botón al proceso canónico o si se conserva el backend actual.

## Regla específica para PRE-V4 P2

**Ningún lote P2 pasa de CANDIDATO a APROBADO PARA BORRAR hasta completar este gate frontend para cada elemento.**

Incluso para candidatos de “alta confianza” TEMP/DEAD, la comprobación frontend sigue siendo obligatoria.

## Aplicación a candidatos ya detectados

Los lotes previamente descritos en auditorías como candidatos de alta confianza quedan desde ahora sujetos a esta regla. Su clasificación técnica no equivale a autorización de borrado.

En particular, antes de tocar workers Batch, Lifecycle, Plex, Technical, acciones de Calidad, Sagas, PikoScore, workflows, aliases o configuraciones Railway, se trazará primero su posible camino desde los controles visibles del frontend.

---

**Estado:** GATE ACTIVO.  
**Autoridad de decisión ante consumidor frontend:** usuario.  
**Default ante duda:** CONSERVAR / INVESTIGAR, nunca borrar.