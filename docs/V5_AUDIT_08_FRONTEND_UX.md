# PikoFilm V5 — Auditoría Punto 8 · Frontend y UX

Estado: **Fase 1 CERRADA — auditoría completa y persistida**.

Rama: `audit/v5-08-frontend-ux`.

## Alcance

Auditoría del frontend y la experiencia de usuario reales de PikoFilm sobre `main` posterior al cierre del Punto 7. Se ha contrastado:

- tríada canónica V4, especialmente `docs/V4_UX_SPEC.md`;
- shell global, navegación y búsqueda;
- rutas y superficies reales bajo `app/`;
- páginas de Catálogo, Ficha, Novedades, Calidad, Series, PikoRelevancia, Personas, Sagas, Actividad y Operaciones;
- comportamiento de filtros, URL, navegación de retorno, paginación y acciones;
- responsive móvil;
- loading/error/empty;
- accesibilidad observable en markup;
- CSS que afecta directamente al comportamiento UX;
- tráfico real reciente de Vercel Production como evidencia de patrones de navegación.

Esta fase **no implementa cambios**. El sistema vivo prevalece sobre documentación previa.

## 1. Foto general

PikoFilm tiene ya una base UX V4 mucho más madura que las generaciones anteriores:

- shell estable con sidebar en escritorio y navegación inferior móvil;
- separación conceptual clara entre consulta editorial, trabajo funcional y diagnóstico técnico;
- `NoPrefetchLink` elimina el fanout especulativo de navegación;
- URL como fuente de estado en varias superficies importantes;
- Catálogo, Personas y Sagas tienen tratamiento móvil específico;
- Calidad distingue correctamente atención humana, seguimiento automático y estado sano;
- Actividad y Operaciones mantienen responsabilidades diferenciadas;
- búsqueda global con navegación por teclado y semántica combobox.

La deuda principal ya no es “rehacer la interfaz”, sino **hacer coherente el contrato de interacción entre superficies**, cerrar huecos de responsive/accesibilidad y evitar que algunos patrones de UI generen trabajo server-side innecesario.

## 2. Shell global y navegación

### Observado

`components/Nav.js` mantiene:

- Inicio;
- Catálogo;
- Personas;
- Novedades;
- Calidad;
- Actividad;
- Operaciones;
- Sagas como subsección de Catálogo.

En móvil, Inicio/Catálogo/Personas/Novedades quedan visibles y Calidad/Actividad/Operaciones/Sagas se agrupan bajo “Más”.

La navegación:
- marca estado activo;
- usa `NoPrefetchLink`;
- cierra “Más” al cambiar de ruta;
- soporta Escape y devuelve foco al botón que abrió el menú.

### Riesgos UX

El menú móvil “Más” usa `role=menu`/`menuitem`, pero al abrir:
- no mueve foco al primer elemento;
- no mantiene el foco dentro del overlay;
- el contenido trasero continúa siendo alcanzable por teclado.

Es funcional, pero la semántica de modal/menu está incompleta.

## 3. Búsqueda global

`components/GlobalSearch.js` es uno de los componentes más sólidos:

- debounce de 180 ms;
- cancelación con `AbortController`;
- mínimo de caracteres salvo IDs exactos;
- grupos Títulos/Personas/Sagas;
- ArrowUp/ArrowDown/Home/End/Enter;
- `role=combobox`, `listbox`, `option`;
- cierre con Escape y click exterior;
- estado de carga, error y sin resultados.

No se observan motivos para rediseñarla conceptualmente en V5; sí debe entrar en cualquier revisión transversal de focus/touch targets.

## 4. Catálogo — fortalezas

El Catálogo es actualmente una de las superficies más coherentes:

- búsqueda, países, géneros, rango de año y presencia Plex;
- filtros activos removibles;
- país y género con búsqueda interna;
- scopes Todo/Películas/Series;
- métricas Total/En Plex/Sin Plex como filtros;
- orden server-side global, no sólo sobre la página visible;
- PikoScore y PikoQuality ordenables;
- PikoRelevancia 0–100 en Series, con pendiente explícito;
- resultado visible `X–Y de N` y total de universo cuando existen filtros;
- vista lista y carátulas;
- paginación sin prefetch;
- tabla escritorio + lista compacta móvil;
- Ficha recibe `from` con la URL completa del listado para restaurar contexto.

Las mejoras recientes de Catálogo están presentes en `main`; no deben rehacerse.

## 5. Catálogo — filtros server-side demasiado reactivos

### Evidencia de código

`CatalogFiltersV4.js` ejecuta navegación server-side mediante `router.replace`:

- búsqueda textual tras 260 ms;
- rango de años tras 320 ms;
- cada checkbox de país/género inmediatamente;
- cada cambio de modo Cualquiera/Todos inmediatamente.

`/catalogo` es `force-dynamic`, por lo que estas navegaciones vuelven a ejecutar la lectura server-side.

### Evidencia viva

En la ventana reciente de Vercel se observaron ráfagas de `GET /catalogo` separadas por pocos segundos durante uso interactivo. No se atribuye cada request individual a una pulsación concreta, pero el patrón de código permite generar múltiples renders/consultas mientras el usuario todavía está construyendo un filtro.

### Impacto

- percepción de “UI nerviosa” en conexiones lentas;
- renders intermedios que el usuario no necesitaba;
- trabajo Neon/Vercel evitable;
- posible pérdida de fluidez cuando se marcan varias opciones consecutivas.

Este hallazgo pertenece a UX/rendimiento percibido. La cuantificación económica global corresponde al Punto 14 Coste.

## 6. Catálogo — sticky header y shell fijo

El shell de escritorio define:

- header global fijo de 64 px;
- z-index 45.

La tabla del Catálogo define:

- `position: sticky`;
- `top: 0`;
- z-index 12.

Por tanto el encabezado sticky puede quedar desplazándose **por debajo del header global**, no justo debajo de él. Es un conflicto geométrico real del contrato de layout.

Debe existir un offset de sticky coherente con el shell fijo, preferiblemente derivado de `--v4-header`.

## 7. Catálogo — semántica de ordenación

Los encabezados clicables muestran flechas visuales y resaltan el sort activo, pero los `th` no exponen `aria-sort`.

Resultado:
- el usuario visual entiende dirección;
- un lector de pantalla no recibe la semántica estándar de orden ascendente/descendente.

Es un hueco accesible concreto y acotado.

## 8. Catálogo — multiselects

País/Géneros usan `<details>` personalizados.

Observado:
- búsqueda interna;
- selección múltiple;
- modos Cualquiera/Todos;
- buen resumen en el `summary`.

Riesgos:
- dos popovers pueden quedar abiertos simultáneamente;
- no hay gestión explícita de cierre exterior/mutua exclusión;
- en móvil el popover pasa a `position: fixed` con `top:auto`, una solución funcional pero frágil ante viewport/teclado virtual.

No se ha observado un fallo productivo concreto; se clasifica como robustez UX.

## 9. Responsive — paridad desigual

### Superficies con adaptación específica

- Catálogo: tabla escritorio → lista compacta móvil.
- Personas: tabla → lista móvil.
- Sagas: tabla → lista móvil.
- Series: layouts específicos por breakpoint.

### Superficies que conservan tabla horizontal

**Novedades**:
- reorganiza cabecera/KPIs/filtros;
- mantiene `news-data-table` dentro de un contenedor con overflow;
- no existe representación móvil equivalente.

**PikoRelevancia**:
- mantiene tabla dentro de `.relq-table-shell{overflow:auto}`;
- la columna Serie fuerza anchura mínima;
- no existe lista compacta móvil.

Esto contradice directamente el principio V4 de responsive sin pérdida funcional y sin scroll horizontal obligatorio para las tablas principales.

## 10. PikoRelevancia — accesibilidad de selección

La selección múltiple tiene:

- checkbox global “Seleccionar página” correctamente etiquetado;
- checkboxes por fila sin `label` visible ni `aria-label`.

El encabezado vacío de la columna tiene `aria-label="Seleccionar"`, pero eso no da nombre accesible a cada input.

Cada checkbox de fila debería identificarse por la serie correspondiente.

## 11. Loading, error y empty states

La cobertura no es uniforme.

### Existe tratamiento específico

- root: loading/error genérico;
- Catálogo: error específico;
- Calidad: loading/error específicos;
- Identidad: loading específico;
- algunos subdominios tienen empty states propios.

### Huecos

Catálogo no tiene loading propio; Novedades, Personas, Sagas, Actividad y Operaciones dependen en gran medida del fallback global.

Consecuencia: superficies muy distintas pierden contexto durante navegación lenta o fallo aunque el contrato V4 pide mensajes y continuidad contextual.

Los empty states también tienen distinta profundidad. Ejemplo:
- Catálogo distingue consulta válida sin resultados y permite limpiar filtros;
- Novedades muestra básicamente “No hay trabajo pendiente en esta vista”, sin distinguir de forma rica entre cola realmente vacía y filtro sin coincidencias.

## 12. Inconsistencia de interacción entre filtros

El sistema tiene tres modelos:

1. **Catálogo:** live/debounce + navegación automática.
2. **Personas/Sagas/Novedades:** formulario GET + acción explícita Aplicar/Filtrar.
3. **Filtros de estado/scopes:** links inmediatos.

Los tres pueden ser válidos, pero hoy no existe un criterio UX explícito que diga cuándo se usa cada uno. El mismo gesto conceptual —construir una búsqueda/filtro— tiene comportamientos distintos según superficie.

V5 necesita un contrato “server-aware”: instantáneo cuando el click es una decisión completa; composición temporal cuando el usuario está escribiendo o seleccionando varias opciones.

## 13. Sagas — pérdida real del contexto al volver

La lista `/sagas` persiste en URL:
- búsqueda;
- estado;
- orden;
- página.

Pero cada fila enlaza directamente a `/sagas/[id]` sin `returnTo`.

La ficha de Saga:
- sólo recibe `params`;
- no procesa `searchParams` de retorno;
- breadcrumb y footer enlazan siempre a `/sagas`.

Resultado: al abrir una Saga desde una lista filtrada/ordenada/paginada, “Volver a Sagas” pierde el contexto. Esto contradice el principio V4 de URL como estado y el patrón ya resuelto en Catálogo/Personas.

Es un bug UX concreto.

## 14. Personas

Fortalezas:
- rol y orden explícitos;
- estado en URL;
- búsqueda por formulario, evitando renders por tecla;
- lista móvil real;
- detalle recibe `returnTo`;
- no refresca automáticamente al navegar.

El patrón de retorno de Personas sirve como referencia positiva para Sagas y futuras listas.

## 15. Calidad

La arquitectura de información está alineada con V4:

- portada como radar;
- atención / seguimiento automático / completo;
- Centro común para dominios homogéneos;
- Películas, Series y PikoRelevancia como superficies especializadas;
- enlace a Operaciones para ejecución técnica.

### Riesgo de orientación

Hay dos niveles de navegación simultáneos:
- sidebar global de Calidad;
- `QualityHybridNav` para las subsecciones del Centro.

Es correcto funcionalmente, pero puede sentirse como dos jerarquías distintas del mismo dominio, especialmente en móvil. Debe estudiarse si se puede conservar profundidad sin duplicar orientación.

## 16. Series

La superficie de detalle es rica y coherente con su papel de workbench:

- resumen;
- cobertura;
- incidencias;
- seguimiento;
- temporadas;
- filtros;
- evidencias;
- decisiones manuales;
- acciones excepcionales;
- paneles lazy para listas largas.

Fortaleza importante: evita cargar por defecto las listas excepcionales extensas.

Riesgo: densidad muy alta y numerosos controles/estados en una sola pantalla. No se considera por sí mismo un defecto: Series necesita profundidad. V5 debe mejorar orientación y jerarquía sin convertirlo en una ficha editorial simplificada.

## 17. Actividad y Operaciones

La separación conceptual está bien ejecutada.

### Actividad

- Cronología;
- Calendario;
- Automatizaciones;
- lenguaje funcional;
- planificación visible;
- acciones de planificación contextualizadas.

### Operaciones

- cabecera orientada a “¿hay algo que hacer?”;
- trabajos activos;
- incidencias abiertas;
- control técnico;
- diagnóstico avanzado en `details`;
- detalle de runs separado.

Esta separación debe preservarse. No se recomienda volver a fusionarlas.

## 18. Touch targets y ergonomía

Se observan controles interactivos de 30–36 px de alto en varias superficies, por ejemplo:
- selector de vista;
- paginadores;
- botones compactos;
- chips/controles móviles.

No se declara automáticamente incumplimiento normativo sin medir contexto, separación y área efectiva, pero existe una oportunidad clara de fijar un mínimo táctil común para controles principales en móvil.

## 19. CSS y generaciones coexistentes — impacto UX

El root importa simultáneamente múltiples generaciones:

- `v1.css`
- `v12.css`
- `v2.css`
- `v3-shell.css`
- varios dashboard generations
- CSS V4 específicos.

Además existen pares/series como:
- `catalog-v3.css`, `catalog-v4.css`, `catalog-series-v5.css`;
- `excluded-v3.css`, `excluded-v4.css`;
- `series-command.css`, `series-command-v3.css`;
- varios CSS de home.

Esto crea riesgo de cascade drift y hace más difícil garantizar consistencia. El diagnóstico se registra aquí por su impacto visual, pero la consolidación/tokens/componentización corresponde principalmente al **Punto 9 — Sistema de diseño / CSS**. Punto 8 debe centrarse en comportamiento, jerarquía y coherencia de uso.

## 20. Producción observada

Muestra reciente de Vercel Production:
- navegación real frecuente por Catálogo, Fichas, Calidad/Series, PikoRelevancia y Operaciones;
- respuestas 200 en las entradas visibles de la muestra;
- no se observaron 5xx en la porción devuelta.

La consulta de logs agotó su ventana antes de recuperar todo el periodo, por lo que **no se concluye ausencia total de errores**.

La muestra sí sirve para demostrar que:
- las superficies auditadas son de uso real;
- existen ráfagas de navegación/re-render de Catálogo durante interacción.

## 21. Conclusiones de Fase 1

### Fortalezas a conservar

1. separación de dominios y responsabilidades;
2. shell estable;
3. no-prefetch;
4. URL como estado;
5. Catálogo/Personas/Sagas con patrón denso de base de datos;
6. Calidad funcional frente a Operaciones técnicas;
7. responsive real en varias superficies;
8. búsqueda global accesible;
9. progressive disclosure en Operaciones y Series.

### Deuda prioritaria para propuestas V5

1. contrato coherente de filtros server-side;
2. responsive móvil real para Novedades y PikoRelevancia;
3. contrato universal list → detail → volver conservando contexto;
4. loading/error/empty consistentes por superficie;
5. accesibilidad de sort, selección y menús;
6. sticky offsets coordinados con shell fijo;
7. orientación dentro de Calidad;
8. feedback coherente de acciones/mutaciones;
9. ergonomía/touch targets;
10. patrón compartido de tablas/listas sin invadir todavía la consolidación CSS del Punto 9.

## Cierre

**Fase 1 del Punto 8 — Frontend y UX: COMPLETADA.**

No se ha modificado comportamiento funcional, Neon, Railway ni Vercel Production.

Siguiente paso exacto: **Fase 2 · UX-01**, una única propuesta derivada de esta auditoría. La decisión deberá persistirse antes de presentar UX-02.
