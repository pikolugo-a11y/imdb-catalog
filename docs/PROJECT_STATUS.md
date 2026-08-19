# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 19/08/2026 13:39 (Europe/Madrid)  
**Fase:** V2 estable + Novedades V1; #41/#42/#43 implementadas y documentadas en `main`, PENDIENTES de deployment manual y aceptación del usuario  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: **siempre manuales por el usuario**. ChatGPT no despliega.
- Pruebas funcionales/visuales: **siempre ejecutadas por el usuario**. ChatGPT diseña, dirige y registra.
- No cerrar issues antes de deploy + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Producción vigente
Último deployment validado: `dpl_9JxhPtZRfuR8Kru8PLm3iyAttgfY`, commit `02c272bd0366f78671e18631f8fa051863b2f0c0`.

Producción **NO contiene todavía** este hito. No atribuirle ningún resultado de #41/#42/#43 hasta nuevo deployment manual.

## Auditoría de issues
Revisadas abiertas/cerradas y últimos commits.

Cerradas y mantenidas por aceptación explícita del usuario: #36, #37, #40.

**#29 reabierta**: el usuario no encontraba Excluidas; el enlace pequeño existente no cumplía descubribilidad. Comentario registrado. Issues abiertas actuales: **#29, #38, #41, #42, #43**.

## Aceptación Novedades previa
PASS: carga, contadores 146=34+112, criterios y persistencia, anti-duplicado, alta manual `tt38268282`, retirar/reañadir, excluir, bloqueo de excluido y restauración explícita.

FAIL detectados:
- Excluidas no descubrible → #29/#41.
- `tt38268282` no catalogaba por `TMDb no encontró el título` (`pipeline_runs` 5957) → #43.

Resto de pruebas visuales/filtros aplazado por el usuario hasta el frontal nuevo.

## Hito implementado en main
### #41 — UX compacta
- tabla compacta de Novedades;
- KPIs compactos;
- toolbar única;
- acciones visibles `Ver / IMDb / Añadir / Excluir`, más `Retirar` manual;
- ficha `/novedades/[imdbId]`;
- `Excluidas · N` visible desde Novedades;
- `Ver excluidas` visible en cabecera de Catálogo;
- paginación 24/48/96;
- CSS responsive `app/novedades/news.css`.

### #42 — discovery seguro
- workflow discovery solo `workflow_dispatch`;
- guardia worker máximo 1 éxito / 7 días;
- web ya no crea `admin_job_requests` pending;
- Guardar criterios no dispara discovery;
- UI calcula cooldown y próxima fecha;
- cuando está permitido, botón abre explícitamente el workflow manual GitHub; cuando no, queda bloqueado.

### #43 — alta parcial
`enrichNewsCandidateAction()` conserva/catalogará la fila cuando hay identidad mínima fiable aunque falle una fuente secundaria. Marca `source_status.partial`, `enrichment_status=pending`, run `success/stage=partial`; Calidad/Identidad debe mostrar lo pendiente. Solo identidad mínima insuficiente hace rollback. Regresión: `tt38268282`.

## Documentación actualizada
- `docs/FUNCTIONAL_SPECIFICATION_V2.md` → commit `c580bea24407f47e21a5a5850ee99b11c244c95f`.
- `docs/TECHNICAL_SPECIFICATION_V2.md` → commit `754814936896fa3327909c820624922a09d11e61`.
- `docs/NOVEDADES_V1_FUNCTIONAL.md` → commit `87190eba5357aca3ae64007cc03d54f1bca4b5a2`.
- `docs/NOVEDADES_V1_TECHNICAL.md` → commit `9238b8d6755662365e9d513c65b0c0488ee59f99`.

## Revisión de workflows / seguridad GitHub
Revisados los 5 workflows actuales de `.github/workflows`:
- `imdb-discovery.yml`: solo `workflow_dispatch`, sin schedule.
- `imdb-ratings-refresh.yml`: solo `workflow_dispatch`.
- `catalog-enrichment-test.yml`: solo `workflow_dispatch`, timeout 3 min.
- `manual-maintenance.yml`: solo `workflow_dispatch`, read-only, timeout 5 min.
- `ci.yml`: únicamente `pull_request` a main/develop; no cron/polling.

No queda ningún workflow con ejecución periódica/cron. Esta revisión no lanzó ningún workflow.

## Revisión técnica antes de deployment
- búsqueda de `requestNewsDiscoveryAction`: sin referencias restantes;
- búsqueda de cola `admin_job_requests imdb_discovery` en código actual: sin referencias de ejecución web;
- workflow discovery confirmado sin `schedule`;
- HEAD no tiene status checks asociados porque los cambios se realizaron directamente en `main` y CI está configurado solo para `pull_request`; **no se ha ejecutado CI ni deployment automáticamente**, respetando la política del usuario.

## Commits funcionales principales del hito
- `f622dc4b2e0f972630d622d45c1ddc819b7584b1` — alta parcial + eliminar cola web.
- `876cb0e45d800f8396d3c0175af5605ee05d6b91` — stats/cooldown/paginación.
- `112dcbba5584ddd627e391b590df113962cf84ea` — frontal compacto.
- `eb53e9b224a9f64f52324f3b4f153bb6bee3b7cc` — ficha candidato.
- `1103ef4f7ef9eba497f3d755a3e63e6a78c666e9` + `f85512ee7761499b3115ce961fc1f53c73bc3454` — estilos.
- `bf6f830b14498bc54599ba10a011ad30a77901eb` — criterios sin ejecución.
- `316186c30082596d6d98a77fcb8f3b30e705f2fe` — Excluidas visible en Catálogo.

## Issues
- #29 ABIERTA — implementación parcial de descubribilidad preparada; pendiente aceptación.
- #38 ABIERTA — aceptación Novedades global pendiente.
- #41 ABIERTA — código listo, pendiente deploy + prueba.
- #42 ABIERTA — código listo, pendiente deploy + prueba.
- #43 ABIERTA — código listo, pendiente deploy + prueba.

## Próximo paso exacto
1. **Usuario realiza deployment manual de `main`**. HEAD esperado en el momento de esta bitácora: el commit de bitácora que resulte de esta actualización (descendiente de `9238b8d6755662365e9d513c65b0c0488ee59f99`).
2. Usuario confirma `ya está`.
3. ChatGPT verifica técnicamente deployment READY + commit exacto; no ejecuta pruebas funcionales.
4. ChatGPT entrega al usuario una prueba cada vez, empezando por carga/UX #41 y acceso a Excluidas.
5. Después #42 sin ejecutar discovery si el cooldown lo bloquea; comprobar mensajes/ausencia de pending.
6. Después #43 con `tt38268282`: Añadir debe catalogar parcial, desaparecer de Novedades y aparecer en Calidad/Faltan datos.
7. Ejecutar regresión mínima y cerrar solo lo que el usuario confirme PASS.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits de `main`.
