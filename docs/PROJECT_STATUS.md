# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Debe actualizarse después de cada hito relevante y antes de cerrar una sesión significativa. Su misión es permitir que una conversación nueva continúe exactamente donde terminó la anterior, sin depender de memoria conversacional.

## Estado registrado

**Fecha:** 19/08/2026 11:29 (Europe/Madrid)  
**Fase:** V2 estable + Novedades V1 preparada para despliegue/aceptación  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Último hito de código

PR **#39 — Novedades V1 + estabilización Series** fusionado correctamente a `main`.

**Merge commit:** `62880f5a0ed1cf33c8662979adbd89ff52fde256`  
**CI previo al merge:** SUCCESS.

Después del merge se añaden únicamente estos documentos de gobierno/continuidad (`PROJECT_RULES.md` y `PROJECT_STATUS.md`); no alteran funcionalidad de la aplicación.

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

**PENDIENTE DE CONFIRMAR/DESPLEGAR Y VALIDAR EN PRODUCCIÓN.**

La conversación terminó justo después de unificar el trabajo en `main`. No debe asumirse que producción ejecuta el merge `62880f5...` hasta verificar explícitamente el deployment de Vercel.

### Próximo paso exacto

1. Verificar/realizar un único deployment de `main` que incluya `62880f5a0ed1cf33c8662979adbd89ff52fde256` (y los commits documentales posteriores no funcionales si Vercel los incluye).
2. Confirmar que Vercel queda `READY` y que producción corresponde al commit esperado.
3. Ejecutar batería funcional post-deploy antes de cerrar issues.

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

## Issues conocidas al entrar en aceptación

Revisar siempre GitHub al retomar, porque este apartado puede quedar obsoleto. En el cierre de la sesión estaban relacionadas con esta entrega las issues **#36, #37, #38 y #40**; no deben cerrarse únicamente porque el código esté fusionado. Aplicar la regla: **deploy → pruebas funcionales → cierre**.

## Casos de regresión históricos importantes

- **Castle:** cambio de identidad Plex debe invalidar referencia derivada antigua y Series debe reconstruirla con la identidad nueva.
- **Love is in the Air:** un show inactivo/borrado de Plex no debe continuar generando Calidad de Series.
- **First Lady:** un alta desde Plex no debe quedar permanentemente con IMDb pendiente solo porque el rating todavía no exista localmente; el refresco individual debe poder consultar el dataset oficial de forma acotada.
- **Series / Todos:** `state=all` debe conservarse y no volver implícitamente a `Faltan ES`.

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
