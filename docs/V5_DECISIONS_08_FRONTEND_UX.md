# PikoFilm V5 — Decisiones Punto 8 · Frontend y UX

Estado: **Fase 2 EXTENDIDA — se añaden propuestas UX visibles antes de Fase 3**.

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


## UX-07 — Jerarquía y orientación unificadas dentro de Calidad

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

Calidad tiene una arquitectura funcional sólida, pero conviven dos niveles de navegación:

- navegación principal del dominio Calidad;
- `QualityHybridNav` para subsecciones internas del Centro.

La combinación es funcional, pero especialmente en móvil puede percibirse como dos jerarquías paralelas y dificultar saber dónde está el usuario y cómo cambiar de área.

### Decisión

**APROBADA.**

### Contrato aprobado

- Calidad mantiene una única jerarquía perceptible.
- Películas, Series y PikoRelevancia conservan sus superficies especializadas.
- Identidad, Datos, Personas, PikoQuality e Integridad se presentan como subsecciones coherentes del Centro, sin sensación de una segunda aplicación dentro de Calidad.
- La orientación debe expresar con claridad `Calidad → sección actual`.
- En móvil, la navegación debe ser compacta y permitir cambiar de área sin consumir una parte desproporcionada de la pantalla.
- Se conservarán deep links y URLs existentes cuando sea razonable.
- No se fusionan dominios funcionales ni se oculta información.
- Operaciones permanece separada; no se trasladan controles técnicos a Calidad.

### Guardrail

UX-07 define arquitectura de información y orientación. No obliga a rediseñar componentes, tokens, colores, tabs o CSS comunes; esa consolidación corresponde al Punto 9 — Sistema de diseño / CSS.

### Objetivo

Reducir carga cognitiva y hacer más evidente dónde está el usuario y cómo moverse entre áreas de Calidad, especialmente en móvil, sin sacrificar profundidad funcional.


## UX-08 — Contrato universal de feedback de acciones y mutaciones

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

PikoFilm mezcla acciones con semánticas técnicas distintas:

- operaciones que terminan dentro del request;
- operaciones que sólo encolan trabajo durable;
- mutaciones inmediatas que desencadenan procesamiento posterior;
- acciones que pueden terminar sin cambios, parcialmente o requiriendo atención.

Sin un contrato común, la interfaz puede comunicar éxito de forma demasiado genérica y dar a entender que una operación terminó cuando sólo fue iniciada.

### Decisión

**APROBADA.**

### Contrato aprobado

- Toda mutación ofrece feedback inmediato de que la acción fue recibida.
- La acción se deshabilita mientras se envía cuando sea seguro hacerlo.
- La UI distingue explícitamente entre:
  - completado;
  - iniciado/encolado;
  - sin cambios;
  - requiere atención;
  - fallido.
- Nunca se afirma que ocurrió un resultado funcional si sólo se creó una ejecución, un Batch o trabajo en cola.
- Cuando exista `run_id` o ejecución observable, la interfaz puede enlazar de forma natural a Actividad y, cuando corresponda, a Operaciones.
- Los toasts o mensajes transitorios no deben ser la única fuente de verdad para acciones importantes; el estado de la superficie se actualiza de forma coherente.
- Si una acción falla, el elemento afectado no desaparece ni adopta un falso estado optimista.
- El frontend protege contra doble click cuando proceda, pero la idempotencia backend continúa siendo la garantía real.
- Las acciones destructivas mantienen confirmación proporcional al riesgo.
- El feedback debe ser discreto y no convertir cada operación en una pantalla de seguimiento.

### Microcopy

La redacción debe reflejar el estado real, por ejemplo:

- `Actualización iniciada` cuando sólo se ha encolado trabajo.
- `Actualizado` cuando el resultado funcional ya se confirmó.
- `Sin cambios` cuando la ejecución terminó sin mutación.
- `Necesita revisión` cuando el resultado requiere intervención.

### Objetivo

Permitir distinguir siempre entre intención recibida, trabajo en curso y resultado real, evitando falsos éxitos y manteniendo la interfaz rápida y comprensible.


## UX-09 — Ergonomía táctil consistente para controles móviles

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

La auditoría detectó controles interactivos compactos, en torno a 30–36 px de alto, en varias superficies. La densidad es útil en escritorio, pero en móvil puede aumentar pulsaciones imprecisas, acciones vecinas demasiado próximas y menor comodidad de uso.

### Decisión

**APROBADA.**

### Contrato aprobado

- Los controles principales en móvil deben disponer de un área táctil cómoda aunque su apariencia siga siendo compacta.
- Cuando sea posible, se amplía la zona interactiva mediante padding o hit-area sin inflar innecesariamente el diseño.
- Se evita colocar acciones críticas demasiado juntas.
- Tienen prioridad de revisión:
  - acciones primarias;
  - paginación;
  - navegación;
  - checkboxes;
  - controles de uso frecuente.
- Chips o elementos secundarios pueden seguir siendo visualmente compactos si su área pulsable es suficiente.
- En escritorio se conserva la densidad alta de tablas y listas.
- Se revisarán especialmente Novedades, PikoRelevancia, Calidad Series, Catálogo y navegación inferior móvil.
- Los controles mantienen foco visible y feedback claro al tocar/pulsar.
- No se impone un tamaño rígido indiscriminado cuando perjudique una tabla densa o un control secundario.

### Guardrail

UX-09 define ergonomía y usabilidad. Los tokens exactos de altura, padding, hit-area y componentes compartidos se resolverán en el Punto 9 — Sistema de diseño / CSS.

### Objetivo

Conservar la densidad de PikoFilm y, al mismo tiempo, hacer que las acciones frecuentes sean más cómodas y menos propensas a pulsaciones accidentales en iPhone.


## UX-10 — Contrato transversal de interacción para tablas y listas

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Problema observado

PikoFilm dispone de múltiples superficies densas —Catálogo, Personas, Sagas, Novedades, PikoRelevancia y Calidad— que resuelven patrones similares con pequeñas diferencias de interacción: navegación de fila, ubicación de acciones, representación de nulos, jerarquía móvil y conservación de contexto.

La diversidad funcional es necesaria; la inconsistencia de interacción no.

### Decisión

**APROBADA.**

### Contrato aprobado

- En escritorio se usa tabla densa cuando comparar columnas sea útil.
- En móvil se usa lista compacta equivalente cuando una tabla horizontal perjudique la interacción.
- Cada elemento conserva:
  1. identidad clara;
  2. dato o estado protagonista;
  3. metadatos secundarios;
  4. acciones.
- Una fila sólo es completamente clicable cuando existe un único destino inequívoco.
- Si existen varias acciones, navegación y botones quedan claramente separados.
- Los valores ausentes se representan de forma coherente según su significado; nunca se confunde cero con dato no calculado.
- Paginación, filtros y orden conservan URL y contexto de retorno según UX-03.
- Las acciones por fila respetan UX-08: iniciado/encolado no equivale a completado.
- Loading/error/empty siguen UX-04.
- Responsive y ergonomía táctil siguen UX-02 y UX-09.
- La información técnica que no ayuda a decidir queda fuera de la vista principal.

### Guardrail

No se crea ahora un componente universal tipo `MegaTable` ni se obliga a todas las superficies a compartir exactamente el mismo markup.

UX-10 define comportamiento y jerarquía. La componentización, tokens, primitives y consolidación CSS pertenecen al Punto 9 — Sistema de diseño / CSS.

### Objetivo

Hacer que el aprendizaje de una lista o tabla de PikoFilm sea transferible al resto de superficies, manteniendo la especialización funcional de cada dominio.

## Estado de Fase 2 tras UX-10

Se han revisado individualmente y persistido **10 propuestas UX-01 a UX-10**, todas **APROBADAS**.

Tras revisión crítica del alcance, la Fase 2 se **EXTIENDE**: el mínimo metodológico de 10 propuestas no se usa como techo. Antes de entrar en Fase 3 se añadirán propuestas con impacto visual claramente perceptible para el usuario final, manteniendo revisión y persistencia una a una.
