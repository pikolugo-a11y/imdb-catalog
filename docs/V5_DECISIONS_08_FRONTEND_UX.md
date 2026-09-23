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
