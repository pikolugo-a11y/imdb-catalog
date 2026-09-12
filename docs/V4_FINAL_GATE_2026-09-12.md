# PikoFilm V4 — Final Gate antes de V5

Fecha: 2026-09-12  
Estado: **implementación técnica en cierre; producción pendiente de despliegue/aceptación**.

## Objetivo

Última revisión transversal de V4 antes de reabrir decisiones V5. No añade funcionalidad nueva: corrige incoherencias de UX, observabilidad, accesibilidad, zona horaria y diagnóstico operativo encontradas tras desplegar las remediaciones anteriores.

## Fuente de verdad revisada

- GitHub `main` y CI.
- Deployment productivo de Vercel y logs de runtime/build.
- Los cuatro servicios Railway (API, FAST, Plex, Technical) y su commit efectivo.
- Neon vivo mediante consultas de sólo lectura.
- Rutas V4 y contratos de regresión.

## Correcciones de este gate

### Cron / PLAN-002

- La autenticación sigue siendo **fail-closed**.
- Los rechazos `401` escriben únicamente diagnóstico booleano seguro: si `CRON_SECRET` está configurado y si llegó cabecera Authorization. Nunca se registra el secreto ni la cabecera.
- `.env.example` declara `CRON_SECRET` como requisito de Production.
- El runbook documenta el procedimiento exacto de diagnóstico.

La aplicación **no** incorpora fallback inseguro. El `401` productivo observado antes de esta rama debe cerrarse configurando/corrigiendo `CRON_SECRET` en Vercel Production y demostrando después una ejecución real `PROC-PLAN-002` `succeeded|running`.

### Observabilidad de Series

- `/calidad/series` deja de presentar `series_quality_runs` como última ejecución.
- `/calidad/series/[ratingKey]` deja de usar `series_quality_runs` para actividad/mantenimiento visible.
- Ambas superficies leen `process_runs`, la única observabilidad canónica.
- `series_quality_runs` no se elimina de Neon en este gate porque todavía existen escritores de compatibilidad; su eventual retirada requiere auditar esos escritores y no es necesaria para corregir la verdad visible.

### UX y accesibilidad

- estado de carga global V4 para transiciones dinámicas;
- progreso de cobertura del Inicio con nombres accesibles;
- menú móvil “Más” se cierra con Escape y devuelve foco al botón;
- búsqueda global explica el umbral de tres caracteres;
- acciones pendientes/confirmaciones completadas en Identidad, Películas, Series y Sagas;
- empty state de Calidad · Personas distingue una búsqueda sin resultados;
- paginación y textos alternativos mejorados en Personas/Sagas.

### Hora civil

Se añade un formatter central `lib/format-madrid.js` para timestamps visibles. Inicio, Operaciones, detalle de ejecución, Identidad, Calidad · Personas, Series, detalle de Series, detalle de Sagas y fecha de refresco de Persona usan explícitamente `Europe/Madrid`.

Las fechas biográficas puras (nacimiento/fallecimiento) permanecen como fecha de calendario sin reinterpretación horaria.

## Comprobaciones de datos al abrir el gate

Sólo lectura; no se modificó Neon.

- Lifecycle sin filas ausentes ni huérfanas.
- `TECH_PENDING` actual correspondía a evidencia física nueva, no a la antigua regresión masiva.
- PikoQuality mantenía C6 vigente sobre todas las capturas técnicamente calculables; deuda de captura física y errores seguían separados.
- La divergencia entre `series_quality_runs` y `process_runs` quedó demostrada y motivó la corrección de UI.

## CSS / build

El deployment productivo `b3bcdf8…` se volvió a inspeccionar durante este gate. Su `next build` terminó `Compiled successfully` y **no contiene los warnings Autoprefixer que habían aparecido en builds anteriores**. Por ello no se eliminan a ciegas las hojas históricas globales en esta ronda: sin regresión observable ni warning vigente, una poda visual masiva sin navegador de regresión introduciría más riesgo que beneficio.

La consolidación física de CSS puede hacerse como refactor posterior independiente, con comparación visual, pero no es un bug funcional que bloquee V4.

## Seguridad de acceso privado

El acceso privado existente no se rediseña dentro de este gate. Cambiar el formato de la cookie/verificador sin un secreto de firma administrado por entorno puede debilitar la protección. Cualquier hardening posterior debe introducir una credencial de firma en entorno y migración controlada; no se sustituye por un token derivable del hash versionado.

## GitHub

La disciplina obligatoria sigue siendo rama → PR → CI → merge. La cuenta/conector usado por el agente no expone una acción administrativa para activar branch protection/required checks. Si `main` continúa sin protección, esa configuración es una mejora de gobierno externa al código, no motivo para saltarse el proceso.

## Gates pendientes antes de declarar V4 congelada

1. CI completo de esta rama en verde y merge a `main`.
2. Deployment de producción de Vercel realizado por el usuario desde el `main` mergeado.
3. Confirmar que Production tiene `CRON_SECRET` válido.
4. Verificar en logs que `/api/cron/activity-planner` deja de responder `401`.
5. Verificar en Neon una ejecución real y reciente de `PROC-PLAN-002` `succeeded|running`, junto con la reconciliación de planes vencidos y la retención.
6. Confirmar paridad del commit efectivo en los cuatro servicios Railway después del merge si se redepliegan.
7. Pasada visual/funcional final del usuario por el alias estable de producción, escritorio y móvil.

**V5 permanece pospuesta hasta cerrar esos gates.**
