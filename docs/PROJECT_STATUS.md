# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Debe actualizarse después de cada hito relevante y antes de cerrar una sesión significativa.

## Estado registrado

**Fecha:** 19/08/2026 12:54 (Europe/Madrid)  
**Fase:** V2 estable + Novedades V1 desplegada, en aceptación dirigida por el usuario  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Último hito funcional

PR **#39 — Novedades V1 + estabilización Series** fusionado a `main`.

**Merge funcional:** `62880f5a0ed1cf33c8662979adbd89ff52fde256`  
**CI previo al merge:** SUCCESS.

Incluye Novedades V1, discovery IMDb por datasets oficiales, criterios configurables, rescate España, exclusión configurable de India, candidatos manuales, reutilización de `catalog_exclusions` y `enrichTitle()`, job batch y trazabilidad Admin, robustecimiento de Series, exclusión operativa de series Plex inactivas y rating/votos IMDb on-demand para altas desde Plex.

## Deployment de producción

**DESPLEGADO Y VERIFICADO, pero producción todavía no incluye los últimos cambios de seguridad operativa del discovery.**

Deployment validado:
- proyecto: `imdb-catalog` (`prj_iApLZEUtSy3MTd6KT39PvagJrra2`);
- deployment: `dpl_9JxhPtZRfuR8Kru8PLm3iyAttgfY`;
- estado: `READY`;
- commit desplegado: `02c272bd0366f78671e18631f8fa051863b2f0c0`;
- contiene el merge funcional `62880f5a0ed1cf33c8662979adbd89ff52fde256`.

Los últimos cambios de `main` sobre discovery IMDb **aún no deben probarse en producción hasta nuevo deploy manual del usuario**.

## Protocolo permanente de deployment y aceptación

Los deployments de producción en Vercel los realiza manualmente el usuario. ChatGPT deja `main` listo y avisa; el usuario despliega y confirma; ChatGPT verifica `READY` + commit exacto.

Las pruebas funcionales/visuales las ejecuta siempre el usuario. ChatGPT diseña y conduce la batería prueba a prueba, registra cada resultado y abre/actualiza issues cuando procede.

## Batería funcional post-deploy

### A. Series borradas / Calidad — SUPERADA
- `Love is in the Air` no aparece en Calidad de Series.
- PASS. Regresión de #37 validada.

### B. Actualizar Series / timeout — SUPERADA
- Actualizar Series completó al primer intento.
- `series_v2_refresh`: success, 0 errores, 10.01 s; timings por fase persistidos.
- PASS. #36 cerrada.

### B2. Biblioteca → Actualizar Plex — SUPERADA
- Ejecutado por el usuario.
- 33 segundos, finalización correcta, sin timeout.

### C. First Lady / IMDb on-demand — SUPERADA
- `First Lady` (`tt15787006`, TMDb `158808`) se actualizó correctamente.
- IMDb quedó resuelto y el resto del enriquecimiento permaneció correcto.
- PASS. #40 cerrada.

### D. Novedades V1 — EN CURSO
- Carga básica de Novedades: PASS.
- Contadores observados: 146 propuestas = 34 películas + 112 series: coherente.
- UX actual considerada deficiente por el usuario: tarjetas superiores excesivamente altas y acciones demasiado dispersas.
- Creada **#41** para rediseño compacto: resumen en una fila, filtros compactos y acciones visibles por candidato (`Ver`, `IMDb`, `Añadir`, `Excluir`) más acceso visible a Excluidas.
- Estado mostrado por producción: `Último discovery: failed · 16 ago 2026, 5:04 · última solicitud pending (19 ago 2026, 10:19)`.
- El usuario comprobó en GitHub Actions que el workflow de discovery aparecía sin historial de ejecuciones.

## Cambio de política — discovery IMDb

El usuario establece como regla operativa definitiva:
- **sin cron**;
- **sin polling cada 5 minutos**;
- discovery solo bajo petición manual explícita;
- como máximo **una ejecución exitosa cada 7 días**;
- cualquier intento anterior debe fallar antes de procesar datasets.

Cambios aplicados en `main`:
- commit `18f4620b7f75cedc9eea0a88b8fffa8482f02e7b`: `.github/workflows/imdb-discovery.yml` queda únicamente con `workflow_dispatch`; eliminados todos los `schedule`.
- commit `0573c7226ba548e0b89f56c66bf41dbc46855fdb`: `worker/imdb-discovery.mjs` incorpora guard semanal contra la última ejecución exitosa de `pipeline_runs`; bloquea antes del trabajo pesado y registra `weekly_cooldown`.
- solicitud `admin_job_requests` id 34, pendiente desde 19/08/2026 10:19 UTC, marcada `failed` con motivo de cambio de política.
- issue **#42** redefinida como `Discovery IMDb — ejecución manual con límite semanal`.
- especificaciones funcional y técnica actualizadas en commits `75b8a3e65738c7403d13d4830dc3f2d254b26710` y `6aeaf9a8ff284c22528527a03901cb67c1d4c32d`.

Pendiente de #42: adaptar la UX/acción `Buscar novedades ahora` para que no cree solicitudes huérfanas y represente correctamente el modelo manual + límite semanal.

### E. Regresión mínima — PENDIENTE
Validar Catálogo, Biblioteca Plex, Calidad Películas, Calidad Series y filtro `Todos`, Sagas, Dashboard incluido décadas y Admin.

## Issues actuales relevantes

- **#36 cerrada y validada** — timeout de Actualizar Series.
- **#37 cerrada y regresión validada** — `Love is in the Air`.
- **#38 abierta** — Novedades V1 / aceptación funcional.
- **#40 cerrada y validada** — IMDb on-demand en `First Lady`.
- **#41 abierta** — rediseño UX compacto de Novedades con acciones visibles y acceso a Excluidas.
- **#42 abierta** — discovery IMDb solo manual, límite semanal y ajuste de la acción web.

## Casos de regresión históricos

- Castle: cambio de identidad Plex invalida referencia antigua y Series reconstruye la nueva.
- Love is in the Air: PASS 19/08/2026.
- First Lady: PASS 19/08/2026.
- Series / Todos: `state=all` debe conservarse.
- Biblioteca / Actualizar Plex: PASS adicional 19/08/2026; 33 s.
- Discovery IMDb: no debe existir cron/polling y un segundo intento antes de 7 días debe fallar antes de procesar datasets.

## Documentación funcional/técnica

`docs/FUNCTIONAL_SPECIFICATION_V2.md` y `docs/TECHNICAL_SPECIFICATION_V2.md` están actualizados con la nueva política manual/semanal de discovery.

## Próximo paso exacto

1. Continuar la aceptación de Novedades V1 sobre funciones que no dependen del nuevo código de discovery.
2. Siguiente prueba: validar **Criterios IMDb** desde la UI, sin ejecutar discovery.
3. Registrar resultado.
4. Después validar candidatos manuales, exclusión/restauración y alta al catálogo.
5. Antes de probar el nuevo comportamiento del discovery, completar el ajuste de `Buscar novedades ahora`, dejar `main` listo y solicitar un nuevo deployment manual al usuario.
6. Mantener #41 y #42 abiertas hasta implementación + deploy + validación.

## Documentos que deben leerse al retomar

En este orden:
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits/PRs de `main`.
