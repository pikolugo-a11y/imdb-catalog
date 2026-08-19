# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 19/08/2026 (Europe/Madrid)  
**Fase:** Novedades V1 en aceptación; #41 y #43 cerradas tras PASS; #42 ampliada para ejecución real desde frontal  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar issues antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Producción actual
Producción validada anteriormente en commit `b5c43e9e8510c3205bd1d7a3f0a127e032bbfda0` (READY). Ese deployment contiene el frontal compacto y la alta parcial ya aceptados, pero **NO contiene todavía la ampliación posterior de #42 para lanzar GitHub Actions desde el frontal**.

## Batería ejecutada por el usuario — 19/08
### #41 — UX Novedades
PASS explícitos del usuario:
- nuevo frontal compacto carga correctamente;
- acciones visibles `Ver / IMDb / Añadir / Excluir`;
- acceso `Excluidas · 3` visible y vista de excluidos correcta;
- filtro Películas: 34;
- filtro Series: 111;
- búsqueda `Bekaaboo` combinada con Series;
- ordenación;
- ficha individual de candidato;
- enlace IMDb correcto.

**#41 cerrada como completada** tras registrar el PASS.

### #29 — descubribilidad Excluidas
El requisito que provocó su reapertura queda validado: desde Novedades el acceso a Excluidas es inequívoco y la vista funciona; Catálogo también dispone de acceso prominente. #29 permanece abierta porque su alcance es UX V2 global y tiene más criterios transversales que esta regresión concreta.

### #43 — alta parcial
Caso `tt38268282`:
- candidato localizado en Novedades: PASS;
- Añadir con TMDb sin match: entra en Catálogo: PASS;
- aparece en Calidad/Faltan datos: PASS;
- reintento sigue sin encontrar TMDb pero no elimina ni duplica el título: PASS.

**#43 cerrada como completada** tras PASS explícito del usuario.

## #42 — discovery manual desde PikoFilm
El usuario quiere validar una ejecución real desde el propio frontal, no entrando en GitHub.

Contrato vigente:
- sin cron;
- sin `schedule`;
- sin polling;
- máximo una ejecución exitosa cada 7 días;
- la web no crea `admin_job_requests pending`;
- el usuario inicia el proceso pulsando el control de Novedades.

### Implementación nueva en `main`
- `.github/workflows/imdb-discovery.yml`: sigue solo con `workflow_dispatch`; añade input `force_once`, default `false`.
- `worker/imdb-discovery.mjs`: mantiene guard semanal; `FORCE_DISCOVERY_ONCE=true` permite únicamente una ejecución excepcional y la traza como `manual_test_override`.
- `app/novedades/actions.js::requestNewsDiscoveryAction()`: recalcula cooldown server-side y hace POST autenticado al endpoint de GitHub Actions para `imdb-discovery.yml` sobre `main`.
- `lib/news-v1.js`: lee disponibilidad de override de aceptación.
- `app/novedades/page.js`: durante cooldown muestra `Ejecutar prueba única ahora` solo si el override está disponible; en situación normal muestra `Buscar novedades ahora` o bloqueo.
- el token GitHub se lee únicamente de `GITHUB_ACTIONS_TOKEN` en Vercel y nunca llega al navegador.
- si GitHub rechaza el dispatch, el override se rearma para no consumir la única prueba por un fallo técnico.

### Override de aceptación
Neon preparado explícitamente para esta batería:
- `app_settings.key='imdb_discovery_test_override'`;
- `enabled=true`;
- `used=false`;
- motivo `acceptance_test_2026-08-19`.

Se consume atómicamente por la Server Action. No se rearma automáticamente. Tras un discovery exitoso, ese nuevo `pipeline_runs status=success` vuelve a fijar el cooldown normal de +7 días.

### Commits principales de esta ampliación
- `6738001e...` workflow input `force_once`;
- `85e1c30d...` worker bypass controlado;
- `9d3513d5...` lectura override;
- `138dc09c...` dispatch server-side;
- `ea653a71...` control desde UI;
- `faa8896c...` corrección de control de redirect;
- documentación global/especializada actualizada hasta `399aa2d9...`.

## Seguridad
GitHub documenta que el endpoint `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` puede usarse con fine-grained PAT y requiere permiso de repositorio **Actions: write**. El token debe limitarse a `pikolugo-a11y/imdb-catalog` y guardarse solo en Vercel como secreto `GITHUB_ACTIONS_TOKEN`.

Ningún workflow del discovery se ha ejecutado durante esta implementación. ChatGPT no ha desplegado ni ha hecho la prueba funcional.

## Issues actuales relevantes
- #29 ABIERTA — UX V2 global; regresión Excluidas PASS.
- #38 ABIERTA — aceptación global Novedades aún en curso.
- #42 ABIERTA — falta prueba real desde frontal + comprobar nuevo cooldown.
- #41 CERRADA — PASS usuario.
- #43 CERRADA — PASS usuario.

## Documentación
Actualizados en este hito:
- `docs/FUNCTIONAL_SPECIFICATION_V2.md`;
- `docs/TECHNICAL_SPECIFICATION_V2.md`;
- `docs/NOVEDADES_V1_FUNCTIONAL.md`;
- `docs/NOVEDADES_V1_TECHNICAL.md`;
- `docs/PROJECT_STATUS.md`.

## Próximo paso exacto
1. El usuario crea un **fine-grained personal access token** limitado exclusivamente al repositorio `pikolugo-a11y/imdb-catalog`, con permiso **Actions: Read and write** y sin permisos adicionales innecesarios.
2. El usuario lo guarda directamente en Vercel, proyecto `imdb-catalog`, como variable sensible de producción **`GITHUB_ACTIONS_TOKEN`**. No pegar el token en ChatGPT ni en GitHub.
3. El usuario realiza deployment manual del `main` que incluya esta bitácora y los cambios de #42. ChatGPT no despliega.
4. ChatGPT verifica READY + commit desplegado.
5. Usuario entra en Novedades y debe ver `Ejecutar prueba única ahora`.
6. Usuario pulsa ese botón una sola vez.
7. ChatGPT verifica técnicamente que se creó exactamente un workflow run, que usa el override, que completa/falla con diagnóstico y que no existe solicitud `pending` huérfana.
8. Si completa, usuario refresca Novedades y confirma que vuelve `Discovery bloqueado 7 días` con próxima fecha ~+7 días.
9. Registrar batería y cerrar #42 solo tras PASS; después completar #38 y revisar qué parte de #29 sigue realmente pendiente.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits de `main`.
