# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 19/08/2026 15:25 (Europe/Madrid)  
**Fase:** Novedades V1 en aceptación; #41 y #43 cerradas tras PASS; #42 bloqueada por disponibilidad del secreto en deployment Vercel  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar issues antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Producción actual
El usuario desplegó manualmente `02913bb740dd31128b3f79225f8d889f1414e9c4`; Vercel READY. Después creó `GITHUB_ACTIONS_TOKEN` como variable sensible para Production y Preview.

Incidencia de aceptación #42:
- al pulsar desde Novedades el control de prueba, la UI responde `Falta configurar la credencial segura de GitHub en Vercel.`;
- el usuario confirmó visualmente en Vercel que `GITHUB_ACTIONS_TOKEN` existe y está marcada Production and Preview;
- se realizó un redeploy posterior sin cache (`dpl_Fuc5WZpEPMYA1H9pFzdHuu5mnMu8`, build iniciado 13:21:27Z) y el síntoma persistió;
- por tanto no se considera PASS ni se ha lanzado todavía ningún workflow discovery desde PikoFilm.

Hipótesis operativa actual: un redeploy de un deployment existente puede conservar el snapshot de variables del deployment original. Para eliminar esa ambigüedad se crea este nuevo commit de bitácora **después** de existir la variable y se pedirá al usuario un deployment manual de este nuevo HEAD, no un `Redeploy` del deployment antiguo.

## Batería ejecutada por el usuario — 19/08
### #41 — UX Novedades
PASS explícitos: frontal compacto, acciones visibles, Excluidas, filtros, búsqueda, ordenación, ficha e IMDb. #41 cerrada.

### #29 — descubribilidad Excluidas
Regresión de Excluidas PASS desde Novedades; #29 permanece abierta por alcance UX V2 global.

### #43 — alta parcial
`tt38268282`: alta parcial, Calidad/Faltan datos y reintento sin pérdida/duplicado: PASS. #43 cerrada.

## #42 — discovery manual desde PikoFilm
Contrato vigente:
- sin cron/schedule/polling;
- máximo una ejecución exitosa cada 7 días;
- el usuario inicia desde Novedades;
- Server Action usa `GITHUB_ACTIONS_TOKEN` solo server-side;
- override de aceptación una sola vez en Neon (`enabled=true`, `used=false`);
- workflow solo `workflow_dispatch`, con `force_once` controlado;
- worker mantiene guard semanal independiente.

## Próximo paso exacto
1. Usuario realiza un **nuevo deployment manual del HEAD actual de `main`**, generado después de existir `GITHUB_ACTIONS_TOKEN`. No usar `Redeploy` de un deployment antiguo.
2. ChatGPT verifica READY + commit exacto.
3. Usuario entra en Novedades y pulsa `Ejecutar prueba única ahora` una sola vez.
4. Si la credencial ya está disponible, ChatGPT verifica técnicamente que se crea exactamente un workflow run y su resultado.
5. Si vuelve a indicar `dispatch_not_configured`, revisar configuración efectiva de variables del nuevo deployment antes de tocar código o regenerar token.
6. Registrar resultado y cerrar #42 solo tras PASS completo y cooldown posterior.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits/PRs de `main`.
