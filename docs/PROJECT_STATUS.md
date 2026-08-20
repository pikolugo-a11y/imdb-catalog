# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 20/08/2026 (Europe/Madrid)  
**Fase:** evolución UX V3 — Calidad en curso; actualización completa de Series implementada mediante worker GitHub  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar trabajo funcional antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Hito Mi Biblioteca
`/plex` funciona como bandeja de entrada de elementos activos presentes en Plex y todavía ausentes del catálogo. La vista visual fue validada por el usuario el 20/08.

Incluye:
- tabla compacta;
- filtros Todos / Películas / Series, búsqueda y año;
- acción directa **Añadir al catálogo**;
- sin IMDb → **Resolver identidad**;
- sin ficha intermedia;
- última sincronización + **Actualizar Plex**;
- `added_at` rotulado **Añadido a Plex**;
- estado normal redundante eliminado;
- resumen superior compacto;
- estado vacío `Todo al día`.

## Alta parcial desde Plex
Caso de regresión: `tt5901280` / The River. Con identidad IMDb/Plex mínima fiable, TMDb no bloquea el alta: se conserva catalogado parcialmente, desaparece de Mi Biblioteca y queda pendiente en Calidad → Identidad. El proceso y el audit quedan trazados en Admin.

## Hito Calidad — portada V3
La portada `/calidad` es un centro de control operativo con:
- total de elementos que requieren atención;
- Películas, Series e Identidad como áreas accionables;
- PikoQuality diferenciado como motor técnico;
- botones **Actualizar** en Películas, Series e Identidad;
- fecha y resumen de última ejecución;
- trazabilidad en Admin.

## Cambio clave — actualización completa de Series
El antiguo `refreshSeriesV2()` procesaba por defecto solo 120 series. El universo real comprobado en Neon el 20/08 es:
- 954 series activas en Plex;
- 1.004 referencias históricas de series;
- 921 series activas, no excluidas y con TMDb, elegibles para refresco.

El botón de Series ya no ejecuta ese lote limitado en Vercel. Ahora:
1. PikoFilm crea un `pipeline_runs` `series_v2_refresh` en estado `running/queued` con el total real.
2. La Server Action hace `workflow_dispatch` de `.github/workflows/series-full-refresh.yml`.
3. `worker/series-full-refresh.mjs` procesa **todo el universo elegible** con concurrencia limitada de 6 series y reintentos TMDb.
4. Cada 10 series actualiza heartbeat/progreso en `pipeline_runs`: procesadas, total, %, temporadas, episodios y errores.
5. `/calidad` se autorrefresca cada 5 s mientras el run esté activo y muestra progreso real.
6. Al terminar se guardan snapshot antes/después y deltas de faltantes, anomalías y estados desconocidos.
7. Se registran `admin_events` de dispatch, inicio, finalización o fallo.
8. El workflow tiene cierre de fallo de infraestructura para evitar un `running` fantasma si el worker no llega a completar.
9. El mismo botón completo se usa tanto desde la portada de Calidad como desde `/calidad/series`.

No se ha creado ninguna tabla nueva. Se reutilizan `pipeline_runs`, `admin_events`, `series_reference*`, `series_season_availability` y las vistas/consultas existentes.

### Trazabilidad Admin
- Películas → `movie_quality_analysis`.
- Series → `series_v2_refresh` con `mode=full`, progreso y resumen antes/después.
- Identidad → `identity_scan`.
- Series además registra `refresh_dispatched`, `refresh_started`, `refresh_completed`, `refresh_failed` / `workflow_failed` según corresponda.

## Pendiente de aceptación
1. Deployment manual del HEAD actual de `main`.
2. Abrir `/calidad` y pulsar **Actualizar todas** en Series.
3. Esperado al lanzar: mensaje con el total real (aprox. 921, según estado actual de la BBDD).
4. Esperado durante ejecución: progreso `X / total` y porcentaje que cambia automáticamente cada ~5 s.
5. Esperado al finalizar: 100%, hora final, número total revisado, temporadas/errores y delta de faltantes.
6. Comprobar en Admin que existe un único `series_v2_refresh` con progreso y cierre, además de los eventos de auditoría.
7. Verificar que un segundo clic mientras corre no crea una segunda ejecución: debe informar de la ya existente.
8. Confirmar que `/calidad/series` lanza el mismo proceso completo, no un lote de 120.

## Próximo paso exacto
Desplegar manualmente el HEAD actual de `main` y ejecutar una actualización completa de Series desde Calidad para medir duración real y validar progreso/resumen.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits de `main`.
