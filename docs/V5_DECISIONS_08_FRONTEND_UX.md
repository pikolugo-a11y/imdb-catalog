# PikoFilm V5 — Decisiones Punto 8 · Frontend y UX

Estado: **Fase 2 ACTIVA**.

Rama: `audit/v5-08-frontend-ux`.

Regla: cada propuesta UX se revisa individualmente y su decisión se persiste antes de presentar la siguiente.


## UX-01 — Filtros server-aware: confirmar acciones compuestas antes de consultar

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

En Catálogo, varios controles disparan navegación server-side durante la construcción del filtro:

- búsqueda textual tras 260 ms;
- rango de años tras 320 ms;
- cada cambio de país/género;
- cambios de modo Cualquiera/Todos.

Como `/catalogo` es dinámico, estas navegaciones pueden provocar renders y consultas intermedias que el usuario no necesitaba.

### Decisión

**APROBADA.**

V5 distinguirá entre:

- **acción completa**: se aplica inmediatamente;
- **acción compuesta**: se confirma una sola vez cuando el usuario termina de construirla.

### Contrato aprobado

- Búsqueda textual: no consultar continuamente mientras se escribe; confirmar con Enter o acción Buscar equivalente.
- Rango de años: aplicar cuando el rango esté completo/confirmado, no por cada pulsación.
- País y Géneros: permitir seleccionar varias opciones antes de aplicar una única actualización.
- Total / En Plex / Sin Plex, scopes, ordenación y paginación: siguen siendo inmediatos.
- La URL continúa siendo la fuente de verdad una vez aplicado el filtro.
- Volver desde una ficha debe restaurar exactamente filtros, orden y página.
- No introducir un único botón global pesado que vuelva la página más lenta o torpe; la confirmación debe ser local al control compuesto.

### Objetivo

Reducir renders intermedios, trabajo Vercel/Neon evitable y sensación de interfaz nerviosa sin perder rapidez en decisiones simples.


## UX-02 — Responsive móvil real para Novedades y PikoRelevancia

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

Novedades y PikoRelevancia mantienen tablas horizontales en móvil, a diferencia de Catálogo, Personas y Sagas, que ya disponen de representación compacta específica.

Esto contradice el principio V4 de responsive sin pérdida funcional y sin scroll horizontal obligatorio para las superficies principales.

### Decisión

**APROBADA.**

### Contrato aprobado

#### Novedades

En escritorio se mantiene la tabla densa actual.

En móvil, cada candidato se representa como lista compacta con jerarquía equivalente:

- título y año;
- tipo e identidad IMDb/TMDb;
- origen y contexto;
- estado funcional;
- fecha detectada;
- acciones disponibles.

Cuando un candidato necesite resolver identidad, los controles IMDb/TMDb se presentan dentro del propio bloque móvil, sin obligar a recorrer una tabla horizontal.

#### PikoRelevancia

En escritorio se mantiene la tabla actual.

En móvil, cada serie se presenta como fila/tarjeta compacta con:

- selección;
- título y año;
- PikoScore;
- estado Pendiente / En cola / Calculando;
- acción Calcular.

Se conserva:

- selección múltiple;
- Seleccionar página;
- procesamiento secuencial;
- paginación;
- estados actuales de cola.

### Accesibilidad asociada

Cada checkbox individual de PikoRelevancia debe tener nombre accesible ligado a su serie, por ejemplo `Seleccionar Breaking Bad`.

### Guardrail

La adaptación móvil no elimina información funcional ni convierte estas superficies en tarjetas editoriales grandes. Debe seguir siendo una UX densa y operativa.


## UX-03 — Contrato universal lista → detalle → volver conservando contexto

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

Sagas conserva búsqueda, filtros, orden y página en la URL del listado, pero al abrir una saga:

- el enlace al detalle no transporta `returnTo`;
- la ficha no lee contexto de retorno;
- breadcrumb y footer vuelven siempre a `/sagas`.

Esto hace perder el estado de navegación al regresar.

Catálogo y Personas ya resuelven correctamente el patrón mediante `from` / `returnTo`.

### Decisión

**APROBADA.**

### Contrato general

Siempre que el usuario entre en un detalle desde una lista cuyo estado navegable esté representado en URL, la acción Volver debe restaurar exactamente esa lista.

El contrato incluye:

- búsqueda;
- filtros;
- orden;
- scope/vista;
- página;
- cualquier otro estado de navegación aprobado y representado en URL.

La URL continúa siendo la fuente principal de verdad; no se introduce memoria oculta como mecanismo canónico.

### Aplicación mínima obligatoria

- Catálogo → Ficha: conservar el comportamiento existente.
- Personas → Persona detalle: conservar el comportamiento existente.
- Calidad Series → detalle: preservar su retorno contextual actual.
- Sagas → Saga detalle: corregir el hueco detectado.

### Contrato específico para Sagas

1. La lista construye el enlace al detalle incluyendo `returnTo` con la URL completa vigente.
2. La ficha valida y consume ese `returnTo`.
3. Breadcrumb y acción “Volver a Sagas” usan esa URL.
4. Entrada directa/favorito sin contexto usa fallback limpio a `/sagas`.
5. No se permite un `returnTo` arbitrario fuera del ámbito esperado.

### Objetivo

Evitar que abrir un detalle obligue a reconstruir manualmente el contexto de trabajo al volver.
