# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Debe actualizarse después de cada hito relevante y antes de cerrar una sesión significativa. Su misión es permitir que una conversación nueva continúe exactamente donde terminó la anterior, sin depender de memoria conversacional.

## Estado registrado

**Fecha:** 19/08/2026 11:56 (Europe/Madrid)  
**Fase:** V2 estable + Novedades V1 preparada para despliegue/aceptación  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Último hito de código

PR **#39 — Novedades V1 + estabilización Series** fusionado correctamente a `main`.

**Merge commit funcional:** `62880f5a0ed1cf33c8662979adbd89ff52fde256`  
**CI previo al merge:** SUCCESS.

Después del merge se añadieron únicamente documentos de gobierno/continuidad (`PROJECT_RULES.md` y `PROJECT_STATUS.md`); no alteran funcionalidad de la aplicación.

Al retomar el 19/08/2026 se verificó que los últimos commits de `main` eran:
- `0281e9a7c4384d4deac00f3c783d976fa596ac96` — bitácora operativa;
- `3012adff277ff2e35de94859804df1b38c1ebb8c` — reglas de oro;
- `62880f5a0ed1cf33c8662979adbd89ff52fde256` — merge funcional pendiente de aceptación.

Durante esta sesión se añadieron además commits documentales posteriores para reflejar el estado operativo y el protocolo de despliegue manual. No cambian funcionalidad de PikoFilm.

## Qué contiene la versión pendiente de aceptación

- Novedades V1.
- Discovery continuo mediante datasets oficiales IMDb, sin scraping.
- Criterios IMDb configurables.
- Reglas diferenciadas para películas/series generales y rescate de producción española.
- India mantenida como exclusión global configurable.
- Reutilización de `catalog_candidates`.
- Alta manual de un IMDb en Novedades aunque no cumpla umbrales.
- Exclusión reversible desde Novedades mediante el sistema canónico de exclusiones.
- Reutilización del pipeline de enriquecimiento para incorporar candidatos.
- Worker/ejecución automática y manual de discovery IMDb.
- Trazabilidad en Admin.
- Robustecimiento de Actualizar Series: mayor margen e instrumentación.
- Corrección de series borradas/inactivas en Plex que seguían apareciendo en Calidad (caso de regresión: `Love is in the Air`).
- Corrección del enriquecimiento IMDb bajo demanda para altas desde Plex cuando rating/votos aún no estaban cargados localmente (caso de regresión: `First Lady`, IMDb `tt15787006`).
- Documentación funcional y técnica actualizadas con estos cambios antes del merge.

## Estado de despliegue

**PENDIENTE DE DEPLOYMENT MANUAL POR EL USUARIO.**

Verificación realizada el 19/08/2026 11:46–11:49:
- Proyecto Vercel correcto: `imdb-catalog` (`prj_iApLZEUtSy3MTd6KT39PvagJrra2`, equipo `PikoFilm`).
- Deployment de producción vigente: `dpl_6CdxLKZdw7nJnByXKrVu5d2QasPA`.
- Estado Vercel: `READY`.
- **Commit realmente desplegado:** `76ee95d9ce002134416c47fc8a0d32fc684adfbe` (`fix: scope decade dashboard styles`).
- Por tanto producción **NO contiene todavía** el merge funcional `62880f5a...` ni los commits posteriores de documentación.

### Protocolo de deployment confirmado

El usuario ha aclarado que **los deployments de producción en Vercel los realiza siempre manualmente él**. ChatGPT debe avisar cuando un hito esté listo para desplegar, pero no debe intentar sustituir ese paso ni lanzar deployments por su cuenta.

Flujo obligatorio desde ahora:
1. ChatGPT deja `main` listo y documentado.
2. ChatGPT avisa explícitamente al usuario de que ya puede realizar el deploy manual.
3. El usuario realiza el deployment en Vercel y confirma que lo ha hecho.
4. ChatGPT verifica en Vercel que producción está `READY` y que `githubCommitSha` contiene el commit funcional esperado/HEAD correcto.
5. Solo entonces se ejecuta la batería funcional post-deploy.
6. Después de pruebas satisfactorias se cierran las issues correspondientes y se actualiza la bitácora.

La incidencia anterior sobre limitaciones del conector Vercel deja de ser un bloqueo operativo: no es necesario que ChatGPT disponga de capacidad de despliegue, porque ese paso pertenece al usuario por diseño del flujo de trabajo.

**No se ha ejecutado ninguna batería funcional nueva**, porque la regla de oro prohíbe probar como desplegados cambios que producción aún no contiene.

### Próximo paso exacto

1. **Avisar al usuario de que `main` está listo para deployment manual.**
2. El usuario debe realizar un único deployment de producción desde `main`, de forma que incluya como mínimo `62880f5a0ed1cf33c8662979adbd89ff52fde256` y los commits documentales posteriores.
3. Cuando el usuario confirme que el deploy está hecho, verificar en Vercel que queda `READY` y que `githubCommitSha` corresponde al HEAD esperado de `main` que contiene `62880f5a...`.
4. Actualizar esta bitácora inmediatamente después de verificar el deploy.
5. Ejecutar la batería funcional post-deploy completa antes de cerrar las issues pendientes.

## Batería funcional obligatoria post-deploy

Como mínimo validar:

### A. Series borradas / Calidad
- Confirmar que **Love is in the Air**, borrada/inactiva en Plex, ya no aparece operativamente en Calidad de Series.

### B. Actualizar Series / timeout
- Ejecutar Actualizar Series.
- Comprobar que completa de forma fiable en el primer intento con el volumen actual.
- Revisar duración/instrumentación en Admin.

### C. First Lady / enriquecimiento IMDb
- Abrir **First Lady** (`tt15787006`).
- Ejecutar Actualizar datos si procede.
- Confirmar que el flujo intenta completar rating/votos IMDb desde dataset oficial sin romper TMDb/FA.
- Confirmar que TMDb sigue correctamente asociado (`158808` según diagnóstico previo).

### D. Novedades V1
Validar al menos:
- carga de la sección Novedades;
- lectura de criterios configurables;
- India excluida en discovery automático;
- candidatos generales;
- rescate España;
- añadir IMDb manual que no cumpla criterios;
- caso IMDb ya catalogado;
- caso IMDb excluido: no restaurar silenciosamente;
- excluir desde Novedades y comprobar que aparece en Excluidas;
- restaurar exclusión;
- Añadir y ampliar datos;
- al completar: desaparición de Novedades y aparición en Catálogo;
- fallo/reintento sin perder candidato;
- job manual/automático y trazabilidad Admin;
- rendimiento razonable y ausencia de espera HTTP larga.

### E. Regresión mínima
- Catálogo.
- Biblioteca Plex.
- Calidad Películas.
- Calidad Series y filtro `Todos`.
- Sagas.
- Dashboard, incluido décadas.
- Admin.

## Issues al entrar en aceptación

Estado comprobado el 19/08/2026:
- **#36 abierta** — robustecer timeout de Actualizar Series.
- **#38 abierta** — Novedades V1 / aceptación funcional.
- **#40 abierta** — rating/votos IMDb on-demand para altas desde Plex.
- **#37 cerrada** — series eliminadas de Plex seguían apareciendo en Calidad. Su corrección está fusionada, pero `Love is in the Air` se mantiene como caso de regresión obligatorio en la batería post-deploy.

Aplicar siempre la regla: **deploy → pruebas funcionales → cierre**. No cerrar #36, #38 o #40 únicamente porque el código esté fusionado.

## Casos de regresión históricos importantes

- **Castle:** cambio de identidad Plex debe invalidar referencia derivada antigua y Series debe reconstruirla con la identidad nueva.
- **Love is in the Air:** un show inactivo/borrado de Plex no debe continuar generando Calidad de Series.
- **First Lady:** un alta desde Plex no debe quedar permanentemente con IMDb pendiente solo porque el rating todavía no exista localmente; el refresco individual debe poder consultar el dataset oficial de forma acotada.
- **Series / Todos:** `state=all` debe conservarse y no volver implícitamente a `Faltan ES`.

## Documentación funcional/técnica

`docs/FUNCTIONAL_SPECIFICATION_V2.md` y `docs/TECHNICAL_SPECIFICATION_V2.md` se revisaron al retomar y siguen alineados con el merge funcional pendiente de aceptación. La aclaración del protocolo de deployment no cambia funcionalidad ni arquitectura de PikoFilm, por lo que no requieren modificación en este hito.

## Documentos que deben leerse al retomar

En este orden:
1. `docs/PROJECT_STATUS.md` — dónde estamos y siguiente paso.
2. `docs/PROJECT_RULES.md` — reglas de oro obligatorias.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md` — comportamiento funcional vigente.
4. `docs/TECHNICAL_SPECIFICATION_V2.md` — arquitectura técnica vigente.
5. Issues abiertas y últimos commits/PRs de `main` — confirmar que la bitácora sigue alineada con GitHub.

## Protocolo de mantenimiento de esta bitácora

Actualizar este archivo tras cada:
- implementación significativa;
- merge;
- deployment;
- batería funcional;
- incidencia relevante;
- apertura/cierre de issue que cambie el estado operativo;
- cambio del próximo paso;
- cierre de sesión significativa.

Cada actualización debe dejar explícitos:
- fecha/hora;
- commit/deployment vigente;
- cambios realizados;
- pruebas ejecutadas y resultado;
- issues abiertas/cerradas;
- bloqueos conocidos;
- **próximo paso exacto**.

Nunca asumir que otra conversación conoce algo que no haya quedado persistido aquí, en los documentos, código, BBDD o issues.
