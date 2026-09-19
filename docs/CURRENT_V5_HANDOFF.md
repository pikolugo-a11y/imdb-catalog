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

Decisiones persistidas en `docs/V5_DECISIONS_03_DATABASE.md` y, desde DB-03, en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`:

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
- Corregir la regla de directores para reconocer `credit_type='director'` además del legacy `crew + Director`; la revisión detectó 544 directores omitidos actualmente.
- La filmografía sólo conserva películas reales útiles para PikoFilm.
- **IMDb es obligatorio**: obra sin `imdb_id` resuelto queda fuera.
- Fuera: cortos, conciertos, teatro filmado, ceremonias, eventos deportivos, recopilatorios, especiales/making-of/featurettes y equivalentes no cinematográficos.
- Un género aislado (`Documental`, `Música`, `Película de TV`) no excluye una película legítima.
- No excluir por una palabra del título; usar identidad/tipo y metadata estructurada.
- Relaciones `Self`, `archive footage`, `host`, `presenter`, entrevistas/participantes y equivalentes se descartan.
- Pertenecer al catálogo no salva un crédito basura.
- **“Otros créditos” desaparece del frontal y del modelo persistido.** No habrá papelera de descartes: sólo métricas agregadas.
- La implementación es transversal: BBDD/backfill, `PROC-PER-001`/Batch/Railway, refresco manual, frontend/UX, APIs internas, tests y observabilidad.
- La retirada física del modelo histórico antiguo requiere rama Neon, validación completa y autorización expresa del usuario.

#### DB-03 — Escrituras idempotentes y reconciliación por delta

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

- **Comprobar no equivale a cambiar**.
- Separar semánticamente cambio funcional de comprobación operativa.
- Preferir reconciliación por delta cuando pueda demostrarse equivalencia.
- Series tiene salvaguarda reforzada: eficiencia nunca por encima de corrección, frescura o recuperación; mantener full rebuild/reconcile seguro y decisiones manuales prioritarias.

#### DB-04 — Géneros canónicos únicos en castellano

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

- `genres` + `movie_genres_canonical` son la única verdad funcional.
- Sólo géneros aprobados en castellano.
- `movie_genres` es legacy sin autoridad funcional y se retirará tras migrar todos los consumidores.
- Las fuentes externas siempre pasan por el mapeo canónico; no crean géneros de producto por sí solas.
- `catalog_read_model` y todos los consumidores deben migrar al modelo canónico.

#### DB-05 — Esquema versionado, ledger de migraciones y detección de drift

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

Invariantes:

- Git conserva la historia oficial y Neon mantiene un ledger mínimo (`schema_migrations` o equivalente) de lo realmente aplicado.
- `db/migrations/` es el único directorio válido para nuevas migraciones; `/migrations` queda como histórico a auditar y cerrar.
- Migraciones aplicadas son inmutables; cambios posteriores requieren una migración nueva.
- Cada migración registra checksum para detectar drift.
- Git ↔ Neon se compara antes de migrar: pendiente, aplicada correcta o drift.
- Producción aplicará todas las migraciones pendientes válidas en orden, no sólo las detectadas por el diff del último commit.
- El workflow branch-first se conserva y se refuerza con ledger y detección de drift.
- El bootstrap histórico no reejecutará SQL antiguo automáticamente: primero se contrasta el esquema real y se establece baseline.
- **Impacto funcional para el usuario: ninguno.** Es seguridad de desarrollo/despliegue.
- **Impacto de coste: no material/despreciable** frente al resto de Neon; no añade workers ni polling continuo.
- El ledger representa estado estructural vigente y no se purga con la retención operativa de 30 días de DB-01.

#### DB-06 — Ownership, canonicalidad y rebuildabilidad explícita

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

Invariantes:

- Cada objeto persistente material debe declarar clase, owner funcional, fuente de verdad, escritores autorizados, reconstruibilidad, procedimiento de recovery y política de retención.
- Se distinguen explícitamente: canónico PikoFilm, decisión manual canónica, snapshot externo, proyección/read model, estado operativo vigente, histórico/auditoría y legacy/transición.
- **Toda decisión manual del usuario es no sustituible por un rebuild automático salvo regla de negocio aprobada en sentido contrario.**
- `series_episode_overrides` y demás overrides/correcciones manuales deben sobrevivir full rebuilds.
- Una proyección reconstruible debe tener mecanismo de rebuild probado; una tabla legacy sólo se retira cuando no conserve autoridad ni consumidores necesarios.
- La clasificación se versionará en Git y debe acompañar a nuevos objetos persistentes relevantes.
- DB-06 no añade procesos permanentes ni coste material y no altera la UX.

#### DB-07 — Gobierno de índices basado en evidencia

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

Invariantes:

- Un índice con pocos/cero scans es candidato a revisión, no candidato automático a borrado.
- Antes de retirar: comprobar constraints, consumidores, queries reales, solapamientos, `EXPLAIN/EXPLAIN ANALYZE` y prueba en rama Neon.
- Priorizar índices grandes, tablas con alto churn y duplicidades/solapamientos; no perseguir microahorros irrelevantes.
- También se pueden añadir índices cuando una necesidad real y medida lo justifique.
- Índices de tablas legacy se retiran junto con la tabla cuando corresponda.
- Series mantiene criterio especialmente conservador: ningún ahorro de MB tiene prioridad sobre conciliación, Calidad, frescura o recovery.
- La aprobación no autoriza ahora cambios de índices en producción.

#### DB-08 — Retención selectiva de raw payloads y evidencia técnica

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

Invariantes:

- PikoFilm conserva verdad procesada, estado funcional actual y evidencia necesaria; no archiva indefinidamente payload bruto reconstruible sin utilidad demostrada.
- JSON no se considera basura por ser JSON: se clasifica según DB-06.
- `piko_quality.components` se conserva por explicabilidad funcional.
- `title_ratings.raw_payload` es candidato a TTL una vez comprobados lectores y extraídos todos los campos útiles.
- `catalog_candidates.source_snapshot` puede expirar tras quedar resuelto/procesado, conservando el estado estructurado necesario.
- Histórico/payload operativo sigue DB-01, 30 días por defecto.
- Antes de retirar un raw: inventario de consumidores, normalización de campos útiles, tests de paridad y cambio de writers para evitar recrearlo.
- Limpieza futura progresiva/batcheada; no autoriza ahora mutaciones de Neon Production.

#### DB-09 — Guardrails de almacenamiento y crecimiento por dominio

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

Invariantes:

- Vigilar tamaño total, tamaño por tabla y cardinalidad para detectar crecimiento anómalo.
- Una foto diaria es suficiente; detalle 30 días y agregados más largos sólo si aportan valor.
- Los umbrales combinan crecimiento relativo y absoluto; no son techos rígidos.
- La señal debe integrarse con Actividad/Operaciones y explicar qué creció, cuánto y, cuando sea posible, qué proceso coincide.
- **Nunca** borrar, bloquear inserts, parar Plex/Series, ejecutar `VACUUM FULL` ni modificar datos automáticamente por superar un umbral.
- Series mantiene prioridad funcional total; cualquier anomalía genera diagnóstico, no bloqueo.
- El coste del propio guardrail debe ser no material.

#### DB-10 — Constraints selectivas para invariantes canónicos

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

Invariantes:

- PostgreSQL protege sólo invariantes estructurales estables/universales; la lógica de negocio evolutiva permanece en código/tests.
- Ninguna FK/CHECK/UNIQUE/NOT NULL nueva se añade por intuición: primero se auditan datos y excepciones reales.
- No se corrigen o eliminan filas sólo para hacer encajar una constraint.
- El caso `plex_streams` (2.933 filas sin correspondencia exacta en `plex_files`) queda como ejemplo explícito de por qué hay que entender la semántica antes de crear una FK.
- Series mantiene protección reforzada: los overrides legítimos no se fuerzan a corresponder 1:1 con episodios oficiales.
- El nuevo modelo de Personas DB-02 debe nacer con relaciones estructurales protegidas e IMDb obligatorio para obras aceptadas.
- La aprobación no autoriza ahora constraints nuevas ni mutaciones de Neon Production.

#### DB-11 — Inventario y retirada controlada de objetos legacy o vacíos

**APROBADA.** Decisión detallada en `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`.

Invariantes:

- Vacío no significa inútil; se clasifican objetos como ACTIVO, TRANSICIÓN, LEGACY CONFIRMADO o GESTIONADO EXTERNAMENTE.
- Antes de retirar se demuestran ausencia de readers, writers, dependencias, recovery y función futura aprobada.
- La retirada pasa por deprecación, eliminación de writers/readers, gate CI, prueba completa, rama Neon y migración controlada.
- `acquisition_status`, `batch_api_source_leases` y `series_episode_availability` no se eliminan por estar a 0 filas.
- Objetos `neon_auth` quedan fuera de la limpieza local.
- `movie_genres` y el modelo histórico de Personas se retirarán sólo al completar sus transiciones ya aprobadas.
- Series mantiene protección reforzada.
- DB-11 no autoriza ahora ningún DROP destructivo en Neon Production.

### ESTADO DE FASE 2

**COMPLETADA.** Se han revisado individualmente y persistido 11 propuestas DB-01 a DB-11, todas aprobadas.

### ESTADO DE FASE 3 — INNOVACIÓN

- 4/5 innovaciones mínimas revisadas.
- `INNO-DB-01 — PikoFilm Data Twin`: **RECHAZADA**.
- `INNO-DB-02 — PikoFilm Truth Engine`: **RECHAZADA**.
- `INNO-DB-03 — PikoFilm Phoenix`: **RECHAZADA**.
- `INNO-DB-04 — PikoFilm Self-Healing Data`: **RECHAZADA**.
- Las decisiones están persistidas en `docs/V5_INNOVATIONS_03_DATABASE.md`.
- Ninguna se incorpora al Road Map Innovador.

### SIGUIENTE PASO EXACTO

Presentar al usuario **INNO-DB-05**, quinta innovación rompedora del Punto 3. Tras persistir su decisión, cerrar formalmente la Fase 3 y el Punto 3 si no hay más innovaciones que revisar.

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
- Decisiones Punto 3 DB-01/DB-02: `docs/V5_DECISIONS_03_DATABASE.md`
- Decisiones Punto 3 DB-03+: `docs/V5_DECISIONS_03_DATABASE_03_PLUS.md`
- Innovaciones Punto 3: `docs/V5_INNOVATIONS_03_DATABASE.md`
- Innovaciones aprobadas: `docs/ROADMAP_INNOVADOR.md`
- Punto de reentrada de chat: `docs/CURRENT_V5_HANDOFF.md`

Al continuar el Punto 3, mantener la rama `audit/v5-03-database` para esta fase de definición y persistir cada decisión antes de presentar la siguiente.