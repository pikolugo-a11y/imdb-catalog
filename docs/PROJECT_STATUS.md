# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 19/08/2026 14:50 (Europe/Madrid)  
**Fase:** Novedades V1 en aceptación; #41 y #43 validadas funcionalmente, #42 ampliada para prueba real desde frontal  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar issues antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Producción / deployment validado
El usuario realizó deployment manual del hito #41/#42/#43 y ChatGPT verificó READY + commit esperado antes de comenzar aceptación.

## Batería ejecutada por el usuario — 19/08
### #41 / #29 — UX y Excluidas
PASS explícitos:
- nuevo frontal compacto carga correctamente;
- acciones visibles `Ver / IMDb / Añadir / Excluir`;
- acceso `Excluidas · 3` visible y vista de excluidos correcta;
- filtro Películas: 34;
- filtro Series: 111;
- búsqueda `Bekaaboo` combinada con Series;
- ordenación;
- ficha individual de candidato;
- enlace IMDb correcto.

Conclusión funcional: #41 y requisito de descubribilidad de #29 han pasado la batería dirigida. Mantener issues abiertas hasta registrar/cerrar formalmente después de la regresión final del bloque.

### #43 — alta parcial
Caso `tt38268282`:
- candidato localizado en Novedades: PASS;
- Añadir con TMDb sin match: entra en Catálogo: PASS;
- aparece en Calidad/Faltan datos: PASS;
- reintento sigue sin encontrar TMDb pero no elimina ni duplica el título: PASS.

Conclusión funcional: contrato #43 validado por el usuario. Pendiente cierre formal tras registrar regresión final.

### #42 — discovery
UI muestra cooldown semanal. El usuario solicita poder probar una ejecución real **desde el propio frontal**, no desde GitHub.

Decisión:
- mantener máximo 1 éxito/7 días;
- sin cron, schedule ni polling;
- añadir dispatch server-side desde PikoFilm mediante `GITHUB_ACTIONS_TOKEN` guardado solo en Vercel;
- habilitar para aceptación una excepción controlada de una sola ejecución durante cooldown;
- usuario será quien pulse el botón desde PikoFilm;
- después de éxito, la nueva ejecución fija automáticamente el nuevo cooldown semanal.

Código ya presente en `main` al registrar este estado:
- `requestNewsDiscoveryAction()` realiza POST autenticado a workflow dispatch;
- `imdb-discovery.yml` acepta `force_once`;
- worker acepta `FORCE_DISCOVERY_ONCE` y deja trazabilidad;
- UI puede mostrar `Ejecutar prueba única ahora` si el override está habilitado;
- `app_settings.imdb_discovery_test_override` es la bandera de aceptación de una sola vez.

Requisito pendiente para producción: configurar `GITHUB_ACTIONS_TOKEN` en Vercel con privilegio mínimo y realizar nuevo deployment manual del usuario para que la Server Action use el secreto/configuración vigentes.

## Seguridad discovery confirmada
Los workflows siguen sin cron/polling. Discovery solo se ejecuta mediante `workflow_dispatch`. La web no crea `admin_job_requests pending`. El override de aceptación no rearma automáticamente y el worker conserva su guardia semanal independiente.

## Issues
- #29 ABIERTA — requisito funcional PASS; pendiente cierre formal.
- #38 ABIERTA — aceptación global Novedades aún en curso.
- #41 ABIERTA — batería principal PASS; pendiente cierre formal.
- #42 ABIERTA — falta probar dispatch real desde frontal y posterior cooldown.
- #43 ABIERTA — batería funcional PASS; pendiente cierre formal.

## Próximo paso exacto
1. Configurar en Vercel el secreto server-side `GITHUB_ACTIONS_TOKEN` con permiso mínimo para ejecutar Actions en `pikolugo-a11y/imdb-catalog`; el usuario no debe pegar el token en ChatGPT.
2. Confirmar/habilitar `imdb_discovery_test_override` una sola vez para aceptación.
3. Usuario realiza deployment manual de `main`; ChatGPT no despliega.
4. ChatGPT verifica READY + commit.
5. Usuario entra en Novedades y pulsa `Ejecutar prueba única ahora`.
6. ChatGPT verifica técnicamente que se creó exactamente un workflow/run y su resultado; usuario comprueba la UI.
7. Verificar que el frontal vuelve a `Discovery bloqueado 7 días` con próxima fecha +7 días y que no existe `pending` huérfano.
8. Registrar resultados, cerrar #29/#41/#42/#43 solo según PASS y completar #38/regresión restante.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits de `main`.
