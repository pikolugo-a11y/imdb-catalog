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


## UX-04 — Contrato coherente de loading, error y empty states por superficie

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

La cobertura de estados intermedios y excepcionales no es uniforme:

- Calidad tiene loading/error específicos;
- Catálogo tiene error específico pero no loading propio;
- Identidad tiene loading específico;
- Novedades, Personas, Sagas, Actividad y Operaciones dependen en mayor medida del fallback global;
- los empty states no siempre distinguen entre ausencia real de datos, filtros sin coincidencias o estado sano sin trabajo pendiente.

### Decisión

**APROBADA.**

### Contrato aprobado

Cada superficie principal debe distinguir explícitamente:

1. **Loading**
   - conservar la estructura mental de la página;
   - evitar sustituir innecesariamente una navegación contextual por un loader genérico;
   - no crear esqueletos complejos si no aportan valor.

2. **Error**
   - explicar qué superficie o bloque no pudo cargarse;
   - ofrecer reintento;
   - conservar URL/filtros/contexto siempre que sea posible;
   - un fallo secundario aislable no debe derribar toda la página.

3. **Empty**
   - diferenciar al menos:
     - ausencia real de datos;
     - filtros/búsqueda sin resultados;
     - ausencia de trabajo porque el sistema está sano;
     - estado todavía no disponible o no calculado, cuando aplique.

### Aplicación esperada

Revisar como mínimo Catálogo, Novedades, Personas, Sagas, Calidad, Actividad y Operaciones para que el lenguaje y la jerarquía indiquen claramente si la pantalla está cargando, vacía, filtrada o fallando.

### Guardrails

- No convertir esta decisión en una proliferación de loaders decorativos.
- Reutilizar patrones ligeros cuando sea posible.
- La consolidación visual/tokens profunda pertenece al Punto 9.
- No ocultar errores técnicos reales; la UX funcional puede resumirlos y enlazar a Operaciones cuando corresponda.

### Objetivo

Aumentar sensación de estabilidad y reducir ambigüedad sobre si una superficie está sana, vacía, filtrada o fallando.


## UX-05 — Cabeceras sticky coordinadas con el shell y ordenación accesible

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

El shell global usa cabecera fija y algunas tablas densas usan encabezados `sticky` sin respetar su offset. En Catálogo:

- header global fijo: `--v4-header` (64 px en escritorio);
- cabecera de tabla: `position: sticky; top: 0`.

Esto puede hacer que el encabezado de columnas quede parcialmente oculto bajo el shell.

Además, las columnas ordenables comunican dirección visualmente mediante flechas y estado activo, pero no exponen semántica estándar mediante `aria-sort`.

### Decisión

**APROBADA.**

### Contrato aprobado

- Toda cabecera sticky dentro del contenido debe respetar el offset real del shell fijo.
- El offset debe derivarse de variables/layout compartido cuando sea posible, no de números mágicos duplicados.
- En breakpoints donde cambie la altura del header, la posición sticky debe seguir siendo correcta.
- Las columnas ordenables deben exponer `aria-sort="ascending"` o `aria-sort="descending"` en la columna activa.
- Las columnas no activas no deben anunciar un orden falso.
- El comportamiento visual de flechas/estado activo puede conservarse.
- Foco, navegación y links de cabecera deben permanecer utilizables durante scroll.

### Alcance

UX-05 corrige comportamiento y accesibilidad. No obliga todavía a crear un componente universal de tabla ni a consolidar CSS; esa normalización profunda pertenece al Punto 9.

### Objetivo

Mantener la cabecera útil y legible durante scroll y hacer que la ordenación tenga semántica equivalente para usuarios visuales y tecnología asistiva.


## UX-06 — Gestión coherente y accesible del foco en navegación móvil y popovers

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

La navegación móvil y varios controles desplegables funcionan visualmente, pero no comparten un contrato completo de foco y cierre:

- el menú móvil `Más` usa semántica `menu/menuitem`, pero al abrir no mueve el foco al primer destino;
- mientras el overlay está abierto, el contenido situado detrás sigue siendo alcanzable por teclado;
- `Escape` devuelve correctamente el foco, pero falta completar el ciclo de interacción;
- multiselectores como País y Géneros pueden permanecer abiertos simultáneamente;
- los popovers móviles deben seguir siendo utilizables con viewport reducido y teclado virtual.

### Decisión

**APROBADA.**

### Contrato aprobado

- Al abrir el menú móvil `Más`, el foco entra en el menú y queda en un destino utilizable.
- Mientras un overlay/modal-menu esté abierto, la navegación por teclado no debe escapar accidentalmente al contenido oculto de detrás.
- `Escape` cierra y devuelve el foco al control que abrió el overlay.
- Seleccionar un destino cierra correctamente el menú de forma coordinada con la navegación.
- Click/tap exterior cierra los popovers cuando el patrón lo permita.
- Los multiselectores País/Géneros deben aplicar exclusión mutua: abrir uno cierra el otro.
- El foco visible y la navegación por teclado deben conservarse.
- En móvil, los popovers deben mantenerse accesibles ante cambios de viewport y teclado virtual.
- No se introduce una dependencia pesada únicamente para resolver este comportamiento.

### Guardrail

UX-06 define comportamiento y accesibilidad. No obliga a crear todavía un sistema universal de componentes ni a consolidar generaciones CSS; esa normalización pertenece al Punto 9 — Sistema de diseño / CSS.

### Objetivo

Hacer que navegación móvil, menús y popovers se comporten de forma predecible y equivalente para interacción táctil, teclado y tecnologías asistivas.
