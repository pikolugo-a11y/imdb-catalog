# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Debe actualizarse después de cada hito relevante y antes de cerrar una sesión significativa.

## Estado registrado

**Fecha:** 19/08/2026 13:00 (Europe/Madrid)  
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
- **Criterios IMDb:** pantalla carga correctamente. Valores observados: películas general 6.0/10.000; películas ES 6.0/7.500; series general 7.0/5.000; series ES 6.5/4.000; India excluida (`Q668, IN`). PASS.
- **Persistencia de criterios:** el usuario cambió temporalmente películas general de 6.0 a 6.1 y pulsó Guardar; guardado correcto. PASS.
- **Alta manual — ya catalogado:** `tt0133093` (Matrix) y `tt3566834` fueron rechazados correctamente con mensaje `Ese IMDb ya está en el catálogo`. PASS anti-duplicado.
- **Alta manual — nuevo candidato:** `tt38268282` (`Steel Ball Run: JoJo's Bizarre Adventure`, 2026), verificado previamente como no catalogado/no excluido, fue aceptado con mensaje `IMDb añadido manualmente a Novedades`. PASS.

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

Pendiente de #42: adaptar la UX/acción `Buscar novedades ahora` para que no cree solicitudes pendientes sin ejecutor y para que muestre claramente el límite semanal / próxima fecha permitida.

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
- Novedades manual: un IMDb ya catalogado no se duplica; un IMDb nuevo puede entrar como candidato manual aunque no dependa de los umbrales automáticos.

## Documentación funcional/técnica

`docs/FUNCTIONAL_SPECIFICATION_V2.md` y `docs/TECHNICAL_SPECIFICATION_V2.md` están actualizados con la nueva política manual/semanal de discovery. Las pruebas de criterios y alta manual no cambian el diseño funcional/técnico ya documentado.

## Próximo paso exacto

1. Continuar la aceptación de Novedades V1 con el candidato manual `tt38268282`.
2. El usuario debe confirmar que aparece en Novedades con indicación/motivo de alta manual y que están disponibles las acciones previstas.
3. Después validar exclusión desde Novedades y aparición en la vista canónica de Excluidas; posteriormente restauración explícita.
4. Después validar `Añadir y ampliar datos` y que el candidato desaparece de Novedades y aparece en Catálogo.
5. Antes de probar el nuevo comportamiento del discovery, completar el ajuste de `Buscar novedades ahora`, dejar `main` listo y solicitar un nuevo deployment manual al usuario.
6. Mantener #41 y #42 abiertas hasta implementación + deploy + validación.

## Documentos que deben leerse al retomar

En este orden:
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits/PRs de `main`.
