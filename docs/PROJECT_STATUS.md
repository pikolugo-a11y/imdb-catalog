# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Debe actualizarse después de cada hito relevante y antes de cerrar una sesión significativa.

## Estado registrado

**Fecha:** 19/08/2026 12:17 (Europe/Madrid)  
**Fase:** V2 estable + Novedades V1 desplegada, en aceptación dirigida por el usuario  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Último hito funcional

PR **#39 — Novedades V1 + estabilización Series** fusionado a `main`.

**Merge funcional:** `62880f5a0ed1cf33c8662979adbd89ff52fde256`  
**CI previo al merge:** SUCCESS.

Incluye Novedades V1, discovery IMDb por datasets oficiales, criterios configurables, rescate España, exclusión configurable de India, candidatos manuales, reutilización de `catalog_exclusions` y `enrichTitle()`, job batch y trazabilidad Admin, robustecimiento de Series, exclusión operativa de series Plex inactivas y rating/votos IMDb on-demand para altas desde Plex.

## Deployment de producción

**DESPLEGADO Y VERIFICADO.**

El usuario realizó el deployment manual de producción y ChatGPT lo verificó en Vercel:
- proyecto: `imdb-catalog` (`prj_iApLZEUtSy3MTd6KT39PvagJrra2`);
- equipo: `PikoFilm`;
- deployment: `dpl_9JxhPtZRfuR8Kru8PLm3iyAttgfY`;
- estado: `READY`;
- rama: `main`;
- commit desplegado: `02c272bd0366f78671e18631f8fa051863b2f0c0`;
- dicho HEAD contiene el merge funcional `62880f5a0ed1cf33c8662979adbd89ff52fde256`.

Desde este punto está permitido ejecutar la batería funcional sobre producción, pero las pruebas funcionales/visuales las ejecuta siempre el usuario.

## Protocolo permanente de deployment y aceptación

Los deployments de producción en Vercel los realiza manualmente el usuario. ChatGPT deja `main` listo y avisa; el usuario despliega y confirma; ChatGPT verifica `READY` + commit exacto.

Después del deploy, ChatGPT diseña y conduce la batería de aceptación **prueba a prueba**. El usuario ejecuta siempre cada prueba funcional/visual en la aplicación y comunica el resultado. ChatGPT registra cada respuesta, decide si la prueba pasa o falla, diagnostica técnicamente cuando sea necesario y abre/actualiza issues si aparece una incidencia real. ChatGPT no debe sustituir al usuario ejecutando acciones funcionales de aceptación en producción.

## Batería funcional obligatoria post-deploy

### A. Series borradas / Calidad
- Confirmar que **Love is in the Air**, borrada/inactiva en Plex, no aparece operativamente en Calidad de Series.

### B. Actualizar Series / timeout
- Ejecutar Actualizar Series.
- Confirmar que completa en el primer intento.
- Revisar duración/instrumentación en Admin.

### C. First Lady / IMDb on-demand
- Abrir **First Lady** (`tt15787006`).
- Ejecutar Actualizar datos si procede.
- Confirmar rating/votos IMDb desde dataset oficial sin romper TMDb/FA.
- Confirmar TMDb `158808`.

### D. Novedades V1
Validar carga, criterios configurables, India excluida, candidatos generales, rescate España, alta IMDb manual, caso ya catalogado, caso excluido sin restauración silenciosa, excluir/restaurar, añadir y ampliar datos, desaparición de Novedades al catalogar, fallo/reintento, job manual/automático, trazabilidad Admin y ausencia de espera HTTP larga.

### E. Regresión mínima
Validar Catálogo, Biblioteca Plex, Calidad Películas, Calidad Series y filtro `Todos`, Sagas, Dashboard incluido décadas y Admin.

## Issues en aceptación

- **#36 abierta** — robustecer timeout de Actualizar Series.
- **#38 abierta** — Novedades V1 / aceptación funcional.
- **#40 abierta** — rating/votos IMDb on-demand para altas desde Plex.
- **#37 cerrada** — series eliminadas de Plex seguían apareciendo en Calidad; `Love is in the Air` sigue como caso de regresión obligatorio.

Regla: **deploy → pruebas funcionales del usuario → registro → cierre**.

## Casos de regresión históricos

- **Castle:** cambio de identidad Plex invalida referencia antigua y Series reconstruye la nueva.
- **Love is in the Air:** show inactivo no debe aparecer en Calidad ni KPIs.
- **First Lady:** alta desde Plex no debe quedar bloqueada en IMDb pendiente si el dataset oficial ya contiene el rating.
- **Series / Todos:** `state=all` debe conservarse.

## Documentación funcional/técnica

`docs/FUNCTIONAL_SPECIFICATION_V2.md` y `docs/TECHNICAL_SPECIFICATION_V2.md` siguen alineados con el código desplegado. El protocolo de aceptación no cambia funcionalidad ni arquitectura de PikoFilm.

## Próximo paso exacto

1. ChatGPT entrega al usuario la batería de aceptación de forma secuencial, una prueba cada vez.
2. El usuario ejecuta la prueba y comunica el resultado observado.
3. ChatGPT registra el resultado en esta bitácora y, si hay fallo real, abre/actualiza la issue correspondiente antes de continuar o diagnosticar.
4. Si hace falta código, actualizar especificaciones funcional/técnica cuando corresponda, fusionar y solicitar nuevo deployment manual antes de volver a probar.
5. Si las pruebas son satisfactorias, cerrar únicamente las issues validadas.
6. Actualizar esta bitácora después de cada bloque/hito de pruebas y antes de terminar la sesión.

## Documentos que deben leerse al retomar

En este orden:
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits/PRs de `main`.
