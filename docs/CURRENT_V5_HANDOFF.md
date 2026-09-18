# PikoFilm V5 — Handoff actual

Fecha: 2026-09-18

Este documento es el punto de reentrada canónico para continuar la definición de V5 sin depender del historial del chat.

## Repositorio y forma de trabajo

Repositorio: `pikolugo-a11y/imdb-catalog`.

Antes de continuar hay que leer, como mínimo:

- `AGENTS.md`
- `docs/README.md`
- `docs/PROJECT_RULES.md`
- `docs/AI_DEVELOPMENT_GUIDE.md`
- `docs/V5_ROADMAP_FRAMEWORK.md`
- este `docs/CURRENT_V5_HANDOFF.md`
- los documentos de auditoría/decisiones del punto activo
- `docs/ROADMAP_INNOVADOR.md`

Reglas operativas:

- El asistente hace auditoría, diseño/UX, implementación cuando corresponda, tests, PR, CI y merge.
- El usuario sólo hace el deploy de Vercel Production y la validación visual/funcional final.
- El asistente NO despliega Vercel Production.
- Una única rama dirigida por corrección/bloque; evitar proliferación de ramas.
- Cada decisión V5 aprobada o rechazada se persiste en Git ANTES de presentar la siguiente.
- La documentación no prevalece sobre el estado real: contrastar código, Neon, Railway, Vercel y ejecución viva cuando aplique.
- No mutar datos históricos de Neon sin autorización expresa del usuario.

## Frontera de producto fija

PikoFilm gestiona BBDD, catálogo, calidad, procesos, integraciones y operaciones. Plex gestiona historial personal de visionado y señales de gusto.

PikoFilm no debe convertirse en gestor de visto/no visto ni construir perfiles/recomendaciones personales basados en historial de visionado. Si el catálogo necesita conocer un estado de visionado, se trata como dato externo de Plex.

## Método obligatorio para CADA UNO de los 20 puntos

No saltarse fases ni reducirlas.

### Fase 1 — Auditoría

Auditoría completa, profunda y extremadamente detallada del sistema REAL del dominio. Revisar lo materialmente relevante: código, datos, esquema e índices, infraestructura, ejecución, colas, workers, integraciones, frontend/UX, CI/CD, seguridad, costes, logs, métricas y documentación. Identificar bugs, deuda, duplicidades, incoherencias, costes, cuellos de botella, resiliencia y oportunidades. Persistir la auditoría en Git.

### Fase 2 — Propuestas V5

Presentar como mínimo 10 propuestas concretas derivadas de la auditoría. Revisarlas UNA A UNA. Cada una debe quedar APROBADA o RECHAZADA y persistida en Git antes de pasar a la siguiente.

### Fase 3 — Road Map Innovador

Después de las propuestas, presentar como mínimo 5 innovaciones deliberadamente rompedoras para futuro. Revisarlas UNA A UNA. Sólo las aprobadas se añaden a `docs/ROADMAP_INNOVADOR.md`. Una innovación aprobada no entra automáticamente en V5/V6/V7.

Un punto sólo se cierra cuando las tres fases están completas y persistidas.

## Los 20 puntos

1. Arquitectura general
2. Rendimiento
3. Base de datos y modelo de datos
4. Procesos automáticos y Batch
5. Observabilidad y errores
6. Workers y servicios persistentes
7. Integraciones externas
8. Frontend y UX
9. Sistema de diseño / CSS
10. Código legacy y deuda técnica
11. Tests
12. CI/CD
13. Seguridad
14. Coste
15. Mantenibilidad
16. Escalabilidad
17. Consistencia funcional
18. Recuperación y resiliencia
19. Calidad de datos
20. Gobierno del producto

La definición extensa y el estado formal viven en `docs/V5_ROADMAP_FRAMEWORK.md`.

## Estado actual

### Punto 1 — Arquitectura general

CERRADO.

- Auditoría: `docs/V5_AUDIT_01_ARCHITECTURE.md`.
- 15/15 propuestas V5 aprobadas.
- Ronda de innovación completada.
- Innovación aprobada: `INNO-01 — PikoFilm Autopilot`.

### Punto 2 — Rendimiento

CERRADO.

- Auditoría: `docs/V5_AUDIT_02_PERFORMANCE.md`.
- Fase 2: `PERF-01` a `PERF-10` aprobadas y persistidas.
- Fase 3: cinco innovaciones revisadas y persistidas.
- Innovación aprobada: `INNO-02 — PikoFilm Native / Local-First`.
- Debe aportar valor completo con un único ordenador. No presupone NAS, granja de equipos ni infraestructura doméstica adicional.

### Punto 3 — Base de datos y modelo de datos

ACTIVO. Rama de trabajo: `audit/v5-03-database`.

Fase 1 — AUDITORÍA: **COMPLETADA** y persistida en `docs/V5_AUDIT_03_DATABASE.md`.

Foto principal observada en Neon durante la auditoría:

- `neondb` ronda 869 MB;
- `person_filmography` es la relación más grande (~204 MB), con 549.892 filas;
- sólo 9.563 de 144.866 personas tienen filmografía enriquecida;
- `series_diagnostics` y `series_quality_read_model` muestran write amplification muy alta;
- `process_run_events`, `process_runs` y `admin_events` ocupan una fracción relevante de la base;
- existe retención de 30 días en algunos módulos pero no contrato global;
- conviven dos modelos de géneros divergentes;
- el workflow branch-first de Neon es sólido pero no existe ledger de migraciones aplicado en DB;
- `catalog_read_model` sigue siendo VIEW dinámica y necesita contrato de canonicalidad/rebuild para su futura materialización.

Fase 2 — PROPUESTAS: **ACTIVA**.

Decisiones persistidas en `docs/V5_DECISIONS_03_DATABASE.md`:

#### DB-01 — Contrato único de retención por clase de dato

**APROBADA.**

- Histórico operativo/técnico: 30 días por defecto.
- Invariante obligatoria: **la foto actual vigente nunca puede desaparecer por purgar histórico**.
- Estado vigente, datos canónicos y decisiones manuales deben persistir aparte o ser reconstruibles de forma determinista desde fuentes no sujetas a esa purga.
- No autoriza todavía ninguna purga ni mutación de Neon.

#### DB-02 — Personas canónicas: sólo profesionales consolidados y sólo películas reales con IMDb

**APROBADA.** Decisión detallada y vinculante en `docs/V5_DECISIONS_03_DATABASE.md`.

Invariantes funcionales:

- Sólo se enriquece filmografía completa para personas consolidadas: >5 películas distintas del catálogo como actor o >5 como director.
- Corregir la regla de directores para reconocer `credit_type='director'` además del legacy `crew + Director`. La revisión detectó 544 directores omitidos actualmente por esta inconsistencia.
- La filmografía sólo conserva **películas reales** útiles para PikoFilm.
- **IMDb es obligatorio**: obra sin `imdb_id` resuelto queda fuera. Si en un refresco futuro obtiene IMDb y cumple las demás reglas, podrá entrar entonces.
- Fuera: cortos, conciertos, teatro filmado, ceremonias, eventos deportivos, recopilatorios, especiales/making-of/featurettes y equivalentes no cinematográficos.
- Un género aislado (`Documental`, `Música`, `Película de TV`) no excluye una película legítima.
- No excluir por una palabra del título; usar identidad/tipo y metadata estructurada.
- Aunque la obra sea película válida, relaciones `Self`, `archive footage`, `host`, `presenter`, entrevistas/participantes y equivalentes se descartan.
- Pertenecer al catálogo no salva un crédito basura.
- **“Otros créditos” desaparece del frontal y del modelo persistido.** No habrá papelera de descartes: sólo métricas agregadas de descarte.

Datos reales que motivan DB-02:

- 126.349 filas actuales ya estaban marcadas como rechazadas (`short`, `self_or_archive`, `bonus_or_special`) y no deben pasar al modelo nuevo.
- Entre `feature_film` hay 6.791 obras distintas sin IMDb, afectando 11.321 relaciones; quedan fuera por decisión del usuario. Estas cifras pueden solaparse con otros descartes.
- Se detectaron al menos 677 obras adicionales hoy aceptadas que parecen conciertos/eventos/representaciones/recopilatorios no cinematográficos, afectando 1.260 créditos; es un suelo, no el inventario final.
- Dentro de relaciones hoy protegidas por `catalog` aparecen 1.152 créditos `Self/archive/host/...` en 484 obras.
- La tabla mezcla metadata de obra con relación persona↔obra: 549.892 filas representan sólo 176.116 obras distintas, por lo que existe repetición material de título/año/póster/géneros/etc.

Modelo objetivo DB-02:

- separar **obra de filmografía** de **relación persona↔obra**;
- guardar una única vez la metadata compartida de cada película;
- guardar aparte el crédito específico de la persona;
- persistir únicamente el universo aceptado;
- la foto actual útil de una persona elegible debe seguir siendo clara y persistente/reconstruible.

Implementación futura obligatoriamente transversal; no tratar como una migración aislada:

1. **BBDD y backfill:** nuevas estructuras normalizadas, backfill limpio, comparación persona a persona, medición real de tamaño antes/después, convivencia temporal con modelo viejo, retirada posterior sólo tras validación y autorización.
2. **Proceso automático `PROC-PER-001` / Batch / Railway:** regla canónica de elegibilidad, IMDb obligatorio, filtro de tipo de obra y crédito antes de persistir, métricas agregadas de descartes e idempotencia.
3. **Refresco manual:** debe usar exactamente la misma regla que Batch; no puede enriquecer juniors ni saltarse el clasificador.
4. **Frontend/UX Personas:** eliminar “Otros créditos”, sus contadores, pestañas/textos/filtros y mostrar sólo filmografía aceptada.
5. **Lecturas/API internas:** migrar `getPersonV2`, dashboard, Calidad de Personas y todos los consumers al nuevo contrato; no mantener dos fuentes de verdad.
6. **Tests:** cubrir umbral, directores, missing IMDb, tipos aceptados/rechazados, falsos positivos por título, `Self/archive`, voces/narradores legítimos, desaparición de Otros créditos, paridad funcional e idempotencia.
7. **Observabilidad:** personas elegibles/no elegibles, obras recibidas/aceptadas, descartes por missing IMDb/tipo/duración/crédito, errores de identidad y tamaño antes/después.

Plan de limpieza aprobado conceptualmente:

1. crear el nuevo modelo en rama temporal Neon;
2. clasificar los datos actuales con reglas V5;
3. backfill únicamente de obras con IMDb + créditos aceptados;
4. comparar conteos y ejemplos reales contra modelo anterior;
5. probar frontend, Calidad y procesos automáticos;
6. medir tamaño/índices y revisar divergencias;
7. desplegar código que lea/escriba el nuevo modelo;
8. validar producción;
9. **sólo con autorización expresa del usuario**, retirar la estructura histórica antigua y recuperar su almacenamiento.

La aprobación de DB-02 **NO autoriza todavía DELETE/TRUNCATE/DROP ni otra mutación histórica de Neon Production**.

### SIGUIENTE PASO EXACTO

Presentar al usuario **DB-03**, derivada de la auditoría de Base de datos, y pedir APROBAR/RECHAZAR.

No presentar DB-04 hasta que DB-03 quede persistida como aprobada o rechazada.

Candidatos pendientes de la Fase 2, a revisar uno por uno sin saltos: write amplification/idempotencia de read models, reconciliación diferencial de Series, modelo único de géneros, ledger/drift de migraciones, ownership/canonicalidad/rebuildabilidad por tabla, revisión de índices basada en evidencia, raw payloads/evidencia, guardrails de almacenamiento, constraints selectivas y clasificación/retirada de tablas legacy o vacías.

## Contexto funcional reciente ya cerrado

Durante la revisión de Rendimiento/Base de datos se corrigieron problemas reales detectados usando la aplicación. No reabrirlos salvo nueva evidencia.

- PR #553: capítulos combinados dobles/triples.
- PR #556: corrección doble→triple.
- PR #557: prioridad España y perfil TMDb de Series.
- PR #558: detalle de Calidad · Series aligerado.
- PR #560: exclusión manual reversible de episodios oficiales.
- PR #562: ordenación de Calidad · Series por faltantes y año.
- PR #563: margen canónico de 7 días desde estreno antes de convertir una ausencia física en faltante exigible; listado, detalle y read models alineados.
- PR #564: conciliación automática adicional de episodios combinados Plex↔TMDb mediante numeración explícita o títulos oficiales consecutivos + duración. Caso real de referencia: Shin Chan. Merge `3e34244f...`; CI verde y workers Railway desplegados.
- PR #565: sync Plex global de Novedades movido fuera de Vercel. Vercel sólo encola `PROC-NOV-009`; Railway Plex ejecuta el sync durable y encadena `PROC-NOV-008` en Railway API. Merge `b282f9b9...`; CI verde.
- La corrección de PR #565 ya quedó validada en producción: Vercel Production alcanzó `b282f9b9` y una ejecución real posterior de `PROC-NOV-009` terminó correctamente en Railway Plex en ~4m37s y encadenó `PROC-NOV-008` con éxito. El timeout global de 280s de Vercel queda cerrado.

## Persistencia y documentos canónicos

- Marco/metodología/20 puntos/estado: `docs/V5_ROADMAP_FRAMEWORK.md`
- Auditoría Punto 2: `docs/V5_AUDIT_02_PERFORMANCE.md`
- Decisiones Punto 2: `docs/V5_DECISIONS_02_PERFORMANCE.md`
- Innovaciones Punto 2: `docs/V5_INNOVATIONS_02_PERFORMANCE.md`
- Auditoría Punto 3: `docs/V5_AUDIT_03_DATABASE.md`
- Decisiones Punto 3: `docs/V5_DECISIONS_03_DATABASE.md`
- Innovaciones aprobadas: `docs/ROADMAP_INNOVADOR.md`
- Punto de reentrada de chat: `docs/CURRENT_V5_HANDOFF.md`

Al continuar el Punto 3, mantener la rama `audit/v5-03-database` para esta fase de definición y persistir cada decisión antes de presentar la siguiente.
