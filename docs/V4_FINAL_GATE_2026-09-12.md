# PikoFilm V4 — Final Gate antes de V5

Fecha: 2026-09-12  
Estado: **automatización de Actividad aceptada en producción; cierre V4 reabierto únicamente por la regresión de emparejamiento de Series y la validación final posterior**.

## Objetivo

Última revisión transversal de V4 antes de reabrir decisiones V5. No añade una vertical nueva: corrige incoherencias de UX, observabilidad, accesibilidad, zona horaria, diagnóstico operativo y automatización real encontradas tras desplegar las remediaciones anteriores.

## Fuente de verdad revisada

- GitHub `main` y CI.
- Deployment productivo de Vercel y logs de runtime/build.
- Los cuatro servicios Railway (API, FAST, Plex, Technical) y su commit efectivo.
- Neon vivo mediante consultas de sólo lectura salvo cambios operativos concretos autorizados por el usuario para la prueba de planificación.
- Rutas V4 y contratos de regresión.

## Correcciones de este gate

### Cron / PLAN-002

- La autenticación sigue siendo **fail-closed**.
- Los rechazos `401` escriben únicamente diagnóstico booleano seguro: si `CRON_SECRET` está configurado y si llegó cabecera Authorization. Nunca se registra el secreto ni la cabecera.
- `.env.example` declara `CRON_SECRET` como requisito de Production.
- El runbook documenta el procedimiento exacto de diagnóstico.
- El control manual `Ejecutar ciclo automático ahora` reutiliza el mismo núcleo `PROC-PLAN-002`, pero queda explícitamente como diagnóstico/control: una ejecución `activity_manual` **no demuestra ni declara salud automática**.

Tras comprobar en producción que existían planes futuros pero ningún `PROC-PLAN-002` originado por cron, se endureció el contrato de autonomía:

- Vercel Cron llama `/api/cron/activity-planner` cada **5 minutos**;
- en minuto `00` ejecuta `mode=full`: reconciliación, demanda, previsión, planificación, despacho y retención;
- en los demás slots ejecuta `mode=dispatch`: reconciliación ligera y despacho de planes `planned` ya vencidos;
- los ticks intermedios no recalculan selectores pesados ni reintentan `delayed`, evitando coste innecesario y bucles de retry;
- la idempotencia se calcula por slot de cinco minutos, no por hora;
- `process_runs.context.mode` distingue `dispatch` de `full`.

El contrato detallado vive en `docs/operations/ACTIVITY_AUTOMATION.md`.

Actividad sólo puede mostrar `Automatización activa` si el deployment ve `CRON_SECRET`, existe un ciclo automático reciente de despacho y existe un `full` automático reciente. Los ciclos manuales no cuentan.

### Aceptación real de la automatización de Actividad

La automatización ya no está pendiente de demostración:

- `CRON_SECRET` quedó validado en Production;
- se observaron ejecuciones automáticas sanas de `PROC-PLAN-002` a las 18:40, 18:45, 18:50 y 18:55 hora Madrid;
- una prueba real autorizada movió el plan `e9619cf1-a57c-47d0-b226-4b65d70b7ff3` (`PROC-SER-004`, volumen 1) a las 18:59;
- el cron de las 19:00 lo recogió sin intervención humana y el plan terminó `completed` a las 19:00:33;
- por tanto queda demostrado que los trabajos planificados se lanzan automáticamente sin pulsar controles manuales.

### Observabilidad de Series

- `/calidad/series` deja de presentar `series_quality_runs` como última ejecución.
- `/calidad/series/[ratingKey]` deja de usar `series_quality_runs` para actividad/mantenimiento visible.
- Ambas superficies leen `process_runs`, la única observabilidad canónica.
- `series_quality_runs` no se elimina de Neon en este gate porque todavía existen escritores de compatibilidad; su eventual retirada requiere auditar esos escritores y no es necesaria para corregir la verdad visible.

### Regresión de emparejamiento de episodios

La auditoría del caso The Middle (`show_rating_key=94763`, IMDb `tt1442464`) demostró que un emparejamiento codicioso podía consumir por título un episodio Plex con numeración distinta y dejar otro archivo físico sin usar, generando un falso faltante.

PR #535 introdujo una reconciliación recíproca conservadora y corrigió The Middle en producción: tras un `PROC-SER-002` dirigido, S3E11 quedó `present`, Lifecycle pasó a `COMPLETE` y el read model terminó en `actionable_missing=0`.

La auditoría posterior de otras temporadas reordenadas detectó que esa regla podía confundirse con reordenaciones complejas. Ejemplo: Cowboy Bebop S1E12 (`Habla como un niño`) está físicamente en Plex E18, por lo que no debe resolverse mediante un residual numérico E9 perteneciente a otro capítulo.

PR #536 endurece el contrato:

- la reconciliación recíproca sólo actúa sobre un swap aislado: exactamente un faltante y un desplazamiento previo en la temporada, sin cobertura combinada;
- antes del fallback por número se reservan coincidencias de título normalizado únicas en ambos sentidos y con duración compatible;
- un archivo con duración de capítulo doble no se reserva sólo por coincidencia textual;
- `test/series-diagnostics-reconcile.test.mjs` pasa a formar parte de `npm run test:quality`, corrigiendo además el hueco por el que los tests añadidos en #535 no se ejecutaban dentro del CI canónico.

PR #536 quedó mergeada en `main` como `c316911f0ab5ef6a0f939e19030c6a9f416f3023`; CI de PR #627 y CI de `main` #628 terminaron correctamente.

### UX y accesibilidad

- estado de carga global V4 para transiciones dinámicas;
- progreso de cobertura del Inicio con nombres accesibles;
- menú móvil “Más” se cierra con Escape y devuelve foco al botón;
- búsqueda global explica el umbral de tres caracteres;
- acciones pendientes/confirmaciones completadas en Identidad, Películas, Series y Sagas;
- empty state de Calidad · Personas distingue una búsqueda sin resultados;
- paginación y textos alternativos mejorados en Personas/Sagas;
- Actividad diferencia visualmente automatización real, despacho automático parcial, secreto ausente y control manual.

### Hora civil

Se añade un formatter central `lib/format-madrid.js` para timestamps visibles. Inicio, Operaciones, detalle de ejecución, Identidad, Calidad · Personas, Series, detalle de Series, detalle de Sagas y fecha de refresco de Persona usan explícitamente `Europe/Madrid`.

Las fechas biográficas puras (nacimiento/fallecimiento) permanecen como fecha de calendario sin reinterpretación horaria.

## Comprobaciones de datos al abrir el gate

- Lifecycle sin filas ausentes ni huérfanas.
- `TECH_PENDING` actual correspondía a evidencia física nueva, no a la antigua regresión masiva.
- PikoQuality mantenía C6 vigente sobre todas las capturas técnicamente calculables; deuda de captura física y errores seguían separados.
- La divergencia entre `series_quality_runs` y `process_runs` quedó demostrada y motivó la corrección de UI.
- Existían planes `planned` con `dispatch_run_id=NULL`; el único `PROC-PLAN-002` observado inicialmente era manual. Eso confirmó que “ver tareas en calendario” no equivalía a “despacharlas autónomamente”.

## CSS / build

El deployment productivo `b3bcdf8…` se volvió a inspeccionar durante este gate. Su `next build` terminó `Compiled successfully` y **no contiene los warnings Autoprefixer que habían aparecido en builds anteriores**. Por ello no se eliminan a ciegas las hojas históricas globales en esta ronda: sin regresión observable ni warning vigente, una poda visual masiva sin navegador de regresión introduciría más riesgo que beneficio.

La consolidación física de CSS puede hacerse como refactor posterior independiente, con comparación visual, pero no es un bug funcional que bloquee V4.

## Seguridad de acceso privado

El acceso privado existente no se rediseña dentro de este gate. Cambiar el formato de la cookie/verificador sin un secreto de firma administrado por entorno puede debilitar la protección. Cualquier hardening posterior debe introducir una credencial de firma en entorno y migración controlada; no se sustituye por un token derivable del hash versionado.

## GitHub

La disciplina obligatoria sigue siendo rama → PR → CI → merge. La cuenta/conector usado por el agente no expone una acción administrativa para activar branch protection/required checks. Si `main` continúa sin protección, esa configuración es una mejora de gobierno externa al código, no motivo para saltarse el proceso.

## Gates cerrados

Quedan cerrados los antiguos gates de automatización de Actividad: CI/merge, deployment productivo de la automatización, `CRON_SECRET`, cron 2xx, `PROC-PLAN-002` automático `dispatch`, prueba real de despacho y ciclo `full`. Ya no deben volver a tratarse como hipótesis pendientes salvo regresión demostrada.

## Gates pendientes antes de declarar V4 congelada

1. Llevar Vercel Production al `main` vigente mediante deployment realizado por el usuario; el agente no despliega producción.
2. Confirmar paridad efectiva del `main` vigente en los cuatro servicios Railway cuando finalicen sus redeploys automáticos.
3. Ejecutar `PROC-SER-002` de forma canónica sobre los casos auditados de numeración/reordenación y comprobar después en Neon `series_diagnostics` y `series_quality_read_model`. No reparar diagnósticos con `UPDATE` manual.
4. Clasificar cualquier faltante que sobreviva a la reconstrucción como ausencia real, capítulo combinado/doble o discrepancia ambigua que requiera decisión humana; no inferir presencia sólo por igualdad de conteos.
5. Pasada visual/funcional final del usuario por el alias estable de producción, escritorio y móvil.

**V5 permanece pospuesta hasta cerrar esos gates.**
