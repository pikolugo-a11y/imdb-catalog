# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Debe actualizarse después de cada hito relevante y antes de cerrar una sesión significativa.

## Estado registrado

**Fecha:** 19/08/2026 13:12 (Europe/Madrid)  
**Fase:** V2 estable + Novedades V1 desplegada, aceptación dirigida por el usuario y correcciones pendientes  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Deployment de producción
Producción validada en deployment `dpl_9JxhPtZRfuR8Kru8PLm3iyAttgfY`, commit `02c272bd0366f78671e18631f8fa051863b2f0c0`, que contiene el merge funcional `62880f5a0ed1cf33c8662979adbd89ff52fde256`.

**Producción NO incluye todavía** los cambios posteriores de seguridad del discovery ni las correcciones que surjan de #41/#42/#43. Los deployments los realiza manualmente el usuario; ChatGPT avisa cuando `main` esté listo, verifica después el commit y dirige las pruebas que ejecuta el usuario.

## Aceptación completada
- Love is in the Air no aparece en Calidad Series: PASS; #37 validada.
- Actualizar Series completa al primer intento: PASS; #36 cerrada. Run técnico 10.01 s, 0 errores.
- Biblioteca → Actualizar Plex: PASS adicional, 33 s.
- First Lady `tt15787006`, TMDb `158808`: IMDb actualizado correctamente; PASS; #40 cerrada.
- Novedades carga correctamente: PASS.
- Contadores observados: 146 = 34 películas + 112 series.
- Criterios IMDb cargan y guardan: PASS. Valores observados: películas general 6.0/10.000, películas ES 6.0/7.500, series general 7.0/5.000, series ES 6.5/4.000, India excluida (`Q668, IN`). El usuario confirmó persistencia cambiando temporalmente 6.0→6.1.
- Alta manual anti-duplicado: `tt0133093` y `tt3566834` correctamente detectados como ya catalogados.

## Aceptación candidato manual `tt38268282`
Caso: `Steel Ball Run: JoJo's Bizarre Adventure` (2026).

Resultados ejecutados por el usuario:
1. Añadir IMDb manualmente → `IMDb añadido manualmente a Novedades`: PASS.
2. Candidato visible con acciones Añadir / Excluir / Retirar: PASS funcional; UX de acciones se rediseñará en #41.
3. Retirar → `Candidato manual retirado de Novedades`: PASS.
4. Volver a añadir tras retirar → permitido: PASS; retirar no crea exclusión.
5. Excluir → `Título excluido. No volverá a aparecer hasta restaurarlo.`: PASS.
6. Intentar alta manual estando excluido → bloqueado con aviso de restauración explícita: PASS.
7. Restaurar → `Exclusión retirada y candidato añadido a Novedades`: PASS.
8. Descubribilidad de Excluidas → FAIL UX: el usuario no encuentra acceso visible ni desde Novedades ni desde Catálogo. Se incorpora como requisito obligatorio de #41.
9. Añadir y ampliar datos → FAIL funcional: `No se pudo ampliar ese título. Sigue en Novedades para reintentar.`
10. Diagnóstico técnico: `pipeline_runs` id 5957, `job_type=single_title`, `status=failed`, error `TMDb no encontró el título`.

## Nueva regla funcional — alta parcial tolerante (#43)
El usuario confirma que una fuente secundaria ausente no debe bloquear la catalogación si existe identidad mínima IMDb fiable.

Creada **issue #43 — Alta tolerante a enriquecimiento parcial — TMDb/FA no deben bloquear catalogación**.

Contrato acordado:
- identidad mínima fiable → título entra en Catálogo;
- persistir datos disponibles;
- TMDb/FA/arte/u otras fuentes se intentan best-effort;
- fallo/no-match secundario no hace rollback;
- título parcial desaparece de Novedades;
- queda diagnosticado en Calidad/Faltan datos con fuente/campos pendientes;
- reintento posterior completa la misma fila sin duplicar;
- solo identidad insuficiente, duplicidad o integridad pueden bloquear el alta.

Caso de regresión obligatorio: `tt38268282` debe poder catalogarse aunque TMDb siga sin encontrarlo y quedar visible en Calidad como incompleto.

Especificaciones globales actualizadas para este contrato:
- `docs/FUNCTIONAL_SPECIFICATION_V2.md` commit `2e8b5b7395a3a99cc649bc1d5d7bdea4ac575c8f`;
- `docs/TECHNICAL_SPECIFICATION_V2.md` commit `a2e89daf235068d0cf6800eb856b49b8deb78bf1`.

## Política discovery IMDb
Regla definitiva del usuario:
- sin cron;
- sin polling cada 5 minutos;
- solo petición manual explícita;
- máximo una ejecución exitosa cada 7 días;
- intento prematuro falla antes de procesar datasets.

Aplicado en `main`:
- `18f4620b7f75cedc9eea0a88b8fffa8482f02e7b`: workflow solo `workflow_dispatch`;
- `0573c7226ba548e0b89f56c66bf41dbc46855fdb`: guard semanal en worker;
- solicitud pendiente histórica id 34 marcada failed por cambio de política;
- #42 abierta para completar UX/acción web y validación.

## Issues actuales relevantes
- #38 abierta — aceptación Novedades V1.
- #41 abierta — rediseño UX compacto de Novedades, acciones visibles y acceso inequívoco a Excluidas desde Novedades y Catálogo.
- #42 abierta — discovery IMDb solo manual, límite semanal y adaptación de la acción web.
- #43 abierta — alta tolerante a enriquecimiento parcial.
- #36/#37/#40 cerradas y validadas.

## Documentación funcional/técnica
`FUNCTIONAL_SPECIFICATION_V2.md` y `TECHNICAL_SPECIFICATION_V2.md` están actualizados con discovery manual/semanal y el nuevo contrato de alta parcial. #41 sigue siendo una mejora/defecto UX pendiente de implementación; sus requisitos están documentados en la issue y deberán reflejarse en las especificaciones al implementarse.

## Próximo paso exacto
1. Continuar la batería de Novedades sobre la versión desplegada solo en funciones no dependientes de #41/#42/#43.
2. No repetir todavía `Añadir y ampliar datos` de `tt38268282`; queda como regresión para validar después de implementar #43 y desplegar.
3. Validar filtros/segmentación y reglas visibles de candidatos actuales, incluida exclusión India/rescate España si la UI permite identificar casos.
4. Completar regresión mínima de pantallas existentes.
5. Después implementar conjuntamente #41, #42 y #43, actualizar especificaciones/bitácora, dejar `main` listo y pedir al usuario un único deployment manual.
6. Tras ese deploy, el usuario ejecutará las pruebas específicas de #41/#42/#43 y se cerrarán solo si pasan.

## Documentos que deben leerse al retomar
En este orden:
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits/PRs de `main`.
