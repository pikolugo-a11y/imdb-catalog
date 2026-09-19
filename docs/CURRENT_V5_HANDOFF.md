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

**CERRADO.** Rama de definición: `audit/v5-03-database`.

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

Fase 2 — PROPUESTAS: **COMPLETADA**.

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

**COMPLETADA.** 5/5 innovaciones mínimas revisadas:

- `INNO-DB-01 — PikoFilm Data Twin`: **RECHAZADA**.
- `INNO-DB-02 — PikoFilm Truth Engine`: **RECHAZADA**.
- `INNO-DB-03 — PikoFilm Phoenix`: **RECHAZADA**.
- `INNO-DB-04 — PikoFilm Self-Healing Data`: **RECHAZADA**.
- `INNO-DB-05 — PikoFilm Time Machine`: **RECHAZADA**.
- Las cinco decisiones están persistidas en `docs/V5_INNOVATIONS_03_DATABASE.md`.
- Ninguna innovación del Punto 3 se incorpora al Road Map Innovador.

### CIERRE DEL PUNTO 3

**CERRADO.** Auditoría completa + 11 propuestas V5 revisadas/aprobadas + 5 innovaciones revisadas/persistidas.



### Punto 4 — Procesos automáticos y Batch

**ACTIVO.** Rama de trabajo: `audit/v5-04-processes`.

Fase 1 — AUDITORÍA: **COMPLETADA** y persistida en `docs/V5_AUDIT_04_PROCESSES_BATCH.md`.

Conclusiones principales verificadas contra código + Neon + Railway + Vercel:

- El Batch Engine común está estructuralmente sano: en la foto auditada hay **0** runs activos huérfanos, **0** controls/padres desalineados, **0** items activos sin child y **0** parents terminales con items pendientes.
- La paridad manual/Batch es una fortaleza: los dominios revisados llaman cores canónicos compartidos.
- No existe un registro canónico único de procesos. La metadata está duplicada entre documentación, display, starters, adapters, planner y automatizaciones; `PROC-SER-007` y `PROC-LC-001` ejecutan producción pero no aparecen en el catálogo maestro.
- El planner real de producción es **horario**. El código conserva soporte para ticks de dispatch cada 5 minutos y un anexo documental sigue describiendo `*/5`, pero Vercel ejecuta `0 * * * *` y los logs lo confirman.
- El planner trata actualmente un parent `partial` como plan `completed`; aún no se observó un caso automático real afectado, pero el contrato permite `partial + pending` y debe gobernarse explícitamente.
- Batch común usa una política global de máximo 3 intentos con reintentos aproximadamente a 6 h y 24 h; `process_runs.retry_count` permanece en 0 y no representa los retries reales, que viven en items/errors.
- Se documentó un fallo real de capability drift: un Batch SAGA materializó 1.584 items para un worker sin adapter; tras corregir el despliegue, los 1.584 se procesaron correctamente.
- Existe una recuperación ad hoc de `PROC-LC-001` para el error `Adapter API no registrado`, señal de que falta un contrato genérico worker↔proceso.
- `PROC-PQ-002` repite cuatro poison items “sin streams” entre ejecuciones y convierte runs sucesivos en `partial`.
- Railway redeployó API/FAST/Plex/Technical incluso por el merge documental del Punto 3; además la configuración observada no espera explícitamente el CI post-merge.
- La gobernanza TMDb/OMDb/MDBList está funcionando: 0 rate limits en la ventana auditada y sin evidencia de presión de cuota.
- `PROC-NOV-009` está sano tras #565: las ejecuciones recientes en Railway Plex finalizan correctamente; no reabrir el antiguo timeout de Vercel salvo nueva evidencia.
- La selección automática de Personas aún usa la condición legacy de directores y debe quedar alineada cuando se implemente DB-02.
- `process_run_errors` conserva errores históricos abiertos que no equivalen a fallos actuales; se profundizará en Punto 5.

Fase 2 — PROPUESTAS: **ACTIVA**.

Decisiones persistidas en `docs/V5_DECISIONS_04_PROCESSES_BATCH.md`:

#### PROC-01 — Registro canónico y ejecutable de procesos

**APROBADA.**

- Un único registro versionado en Git será la fuente técnica de verdad para la identidad y contrato de cada `PROC-*`.
- Declarará, según el modelo de ejecución, nombre, dominio, estado, manual/Batch/automático/sistema, pool, adapter/capacidad requerida, planner, globalidad, concurrencia, core canónico y fuentes relevantes.
- Los procesos especiales permanecen especiales de forma explícita; no se fuerzan al Batch común.
- Planner, workers, UI técnica, labels y documentación deberán derivarse del registro o validarse contra él.
- CI debe fallar ante process codes desconocidos, adapters/pools incompatibles, procesos no automáticos introducidos en planner o metadata contradictoria.
- El registro no absorbe lógica funcional de Series, Personas, Novedades, PikoScore, etc.
- No autoriza aún refactor funcional, cambios de Neon ni despliegues.

#### PROC-02 — Preflight de capacidades antes de encolar Batch

**APROBADA.**

- PROC-01 declara la capacidad requerida; PROC-02 verifica la capacidad realmente desplegada antes de materializar `batch_run_control` + items.
- Cada worker/pool publica una foto ligera de build/versión, contrato y process codes/adapters soportados.
- Worker compatible pero temporalmente offline no equivale a worker incompatible.
- Si falta capacidad real, no se crea trabajo masivo destinado a fallar; el plan/demanda permanece pendiente o demorado de forma observable.
- Debe detectar control plane nuevo frente a worker aún antiguo.
- Permitirá retirar recuperaciones ad hoc por `Adapter API no registrado`.
- Complementa el CI estático de PROC-01 con una comprobación runtime/deploy.
- No autoriza ahora cambios de infraestructura ni producción.

#### PROC-03 — Política de reintentos por proceso y tipo de fallo

**APROBADA.**

- El retry deja de ser una regla global 6 h / 24 h / 3 intentos para cualquier error.
- El runtime clasifica fallos como TRANSIENT, RATE_LIMIT, QUOTA, PERMANENT, FUNCTIONAL_PENDING o CAPABILITY.
- Los 429/cuotas respetan `Retry-After`, `blocked_until` y circuit breaker existentes.
- Los errores permanentes no consumen retries inútiles; los estados funcionales pendientes se reprograman según reglas de negocio.
- PROC-02 previene los fallos de capacidad antes de materializar items.
- La política base es común y conservadora; cada proceso sólo ajusta lo estrictamente necesario.
- Para Batch, la fuente canónica del intento es `batch_run_items.attempt_count`; `process_runs.retry_count` no se considera actualmente canónico.
- Series mantiene sus reglas funcionales, margen de 7 días y decisiones manuales intactas.
- No autoriza ahora migraciones ni reintentos retroactivos.

#### PROC-04 — Terminalización de poison items y cuarentena funcional

**APROBADA.**

- Un item que demuestra no poder converger mediante el mismo mecanismo automático deja de circular por la cola normal.
- Se distinguen estados equivalentes a PERMANENT_ERROR, NOT_APPLICABLE y MANUAL_REVIEW; no existe una papelera opaca.
- Se conserva entidad, proceso, causa, intentos, fecha de terminalización, regla aplicada y condición de reentrada.
- Si cambia fingerprint/identidad/referencia/configuración relevante, la terminalización puede invalidarse y el item vuelve a ser elegible.
- Incidencias terminales conocidas no deben convertir indefinidamente cada nueva ejecución en `partial`.
- Series conserva sus estados funcionales, margen de 7 días y overrides; PROC-04 sólo actúa cuando la repetición técnica ya no aporta valor.
- No autoriza ahora migraciones ni mutación de los casos vivos observados.

#### PROC-05 — Semántica canónica de estados Batch y planner

**APROBADA.**

- Estado técnico, resultado funcional y estado del plan son dimensiones distintas y se evalúan de forma canónica.
- Un plan sólo queda `completed` cuando ya no existe trabajo funcional que PikoFilm espere continuar automáticamente.
- `partial + pending/retryable` no se cierra silenciosamente; `partial` sólo por terminales conocidas puede cerrarse con incidencia.
- `error_count>0` no implica por sí solo fallo si el objetivo funcional quedó resuelto.
- Parent Batch, planner y Actividad deben compartir el mismo evaluador de resultado.
- PROC-03 decide retry, PROC-04 terminalización y PROC-05 cierre global.
- No exige multiplicar estados ni autoriza migraciones; puede expresarse con los estados actuales si son suficientes.

#### PROC-06 — Planner horario único

**APROBADA.**

- El único reloj automático global de mantenimiento será el ciclo horario completo.
- Se retira como arquitectura objetivo el tick global de sólo dispatch cada 5 minutos.
- Código, `vercel.json`, documentación, RUNBOOK, Actividad y tests deben expresar la misma cadencia real.
- Las continuaciones urgentes pertenecen al proceso que las necesita y pueden seguir siendo inmediatas/durables.
- No hace automáticos `PROC-NOV-009` ni `PROC-SER-001`.
- Si un proceso futuro necesita SLA sub-horario, se resolverá de forma específica y justificada.
- No autoriza ahora cambios en Vercel Production.

#### PROC-07 — Planificación agregada por demanda

**APROBADA.**

- El trabajo futuro se representa preferentemente como demanda agregada + capacidad, no como cientos de microplanes homogéneos.
- Las ejecuciones reales se materializan cuando toca lanzarlas y siguen siendo totalmente trazables.
- Actividad conserva previsión por día/franja, carga, fecha estimada de finalización y próximos vencimientos.
- Se mantienen picos deliberados protegidos frente al equilibrador automático.
- El planner reconcilia la demanda viva antes de ejecutar para evitar microplanes obsoletos.
- Series sólo agrega unidades con la misma ventana funcional; no se pierde precisión temporal.
- No autoriza ahora migrar los planes existentes ni cambiar elegibilidad/concurrencia.



### SIGUIENTE PASO EXACTO

Presentar al usuario **PROC-08 — Concurrencia por entidad para Lifecycle**, sustituyendo el bloqueo global de admisión por exclusión sólo sobre la misma entidad/dependencia, para permitir altas independientes en paralelo sin romper la consistencia funcional.

No presentar PROC-09 hasta que PROC-08 quede persistida como APROBADA o RECHAZADA.

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
- Auditoría Punto 4: `docs/V5_AUDIT_04_PROCESSES_BATCH.md`
- Decisiones Punto 4: `docs/V5_DECISIONS_04_PROCESSES_BATCH.md`
- Punto de reentrada de chat: `docs/CURRENT_V5_HANDOFF.md`

El Punto 4 está activo en `audit/v5-04-processes`. Su auditoría ya está cerrada; continuar por Fase 2 y persistir cada decisión antes de presentar la siguiente.