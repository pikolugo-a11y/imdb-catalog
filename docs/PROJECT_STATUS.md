# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 19/08/2026 13:30 (Europe/Madrid)  
**Fase:** V2 estable + Novedades V1; correcciones #41/#42/#43 implementadas en `main`, PENDIENTES de deployment y aceptación del usuario  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Los deployments de Vercel los realiza **siempre el usuario manualmente**. ChatGPT prepara `main` y avisa; no despliega producción.
- Las pruebas funcionales/visuales las realiza **siempre el usuario**. ChatGPT diseña la batería, la dirige paso a paso y registra resultados.
- Ninguna issue que requiera aceptación se cierra solo porque exista código: debe estar desplegada y probada por el usuario.
- Especificación funcional, técnica y esta bitácora deben mantenerse vivas.

## Producción actual
Último deployment validado: `dpl_9JxhPtZRfuR8Kru8PLm3iyAttgfY`, commit `02c272bd0366f78671e18631f8fa051863b2f0c0`.

**Producción todavía NO contiene los cambios nuevos de #41/#42/#43 ni los cambios de seguridad del discovery posteriores a ese commit.** No probarlos hasta nuevo deployment manual del usuario.

## Auditoría de issues — 19/08/2026 13:30
Se revisaron issues abiertas/cerradas y últimos commits de `main`.

Cerradas con aceptación explícita reciente y mantenidas cerradas:
- #36 timeout Actualizar Series: PASS por usuario; completó al primer intento.
- #37 series eliminadas de Plex: PASS con `Love is in the Air`.
- #40 IMDb on-demand: PASS con `First Lady`.

**#29 reabierta.** Aunque la ruta `/catalogo/excluidas` existía y Catálogo tenía un enlace textual pequeño, el usuario confirmó en aceptación que no encontraba cómo llegar a Excluidas. Por tanto no cumplía el criterio de descubribilidad y estaba cerrada prematuramente. Se añadió comentario de auditoría a la issue.

Issues abiertas tras auditoría: #29, #38, #41, #42, #43.

## Aceptación ya realizada de Novedades
- carga básica: PASS;
- contadores 146 = 34 películas + 112 series: PASS;
- criterios IMDb cargan/guardan: PASS;
- anti-duplicado manual (`tt0133093`, `tt3566834`): PASS;
- `tt38268282` alta manual: PASS;
- retirar y volver a añadir: PASS;
- excluir: PASS;
- excluido bloquea alta silenciosa: PASS;
- restauración explícita: PASS;
- acceso visible a Excluidas: FAIL UX → #29/#41;
- `Añadir y ampliar datos` con `tt38268282`: FAIL por `TMDb no encontró el título` → #43.

Las pruebas visuales/filtros restantes de Novedades quedan aplazadas por decisión del usuario hasta desplegar el nuevo frontal.

## Implementación #41 — nuevo frontal Novedades
Preparada en `main`, sin cerrar issue:
- vista compacta tipo tabla en escritorio;
- KPIs compactos: propuestas, películas, series y último discovery;
- toolbar compacta con alta IMDb manual, tipo, búsqueda y orden;
- acciones visibles por fila: `Ver`, `IMDb`, `Añadir`, `Excluir`; `Retirar` adicional para manuales;
- nueva ficha `/novedades/[imdbId]`;
- acceso prominente `Excluidas` con contador desde Novedades;
- acceso prominente `Ver excluidas` desde cabecera de Catálogo;
- paginación 24/48/96;
- estilos responsive específicos en `app/novedades/news.css`.

Commits principales: `112dcbba...`, `eb53e9b2...`, `1103ef4f...`, `f85512ee...`, `316186c3...`.

## Implementación #42 — discovery manual seguro
Regla definitiva: sin cron, sin polling, máximo una ejecución exitosa cada 7 días.

Ya existente en `main`:
- workflow únicamente `workflow_dispatch` (`18f4620b...`);
- guard semanal dura en worker (`0573c722...`).

Cambio web nuevo:
- eliminada creación de `admin_job_requests` desde Novedades;
- eliminado `Guardar y buscar ahora` de Criterios: guardar nunca dispara/encola discovery;
- Novedades calcula la próxima fecha permitida desde el último `pipeline_runs` exitoso;
- si hay cooldown, el control queda bloqueado e informa de la próxima fecha;
- si está permitido, `Buscar novedades ahora` abre explícitamente el workflow manual de GitHub Actions; no existe ejecutor/polling oculto.

Commits principales: `f622dc4b...`, `876cb0e4...`, `112dcbba...`, `bf6f830b...`.

## Implementación #43 — alta tolerante a enriquecimiento parcial
Caso de regresión: `tt38268282`.

`enrichNewsCandidateAction` ahora distingue:
- **identidad mínima fiable**: título real distinto del IMDb ID + tipo IMDb soportado. Se crea el título y `enrichTitle()` se ejecuta best-effort. Si una fuente secundaria falla, NO se borra la fila: se marca `source_status.partial=true`, `enrichment_status=pending`, se cataloga el candidato y el run queda `success` con `stage=partial` y error pendiente trazable;
- **identidad mínima insuficiente**: conserva rollback y candidato reintentable.

Calidad/Identidad sigue siendo el mecanismo canónico para detectar IDs/datos faltantes; no se crea silo paralelo.

Commit principal: `f622dc4b...`.

## Issues actuales
- #29 ABIERTA — UX V2 / Excluidas; reabierta hasta que el nuevo acceso visible sea probado.
- #38 ABIERTA — Novedades V1; aceptación global pendiente del nuevo frontal y regresiones.
- #41 ABIERTA — implementación preparada, pendiente deploy + prueba usuario.
- #42 ABIERTA — implementación preparada, pendiente deploy + prueba usuario.
- #43 ABIERTA — implementación preparada, pendiente deploy + prueba `tt38268282` por usuario.

## Documentación
Las especificaciones funcional y técnica deben reflejar este hito antes de solicitar deployment. La bitácora ya registra implementación, auditoría y estado de aceptación.

## Próximo paso exacto
1. Actualizar `FUNCTIONAL_SPECIFICATION_V2.md` y `TECHNICAL_SPECIFICATION_V2.md` con el nuevo frontal, acceso visible a Excluidas, ejecución manual vía workflow y semántica de alta parcial.
2. Revisar sintaxis/consistencia del código y estado final de `main` sin desplegar.
3. Si no aparece bloqueo técnico, avisar al usuario de que `main` está listo y pedirle **un deployment manual**.
4. Tras confirmación del usuario, verificar commit desplegado/READY.
5. Preparar batería de aceptación nueva y hacer que **el usuario** la ejecute paso a paso: #41 primero, #42 sin provocar ejecuciones innecesarias, #43 con `tt38268282`, regresión #29 y finalmente #38.
6. Cerrar issues únicamente tras PASS explícito del usuario.

## Documentos que deben leerse al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits/PRs de `main`.
