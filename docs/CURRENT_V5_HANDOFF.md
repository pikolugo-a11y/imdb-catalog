# PikoFilm V5 — Handoff actual

Fecha: 2026-09-19

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

**CERRADO.** Rama de definición `audit/v5-04-processes`; PR #567 mergeada en `main` como `f101bcbdf98f577e3b8f5e3d5241845549d6cad7`.

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

#### PROC-08 — Concurrencia por entidad para Lifecycle

**APROBADA.**

- Lifecycle deja de serializar globalmente por defecto y pasa a exclusión por entidad/dependencia real cuando la independencia esté demostrada.
- La misma entidad nunca ejecuta dos pipelines contradictorios; se reutiliza/encadena el run activo o se informa “ya en proceso”.
- PROC-01 declara el scope de lock cuando aplique: global, entidad o recurso compartido.
- Límites de pool, cuotas, circuit breakers y locks globales justificados permanecen.
- Procesos realmente globales, como sync Plex global, pueden seguir serializados.
- La implementación futura requiere inventario de writers, tests de carrera/idempotencia y límites conservadores.
- No cambia ahora la concurrencia de producción.

#### PROC-09 — Contrato común para modelos de ejecución especiales

**APROBADA.**

- Batch común, Vercel chunked, controladores persistentes y GitHub Actions pueden seguir existiendo como motores distintos.
- Todos exponen una semántica común de estado, progreso, heartbeat/señal de vida, resultado funcional, trabajo pendiente, controles y recuperación.
- PROC-01 declara el modelo de ejecución y las capacidades pause/resume/cancel/retry cuando correspondan.
- PROC-05 aporta la semántica canónica de cierre/continuación.
- Actividad/Operaciones podrán consultar cualquier ejecución mediante una abstracción común sin conocer su infraestructura interna.
- No fuerza PQ-001, PQ-002 o NOV-001 al Batch Engine común ni crea un orquestador central nuevo.
- No autoriza ahora cambios de producción.

#### PROC-10 — Despliegue seguro y selectivo de workers

**APROBADA.**

- Todo cambio que pueda afectar al runtime de un worker debe desplegarlo.
- Cambios demostrablemente ajenos a su runtime, como documentación, no deben reiniciarlo.
- La selectividad debe considerar dependencias reales, incluidas librerías compartidas y contratos, no sólo archivos del worker.
- Una versión nueva no debe aceptar trabajo antes de superar CI/contratos/compatibilidad y el preflight runtime de PROC-02.
- Redeploys necesarios pueden ser frecuentes; el objetivo no es ahorrar deploys reales sino eliminar churn inútil y reducir version skew.
- No obliga a blue/green, Kubernetes ni nueva plataforma.
- No autoriza ahora cambios de configuración Railway.

### ESTADO DE FASE 2

**COMPLETADA.** Se han revisado individualmente y persistido 10 propuestas PROC-01 a PROC-10, todas aprobadas.

### ESTADO DE FASE 3 — INNOVACIÓN

**COMPLETADA.** 5/5 innovaciones revisadas y persistidas.

Decisiones persistidas en `docs/V5_INNOVATIONS_04_PROCESSES_BATCH.md`:

- `INNO-PROC-01 — PikoFilm Event Fabric`: **RECHAZADA**.
- `INNO-PROC-02 — PikoFilm Shadow Scheduler`: **APROBADA** → `INNO-03`.
- `INNO-PROC-03 — PikoFilm Adaptive Freshness`: **APROBADA** → `INNO-04`.
- `INNO-PROC-04 — PikoFilm Process Time Travel`: **RECHAZADA**.
- `INNO-PROC-05 — PikoFilm Self-Tuning Batch Engine`: **APROBADA** → `INNO-05`.

### CIERRE DEL PUNTO 4

**CERRADO.** Auditoría completa + 10 propuestas V5 revisadas/aprobadas + 5 innovaciones revisadas/persistidas.



### Punto 5 — Observabilidad y errores

**ACTIVO.** Rama de trabajo: `audit/v5-05-observability`.

Fase 1 — AUDITORÍA: **COMPLETADA** y persistida en `docs/V5_AUDIT_05_OBSERVABILITY_ERRORS.md`.

Conclusiones principales verificadas contra código + Neon + Railway + Vercel:

- El modelo canónico `process_runs + process_run_events + process_run_errors` está estructuralmente sano: FKs, índices, cobertura de `run_started`, `error_count` y metadatos de error son coherentes.
- En la ventana auditada hay ~39.435 runs, ~166.432 events y 432 errors; `process_run_events` ocupa ~61 MB, `process_runs` ~54 MB y errors ~496 kB.
- `admin_events` sigue siendo un segundo stream vivo (~64.637 filas / ~41 MB), sin `run_id` ni correlación estructural con el modelo canónico. No se autoriza borrarlo: primero debe clasificarse y auditarse su ownership/consumo.
- Los 432 errores de 30 días tienen step/source/code/entity completos; la calidad estructural del error es una fortaleza.
- Según la regla actual de Operaciones hay 0 incidencias activas: 310 errores fueron descartados manualmente y 122 se consideran auto-resueltos por éxito posterior.
- `resolved_at` significa hoy principalmente “deja de requerir atención”, no “causa reparada”. PikoQuality demuestra la diferencia: los process errors pueden estar descartados mientras el estado físico actual conserva 5 capture errors y 6 pendientes.
- La auto-resolución actual es demasiado amplia: cualquier run posterior técnicamente `succeeded` del mismo proceso/entidad basta. Se encontraron 3 SER-005 cerrados sólo por un success posterior con `functional_result=NULL`.
- El mayor ruido real es la mezcla entre validación funcional y fallo técnico: 204 intentos de “deshacer” una decisión inexistente de Series se registraron como process errors y dominaron además los errores runtime de Vercel.
- Vercel está sano en la foto reciente: **0 runtime errors en las últimas 24 h**; el histórico de 7 días está contaminado por errores funcionales esperables y fallos antiguos ya corregidos.
- `PROC-LC-001` confirma que `succeeded` puede contener errores recuperados: 55 runs succeeded con error_count>0 en 30 días; en ~72 h, 107 succeeded+updated acumularon 53 errores.
- Parents Batch/system pueden terminar failed/partial sin error directo porque la causa vive en hijos/items; la UX debe representar causa agregada sin fingir que “sin error directo” equivale a “sin fallo”.
- `event_type='error'` no es 1:1 con `process_run_errors`: 652 error-events vs 432 error rows; 83 runs tienen error-event sin error-row. Hace falta contrato semántico.
- Technical Snapshot, incluso en `stopped`, genera una línea de log aproximadamente cada 10 s; en ~84 min se alcanzaron 501 líneas casi idénticas. Heartbeat y logging deben desacoplarse.
- FAST/Plex registran cada `batch_item_done` en Railway; es útil para diagnóstico pero duplica estado durable y escala linealmente con el volumen.
- La retención de 30 días está funcionando y no se observaron filas canónicas más antiguas.
- Actividad/Operaciones tienen una buena separación UX: el problema V5 es mejorar la calidad de la señal, no añadir otro sistema de tracing ni mostrar más logs al usuario.

Fase 2 — PROPUESTAS: **ACTIVA**.

Decisiones persistidas en `docs/V5_DECISIONS_05_OBSERVABILITY_ERRORS.md`:

#### OBS-01 — Taxonomía canónica de señal

**APROBADA.**

- Se distinguen fallo técnico, validación/rechazo funcional, estado funcional pendiente/bloqueado e incidencia activa.
- Sólo un fallo técnico real genera `process_run_errors` y error de plataforma.
- Una validación funcional esperable debe terminar como resultado funcional/evento, no como avería técnica.
- `succeeded + pending/blocked` no equivale automáticamente a incidencia técnica.
- Un error recuperado puede conservar evidencia histórica sin mantener atención activa.
- Actividad, Operaciones y logs externos deben usar la misma taxonomía.
- No se crea un sistema paralelo ni se autoriza migración o reescritura retroactiva de errores históricos.

#### OBS-02 — Contrato canónico de incidencia activa y evidencia de resolución

**APROBADA.**

- Una incidencia sólo deja de estar activa cuando existe evidencia suficiente de que la condición original ya no requiere atención.
- Se reconocen cuatro vías: recuperación demostrada, resolución manual explícita, terminalización conocida y supersedida por nueva verdad.
- La resolución manual distingue descartar/aceptar/no aplicable/obsoleta de una reparación real.
- El cierre conserva procedencia: modo, razón, fecha, evidencia/run y alcance cuando corresponda.
- Un nuevo episodio del mismo problema tras el cierre se trata como recurrencia nueva, sin borrar el historial anterior.
- La regla actual de “cualquier success posterior del mismo proceso/entidad” deja de ser suficiente por sí sola.
- No autoriza ahora migraciones ni reescritura retroactiva del histórico.

#### OBS-03 — Causa efectiva agregada para parents, hijos e items

**APROBADA.**

- Un parent compuesto puede terminar partial/failed aunque no tenga un error directo propio.
- La causa efectiva se deriva de children, items y errors sin copiar filas al parent.
- Se distinguen fallo directo, fallos derivados, terminales, retries y trabajo funcional pendiente.
- Actividad resume impacto funcional; Operaciones explica la causa técnica agregada y permite navegar al detalle.
- Un mismo hecho no se cuenta varias veces por aparecer en distintas capas.
- No autoriza ahora nuevas tablas, migraciones ni cambios de UI.

#### OBS-04 — Contrato canónico de eventos, warnings y errores

**APROBADA.**

- Los eventos describen hechos de ejecución; los warnings expresan degradación tolerada; `process_run_errors` representa fallos técnicos reales.
- `event_type='error'` deja de ser un contador alternativo de fallos.
- Si un error técnico aparece también en timeline, debe referenciar el mismo error canónico y no contarse dos veces.
- Los warnings tienen métricas separadas y no crean automáticamente incidencia activa.
- Los errores recuperados conservan evidencia técnica, mientras OBS-02 decide si requieren atención.
- No se reescribe el histórico ni se autoriza ahora cambio de esquema.

#### OBS-05 — Estado operativo vigente separado del historial

**APROBADA.**

- El histórico responde qué ocurrió; el estado vigente responde qué requiere atención ahora.
- Cada dominio relevante expone su propia verdad actual de salud/deuda y Operaciones la consume mediante una proyección común.
- Descartar una incidencia histórica no puede ocultar un estado físico o funcional que siga degradado.
- Un error histórico tampoco mantiene el sistema en rojo si la condición actual ya está sana.
- Actividad puede mostrar incidencias pasadas aunque Operaciones esté hoy en verde.
- Se reutilizan tablas, heartbeats, breakers, planes y read models existentes; no se crea polling continuo ni un worker adicional.
- No se autoriza ahora una nueva tabla central de health ni cambios de producción.

#### OBS-06 — Procedencia estructurada de resolución y recurrencia

**APROBADA.**

- Toda resolución conserva modo, razón normalizada, evidencia/run cuando exista, fecha/hora y alcance.
- Se distinguen recuperada, descartada, no aplicable, terminal conocida y supersedida.
- Una reaparición tras el cierre se registra como nueva recurrencia/incidencia, no como reapertura artificial del episodio anterior.
- Las recurrencias pueden agruparse mediante un fingerprint estable basado en proceso, paso, código/clase, fuente, causa normalizada y scope.
- El texto literal completo no es la única identidad del patrón.
- No se crea ahora una plataforma de incident management ni se autoriza migración.

#### OBS-07 — Política de logging por nivel, agregación y sampling

**APROBADA.**

- ERROR queda reservado a fallos técnicos reales; WARN a degradación tolerada; INFO a transiciones/resúmenes; DEBUG a detalle de alta cardinalidad.
- Heartbeat y logging quedan desacoplados: un worker puede mantener señal de vida sin imprimir el mismo estado cada ciclo.
- Technical Snapshot no debe repetir `stopped` cada ~10 s.
- FAST/Plex/API deben preferir progreso agregado y resumen final frente a un INFO por cada item correcto.
- Errores, retries, terminalizaciones, breakers, crashes y transiciones críticas nunca se samplean ni suprimen.
- Los logs externos siguen siendo complementarios; la verdad durable permanece en Neon.
- No cambia ahora configuración de producción.

#### OBS-08 — Clasificación y destino de `admin_events`

**APROBADA.**

- Cada familia se clasifica como auditoría funcional canónica, evidencia de dominio correlacionable, duplicación operativa o legacy/transición.
- Antes de tocar datos se inventarían event/action, writer, readers, owner, propósito, duplicación, correlación, retención y destino V5.
- Las familias vinculadas a procesos deben poder correlacionarse con `process_runs`.
- La duplicación operativa debe dejar de crecer cuando exista una fuente canónica equivalente.
- No se borra ni migra ahora `admin_events`; cualquier retirada seguirá DB-11 y requerirá evidencia de ausencia de consumidores/autoridad.
- DB-01 y DB-06 gobiernan retención y ownership.

#### OBS-09 — Correlación mínima con runtimes externos

**APROBADA.**

- Toda ejecución observable conserva referencias mínimas al runtime concreto: servicio/modelo, deployment/workflow y build/commit cuando aplique.
- Los logs externos incluyen `run_id`, process/batch/entity IDs cuando el runtime lo permita.
- La navegación debe funcionar en ambos sentidos: PikoFilm → runtime/log y log → run.
- No se copian stdout/stderr ni trazas completas a Neon.
- La metadata de runtime ayuda a detectar version skew y complementa PROC-02/PROC-09/PROC-10.
- Actividad no se llena de infraestructura; la correlación permanece en Operaciones/diagnóstico técnico.
- No se autoriza ahora cambio de esquema ni configuración de plataformas.

#### OBS-10 — KPIs canónicos de salud actual, fiabilidad y recurrencia

**APROBADA.**

- La salud se separa en estado actual, fallos técnicos, recuperación, recurrencia, degradación y deuda funcional.
- Operaciones prioriza primero lo que requiere atención ahora y después aporta tendencia histórica.
- Los contadores brutos de errores no se usan como indicador aislado de salud.
- Se podrán medir incidencias nuevas, recurrencias y tiempo hasta recuperación por proceso/dominio.
- No se usará un único “health score” opaco que mezcle dimensiones heterogéneas.
- Las métricas se derivan preferentemente de fuentes existentes y sin nueva plataforma obligatoria.
- No autoriza ahora cambios de UI, esquema ni recalificación retroactiva.

### ESTADO DE FASE 2

**COMPLETADA.** OBS-01 a OBS-10 han sido revisadas individualmente, aprobadas y persistidas.

### ESTADO DE FASE 3 — INNOVACIÓN

**COMPLETADA.** 5/5 innovaciones revisadas y persistidas. Sólo INNO-OBS-02 fue aprobada e incorporada a `docs/ROADMAP_INNOVADOR.md` como INNO-06.

Decisiones persistidas en `docs/V5_INNOVATIONS_05_OBSERVABILITY_ERRORS.md`:

- `INNO-OBS-01 — PikoFilm Causal X-Ray`: **RECHAZADA**. No se incorpora al Road Map Innovador.
- `INNO-OBS-02 — PikoFilm Sentinel`: **APROBADA**. Incorporada a `docs/ROADMAP_INNOVADOR.md` como **INNO-06**.
- `INNO-OBS-03 — PikoFilm Anomaly Radar`: **RECHAZADA**. No se incorpora al Road Map Innovador.
- `INNO-OBS-04 — PikoFilm Blast Shield`: **RECHAZADA**. No se incorpora al Road Map Innovador.
- `INNO-OBS-05 — PikoFilm Chaos Lab`: **RECHAZADA**. No se incorpora al Road Map Innovador.

### CIERRE DEL PUNTO 5

**CERRADO.** Auditoría completa + 10/10 propuestas OBS-01 a OBS-10 aprobadas + 5/5 innovaciones revisadas/persistidas.

### SIGUIENTE PASO EXACTO

Cerrar la rama del Punto 5 mediante PR/CI/merge y, desde `main` actualizado, abrir una única rama para **Punto 6 — Workers y servicios persistentes**.

La Fase 1 del Punto 6 debe auditar especialmente consumo inactivo, polling, heartbeats, wake/sleep, despliegues, aislamiento entre workers, recovery, capacidad real, coste y coherencia entre Railway, Vercel y Neon.

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
- Innovaciones Punto 4: `docs/V5_INNOVATIONS_04_PROCESSES_BATCH.md`
- Auditoría Punto 5: `docs/V5_AUDIT_05_OBSERVABILITY_ERRORS.md`
- Decisiones Punto 5: `docs/V5_DECISIONS_05_OBSERVABILITY_ERRORS.md`
- Innovaciones Punto 5: `docs/V5_INNOVATIONS_05_OBSERVABILITY_ERRORS.md`
- Punto de reentrada de chat: `docs/CURRENT_V5_HANDOFF.md`

El Punto 5 queda cerrado en `audit/v5-05-observability`. El siguiente movimiento es PR/CI/merge de esta rama y después abrir el Punto 6 desde `main` actualizado.

## PikoRelevancia — integración productiva aprobada
- PROC-REL-001 deja de ser experimental: sigue fuera del Lifecycle, pero se integra en Catálogo · Series, Calidad y Actividad.
- Tras las pruebas reales de fuente, GDELT se retira por throttling/inestabilidad y se sustituye por Media Cloud; la fórmula productiva pasa a 0.3.0.
- Media Cloud usa una única consulta por serie, últimos 90 días, colección Spain - National (34412356), idioma español y pacing conservador de 31 s.
- Requiere MEDIACLOUD_API_KEY en Railway; MEDIACLOUD_ES_COLLECTION_ID queda configurable.
- No lanzar una nueva serie de prueba hasta que el usuario proporcione el IMDb elegido.
- Catálogo · Series muestra PikoRelevancia y ordena por defecto descendente; pendientes al final.
- `/calidad/relevancia` absorbe manualmente la deuda histórica, 50 por página y PikoScore descendente.
- Las selecciones múltiples se encolan con concurrencia 1.
- Sólo assessments ya existentes entran en mantenimiento automático adaptativo mediante PROC-PLAN-002.
- La españolidad queda desduplicada: origen ES = corrección pequeña; idioma español original o traducción satisfacen una única señal de accesibilidad.
- Tras cerrar y validar esta integración, reanudar exactamente en **V5 · Point 7 · Phase 3 · INNO-INT-02**.


### Ajuste UX de Catálogo tras validación visual de PikoRelevancia

- Rama de trabajo: `ux/catalogo-filtros-orden`.
- Decisión aprobada por validación visual: simplificar Catálogo eliminando combos redundantes de Plex y Orden.
- `Total / En Plex / Sin Plex` pasan a ser filtros directos.
- La ordenación pasa a cabeceras y debe ser global/server-side.
- País pasa a multiselección equivalente a Géneros.
- `Tipo` sólo se muestra en `Todo`.
- Plex deja de mostrarse como columna en la tabla.
- PikoRelevancia añade escala visual verde→rojo según relevancia.
- El botón de actualización de Series se retira del Catálogo; la acción corresponde a Calidad.



### Refinamiento UX adicional de Catálogo · 23-09-2026

- Rama: `ux/catalogo-refinements`.
- Aprobado implementar cabecera sticky, estado de orden visible, ciclo de orden por cabeceras, chips de filtros activos, total filtrado frente a universo, escala visible de PikoRelevancia 0–100, coma decimal española, `Pendiente` explícito, búsqueda interna en País/Géneros y prioridad móvil PikoRelevancia → PikoScore → PikoQuality.
- Debe conservarse el contexto exacto al entrar/salir de una ficha.
- Tras merge/validación de este ajuste, el punto de reentrada V5 sigue siendo **Punto 7 · Fase 3 · INNO-INT-02**.



### Hotfix Catálogo · Series · 23-09-2026

- Detectado en producción tras PR #605: `scope=series` generaba `ANY(3::text[])` en vez de un placeholder PostgreSQL `ANY($3::text[])`.
- Síntoma: `NeonDbError 42846 cannot cast type integer to text[]` al cargar Catálogo · Series.
- Corrección: el helper de scope construye explícitamente el placeholder parametrizado y se añade contrato de regresión.
- No afecta a PikoRelevancia ni a sus datos; es exclusivamente construcción SQL del filtro de tipo Series.



### Hotfix urgente de coste Neon · workers wake-driven

- Motivo: el consumo de Neon estaba dominado por compute (~99% del gasto) y las CU-h indicaban un compute mínimo prácticamente despierto 24/7.
- Causa confirmada en código: los workers Railway `api`, `fast` y `plex` consultaban la cola cada ~1 s y el worker técnico consultaba control/cola cada ~10 s aun sin trabajo.
- Solución: convertir los cuatro workers persistentes a modelo `enqueue -> authenticated wake -> drain -> idle`, sin polling Neon en reposo.
- Los endpoints wake usan HMAC derivado de la credencial PostgreSQL ya compartida; no se añade un secreto nuevo al repositorio.
- Railway Serverless debe habilitarse en los cuatro servicios.
- El planner horario actúa como recovery wake sólo si encuentra trabajo activo.
- Punto de reentrada V5 tras validar esta optimización: **Punto 7 · Fase 3 · INNO-INT-02**.



## REENTRADA CANÓNICA — 2026-09-24 · PUNTO 7 CERRADO

Este bloque prevalece sobre cualquier estado histórico contradictorio anterior dentro de este handoff.

- Rama de definición: `audit/v5-07-integrations`.
- Punto 6 — Workers y servicios persistentes: **CERRADO**; documentación canónica en `docs/V5_AUDIT_06_WORKERS.md`, `docs/V5_DECISIONS_06_WORKERS.md` y `docs/V5_INNOVATIONS_06_WORKERS.md`.
- Punto 7 — Integraciones externas: **CERRADO**.
- Fase 1 — Auditoría: **COMPLETADA** en `docs/V5_AUDIT_07_INTEGRATIONS.md`.
- Fase 2 — Propuestas: **COMPLETADA**; INT-01 a INT-10 revisadas individualmente y **APROBADAS** en `docs/V5_DECISIONS_07_INTEGRATIONS.md`.
- Fase 3 — Innovaciones: **COMPLETADA** en `docs/V5_INNOVATIONS_07_INTEGRATIONS.md`:
  - INNO-INT-01 Integration Fabric: **RECHAZADA**.
  - INNO-INT-02 Shadow Sources: **APROBADA** → Road Map Innovador `INNO-09`.
  - INNO-INT-03 Source Trust Ledger: **APROBADA** → Road Map Innovador `INNO-10`.
  - INNO-INT-04 Source Replay Lab: **RECHAZADA**.
  - INNO-INT-05 Adaptive Source Router: **APROBADA** → Road Map Innovador `INNO-11`.
- Los hotfixes posteriores de Catálogo/PikoRelevancia/scale-to-zero permanecen vigentes y no se reabren por este cierre.
- El asistente no despliega Vercel Production.

### SIGUIENTE PASO EXACTO

**Punto 8 — Frontend y UX · Fase 1 — Auditoría extremadamente detallada del sistema real.**

Antes de presentar propuestas UX, auditar código, rutas, componentes, navegación, estados loading/error/empty, tablas, filtros, móvil/responsive, accesibilidad, rendimiento percibido, densidad, coherencia entre superficies y comportamiento real de producción. Persistir primero la auditoría en Git.


## REENTRADA CANÓNICA — 2026-09-24 · PUNTO 8 FRONTEND Y UX

Este bloque prevalece sobre cualquier estado histórico contradictorio anterior dentro de este handoff.

- Rama activa: `audit/v5-08-frontend-ux`.
- Punto 7 — Integraciones externas: **CERRADO** en `main` mediante PR #609, merge `739b0bf2ddcfdf5d61725f6f0b9d2a5564449883`.
- Punto 8 — Frontend y UX: **ACTIVO**.
- Fase 1 — Auditoría: **COMPLETADA** y persistida en `docs/V5_AUDIT_08_FRONTEND_UX.md`.
- Fase 2 — Propuestas: **PENDIENTE DE INICIAR**.
- No se implementó ninguna modificación funcional durante la auditoría.
- No se mutó Neon y no se desplegó Vercel Production.

### Hallazgos de reentrada

- Catálogo tiene un patrón de filtros demasiado reactivo para una página server-side dinámica: búsqueda 260 ms, años 320 ms y cada selección múltiple provoca `router.replace`.
- Los logs recientes de producción muestran ráfagas de `GET /catalogo` durante uso real.
- Novedades y PikoRelevancia conservan tablas horizontales en móvil, a diferencia de Catálogo/Personas/Sagas.
- Sagas pierde filtros/orden/página al entrar en detalle y volver.
- Catálogo tiene sticky header con `top:0` debajo de un header global fijo de 64 px.
- Falta `aria-sort` en ordenaciones y naming accesible en checkboxes por fila de PikoRelevancia.
- Loading/error/empty no siguen un contrato uniforme entre superficies.
- Calidad mantiene buena separación funcional, aunque su navegación interna tiene dos niveles de orientación.
- Actividad y Operaciones mantienen correctamente la separación funcional/técnica.
- La coexistencia de múltiples generaciones CSS afecta la coherencia pero su consolidación profunda pertenece al Punto 9.

### SIGUIENTE PASO EXACTO

Presentar únicamente **UX-01**. Persistir APROBACIÓN/RECHAZO antes de presentar UX-02.


### DECISIÓN PUNTO 8 — UX-01

**APROBADA** el 2026-09-24 y persistida en `docs/V5_DECISIONS_08_FRONTEND_UX.md`.

Contrato: acciones simples siguen siendo inmediatas; filtros compuestos se confirman una sola vez antes de consultar; URL y retorno exacto se conservan.

**Siguiente paso exacto:** presentar únicamente **UX-02**. Persistir su decisión antes de UX-03.


### DECISIÓN PUNTO 8 — UX-02

**APROBADA** el 2026-09-24 y persistida en `docs/V5_DECISIONS_08_FRONTEND_UX.md`.

Contrato: Novedades y PikoRelevancia dispondrán de representación móvil compacta sin scroll horizontal obligatorio; PikoRelevancia añade naming accesible por checkbox.

**Siguiente paso exacto:** presentar únicamente **UX-03**. Persistir su decisión antes de UX-04.


### DECISIÓN PUNTO 8 — UX-03

**APROBADA** el 2026-09-24 y persistida en `docs/V5_DECISIONS_08_FRONTEND_UX.md`.

Contrato: toda navegación lista → detalle debe restaurar exactamente el contexto URL al volver; Sagas debe adoptar `returnTo` validado con fallback a `/sagas`.

**Siguiente paso exacto:** presentar únicamente **UX-04**. Persistir su decisión antes de UX-05.


### DECISIÓN PUNTO 8 — UX-04

**APROBADA** el 2026-09-24 y persistida en `docs/V5_DECISIONS_08_FRONTEND_UX.md`.

Contrato: las superficies principales deben distinguir loading, error, filtros sin resultados, ausencia real de datos y estado sano sin trabajo; errores secundarios aislables no derriban toda la página.

**Siguiente paso exacto:** presentar únicamente **UX-05**. Persistir su decisión antes de UX-06.


### DECISIÓN PUNTO 8 — UX-05

**APROBADA** el 2026-09-24 y persistida en `docs/V5_DECISIONS_08_FRONTEND_UX.md`.

Contrato: las cabeceras sticky respetan el offset del shell fijo y las columnas ordenables exponen semántica `aria-sort` equivalente al estado visual.

**Siguiente paso exacto:** presentar únicamente **UX-06**. Persistir su decisión antes de UX-07.


### DECISIÓN PUNTO 8 — UX-06

**APROBADA** el 2026-09-24 y persistida en `docs/V5_DECISIONS_08_FRONTEND_UX.md`.

Contrato: navegación móvil y popovers adoptan gestión coherente del foco; `Más` mueve el foco al abrir, evita navegación accidental por el fondo y restaura foco al cerrar; País/Géneros aplican exclusión mutua y los overlays conservan accesibilidad de teclado y móvil.

**Siguiente paso exacto:** presentar únicamente **UX-07**. Persistir su decisión antes de UX-08.


### DECISIÓN PUNTO 8 — UX-07

**APROBADA** el 2026-09-24 y persistida en `docs/V5_DECISIONS_08_FRONTEND_UX.md`.

Contrato: Calidad adopta una jerarquía perceptible única; las superficies especializadas se conservan y las subsecciones del Centro se presentan bajo una orientación clara `Calidad → sección actual`, con navegación móvil compacta y sin mezclar Operaciones.

**Siguiente paso exacto:** presentar únicamente **UX-08**. Persistir su decisión antes de UX-09.
