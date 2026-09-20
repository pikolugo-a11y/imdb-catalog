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

## Punto 6 — Workers y servicios persistentes

**ACTIVO.** Rama de definición: `audit/v5-06-workers`.

Fase 1 — AUDITORÍA: **COMPLETADA** y persistida en `docs/V5_AUDIT_06_WORKERS.md`.

Conclusiones principales verificadas contra código + Railway + Neon + Vercel:

- Los cuatro servicios Railway están sanos y con una réplica, pero permanecen vivos la mayor parte del tiempo sin trabajo funcional.
- API/FAST/Plex consumen la cola mediante polling periódico de Neon incluso cuando no hay Batch.
- Las estadísticas acumuladas de PostgreSQL muestran millones de accesos sobre tablas de coordinación diminutas: el coste de coordinación ociosa es real.
- Technical Snapshot en estado funcional `stopped` continúa vivo, consulta/escribe su control aproximadamente cada 10 segundos y genera logs repetitivos.
- Technical sí tiene heartbeat durable; API/FAST/Plex no tienen liveness/capability durable cuando están ociosos.
- El lease de un child se renueva mediante `trace.heartbeat()`, pero el runtime común no lo hace automáticamente alrededor de cualquier core largo; Plex se protege explícitamente en sus rutas largas.
- Existe graceful shutdown básico y recuperación por leases expiradas.
- Technical usa restart policy `NEVER`; API/Plex usan `ON_FAILURE` con 10 retries y FAST con 3, sin un contrato único que explique la diferencia.
- Los cuatro workers se siguen redeployando por commits documentales; el selective deploy aprobado en PROC-10 todavía no está implementado.
- Railway tiene `checkSuites:false`; CI usa Node 22 mientras los contenedores reales mezclan Node 20/22/24 y no construye explícitamente todos los Dockerfiles.
- Plex/API/Technical emiten warnings `MODULE_TYPELESS_PACKAGE_JSON` que Railway clasifica como error aunque el worker arranca correctamente.
- Neon Production tiene `suspend_timeout_seconds=0`: reducir polling no haría dormir el compute por sí solo.
- El sleep/serverless de Railway no puede activarse sin más: el polling/heartbeat impide dormir y, sin un mecanismo de wake, una cola PostgreSQL podría quedarse sin consumidor.
- No hay evidencia de necesidad de escalar horizontalmente; la prioridad es idle/wake/readiness/recovery, no más réplicas.
- Estado actual sano: 0 Batch activos, 0 runs queued/running, cuatro deployments Railway SUCCESS y 0 errores Vercel en 24 h.

Fase 2 — PROPUESTAS: **ACTIVA**.

Decisiones persistidas en `docs/V5_DECISIONS_06_WORKERS.md`:

#### WKR-01 — Contrato canónico de presencia, versión y capacidades de worker

**APROBADA.**

- Presencia del worker y existencia de trabajo quedan separadas.
- Cada runtime/pool debe declarar presencia vigente, estado, capacidad, versión/build y capacidades reales.
- Antes de materializar trabajo, el preflight comprueba worker READY, heartbeat vigente, capability requerida y compatibilidad de versión.
- Sin capacidad válida, la demanda queda pendiente/trazable en lugar de crear items destinados a fallar.
- Heartbeats espaciados y orientados a presencia, no otro polling de alta frecuencia.
- No decide todavía wake/sleep, autosuspend, réplicas ni implementación física.

#### WKR-02 — Idle adaptativo sin polling agresivo

**APROBADA.**

- API/FAST/Plex reducen progresivamente la frecuencia de consulta cuando la cola permanece vacía.
- Al reaparecer trabajo, el worker vuelve inmediatamente a modo activo.
- Claim, mantenimiento de leases y heartbeat de presencia dejan de compartir necesariamente la misma cadencia.
- Cada pool puede tener límites de idle distintos según volumen y latencia aceptable.
- Puede evolucionar a wake hint ligero sin exigir broker o plataforma nueva.
- No activa todavía Railway sleep/serverless ni cambia Neon autosuspend.
- Recovery y demanda pendiente nunca pueden quedar bloqueados indefinidamente.

#### WKR-03 — Technical realmente quiescente cuando está detenido

**APROBADA.**

- `requested_state='stopped'` deja de provocar lectura, UPDATE y log cada ~10 segundos.
- Presencia del runtime y estado funcional de Technical quedan separados.
- Las transiciones se registran inmediatamente; el estado estable se observa con señal de baja frecuencia.
- `paused` conserva semántica distinta de `stopped`.
- La reactivación debe tener latencia razonable mediante backoff/wake equivalente.
- Encaja con OBS-07: registrar cambios, no repetir continuamente que nada cambió.
- No apaga todavía el contenedor Railway ni activa serverless/autosuspend.

#### WKR-04 — Lease heartbeat propiedad del runtime

**APROBADA.**

- El runtime común renueva automáticamente `last_heartbeat_at` y `lease_until` mientras un child Batch siga ejecutándose.
- Los cores pueden emitir progreso funcional, pero ya no dependen de heartbeats manuales para evitar expiraciones falsas.
- El heartbeat automático sólo existe mientras haya trabajo activo y se detiene siempre al finalizar/fallar/cancelar/cerrar.
- Si el proceso muere realmente, el heartbeat cesa y la lease expirada sigue permitiendo recovery.
- No cambia todavía TTL, retries ni número de intentos.

#### WKR-05 — Drain seguro antes de reinicio o deploy

**APROBADA.**

- Antes de detener/reiniciar/redeployar, el worker entra en `DRAINING` cuando el entorno lo permita.
- En `DRAINING` deja de reclamar trabajo nuevo pero mantiene vivos sus items activos.
- Existe un timeout de drain: si un item no termina, el apagado puede continuar y el recovery por lease se hace cargo.
- Operaciones debe poder mostrar worker en drain, trabajo activo y motivo.
- PROC-10 decide qué worker necesita deploy; WKR-05 define cómo detenerlo de forma segura.
- Con una réplica el objetivo no es zero downtime, sino no perder trabajo ni interrumpirlo innecesariamente.
- No añade réplicas, blue/green ni cambia retries/leases.


#### WKR-06 — Política canónica de restart y fallo fatal

**APROBADA.**

- Restart se decide por causa de terminación y recurrencia, no por cifras arbitrarias distintas por servicio.
- Se distinguen parada esperada, restart de deploy, crash, fallo de startup y fallo de recursos.
- Los fallos recuperables usan un restart budget limitado y observable; agotarlo lleva el worker a `UNAVAILABLE`.
- Reiniciar no equivale a estar listo: WKR-01 vuelve a validar heartbeat, versión/build, capabilities y preflight antes de `READY`.
- Un crash con trabajo activo sigue recuperándose mediante expiración de lease y PROC-03/Batch Engine; no se crea recovery paralelo.
- No fija todavía números del budget ni cambia Railway Production, réplicas, retries funcionales o Neon.

#### WKR-07 — Deploy selectivo real por impacto de runtime

**APROBADA.**

- Railway debe redeplegar sólo los runtimes realmente afectados por un cambio.
- El impacto se basa en un mapa verificable de dependencias, no sólo en carpetas.
- Documentación/tests sin efecto runtime no deben reiniciar workers.
- Ante incertidumbre, comportamiento conservador: ampliar deploy antes que arriesgar incompatibilidad.
- Se integra con PROC-10, WKR-05, WKR-06 y WKR-01.

#### WKR-08 — CI valida los runtimes reales de Railway

**APROBADA.**

- CI debe validar los Dockerfiles/runtimes reales de los workers afectados.
- La validación cubre versión Node, build, imports/ESM, startup básico y capabilities/adapters.
- Se reutiliza el mapa de impacto de WKR-07 para no construir imágenes innecesarias.
- Ante duda, se amplía la validación de forma conservadora.
- No obliga todavía a homogeneizar versiones Node.

#### WKR-09 — Contrato único de runtime Node y módulos ESM

**APROBADA.**

- Cada worker declara versión Node y modelo de módulos explícitos.
- Se reduce diversidad cuando no aporta valor técnico.
- Las excepciones requieren justificación documentada.
- Se eliminan warnings MODULE_TYPELESS_PACKAGE_JSON y ambigüedades ESM/CommonJS.
- WKR-08 valida el contrato real de runtime en CI.

#### WKR-10 — Estado real de workers visible en Operaciones

**APROBADA.**

- Operaciones será la superficie canónica para estado funcional de workers.
- Debe mostrar READY/BUSY/DRAINING/UNAVAILABLE, build, heartbeat, capacidad, capabilities, trabajo activo y demanda pendiente.
- READY + 0 trabajos es sano.
- Technical stopped funcionalmente puede coexistir con runtime READY.
- CPU/memoria/build logs completos siguen en Railway.

#### WKR-11 — Wake hint ligero productor → worker

**APROBADA.**

- El trabajo sigue persistido y durable en Neon.
- Un wake hint ligero saca al worker de idle/backoff cuando aparece demanda.
- Wake perdido o duplicado debe ser inocuo.
- El polling adaptativo sigue siendo la red de seguridad.
- No introduce broker/plataforma nueva ni activa Railway sleep.

#### WKR-12 — Suspensión física sólo cuando wake/recovery estén demostrados

**APROBADA.**

- Scale-to-zero/sleep sólo se evalúa tras tener presence, idle/backoff, wake y recovery demostrados.
- Se prueba pool por pool; Technical es el candidato natural inicial.
- Debe demostrarse wake, recovery ante wake perdido, arranque aceptable y compatibilidad con leases/drain/retries.
- El ahorro debe ser material; se contrastará en Punto 14 — Coste.
- No activa Railway sleep ni cambia autosuspend de Neon.

### INCIDENCIA INTERCALADA — Plex SER-001

Mientras WKR-06 estaba presentada pero todavía **sin decisión**, el usuario pidió revisar un fallo real de sincronización Plex.

Causa confirmada:
- `PROC-SER-001` falló en `sync_library` porque la petición Plex superó el timeout duro de 45 s.
- El mismo patrón ya había ocurrido el 13/09.
- Plex/Railway/Neon seguían sanos; fue una respuesta lenta/transitoria de esa consulta.
- El timeout no quedaba bien clasificado como retryable y SER-001 terminaba como `partial/no_change`, con resumen engañoso de 0 capítulos comprobados.

Corrección realizada en rama separada `fix/plex-series-timeout-retry`:
- helper de requests Plex con reintentos 45 s → 60 s → 90 s;
- heartbeat entre reintentos;
- timeout agotado queda `retryable=true`;
- SER-001 propaga fallos transitorios al Batch en vez de convertirlos en `partial/no_change`;
- tests específicos añadidos.

Estado:
- PR **#569** — **MERGEADA**;
- CI **#732** — **SUCCESS**;
- merge en `main`: `fed1ec0f40eef52b262785933ca97f48154e9625`;
- no se hizo deploy manual de Vercel Production;
- Railway puede redeplegar los workers afectados por seguir `main`.

### CAMBIO FUNCIONAL INTERCALADO — País en Catálogo

Antes de decidir WKR-07, el usuario pidió añadir país al listado de Catálogo y permitir filtrarlo.

Estado:
- rama funcional: `fix/catalog-country-filter`;
- PR **#570** — **MERGEADA**;
- CI **#736** — **SUCCESS**;
- merge en `main`: `f443a00a4098b05aba39cf5128173e0734c57a1d`;
- Catálogo muestra país en escritorio, carátulas y móvil;
- filtro País disponible para Todo, Películas y Series;
- fuente principal: `movie_countries + countries`, con fallback de compatibilidad a `movies.country`;
- Neon sólo se consultó en lectura; no hubo migraciones ni mutaciones;
- Vercel Production no fue desplegado por el asistente.
- WKR-07 quedó **APROBADA y persistida**; no se aprobó ni rechazó durante este cambio.

### CAMBIO FUNCIONAL INTERCALADO — Corrección de tipo + TMDb solo en Identidad

Antes de decidir WKR-07, el usuario pidió poder corregir casos Plex/Series mal tipados y enlazar correctamente series que parten sólo de TMDb.

Estado:
- rama funcional: `fix/identity-type-tmdb-only`;
- PR **#571** — **MERGEADA**;
- CI **#738** — **SUCCESS**;
- merge en `main`: `2f376128cb58701e18c5bca00535869a2843067a`;
- Calidad → Identidad permite corregir Película / Serie / Miniserie;
- cambiar tipo exige TMDb válido y se valida contra el tipo destino;
- TMDb solo queda disponible al seleccionar Serie/Miniserie aunque el registro estuviera mal tipado como Película;
- TMDb-only limpia overrides IMDb antiguos de Plex;
- una serie Plex TMDb-only ya catalogada queda enlazada inmediatamente en `plex_catalog_status`, desplazando de forma segura cualquier vínculo previo del mismo rating key;
- los refrescos preservan Miniserie;
- no hubo migraciones ni mutaciones manuales de datos;
- Vercel Production no fue desplegado por el asistente;
- WKR-07 quedó **APROBADA y persistida**.

### CAMBIO FUNCIONAL INTERCALADO — Reparación de enlaces Plex para TMDb-only

Tras comprobar Will y Grace (2017), se detectó que títulos ya catalogados no aparecen en Novedades y que el rebuild global de `plex_catalog_status` dependía de IMDb, rompiendo la presencia de series TMDb-only.

Estado:
- rama funcional: `fix/plex-tmdb-only-status`;
- PR **#572** — **MERGEADA**;
- CI **#740** — **SUCCESS**;
- merge en `main`: `beb29752ebf07c172726ace8f3364d1c842eb5e8`;
- sync global Plex: modo normal cruza por IMDb; Series/Miniseries TMDb-only cruzan por TMDb;
- Calidad → Identidad puede re-enlazar Plex por identidad canónica incluso cuando IDs/tipo no cambian;
- el enlace automático sólo se aplica con una única coincidencia Plex activa del tipo correcto;
- Novedades reutiliza el mismo linker canónico;
- comprobación real read-only: Will y Grace (2017), TMDb 74321, resuelve a Plex rating_key 156955;
- sin migraciones ni mutaciones manuales de Neon;
- Vercel Production no fue desplegado por el asistente;
- WKR-07 quedó **APROBADA y persistida**.

### CAMBIO FUNCIONAL INTERCALADO — TMDb-only: Datos + deduplicación Plex

Tras el sync de Series, el usuario detectó dos defectos reales en producción: El retorno de D'Artacán quedaba en DATA_INCOMPLETE pese a tener TMDb-only, y Will y Grace (2017) se duplicó al cambiar su rating_key de Plex.

Estado:
- rama funcional: `fix/tmdb-only-data-dedupe`;
- PR **#573** — **MERGEADA**;
- CI **#744** — **SUCCESS**;
- merge en `main`: `ea1defb416baa5fb2d4ac65921891e12e2348ef7`;
- DATA-001 TMDb-only ya no escribe columnas legacy inexistentes de ratings en `movies`;
- `enrichTitleTmdbOnly` ya no usa columnas legacy IMDb/FA/TMDb;
- DATA-001 queda estrictamente estructural; ratings continúan en `title_ratings`;
- Calidad → Datos alinea TMDb-only con Lifecycle: exige ficha estructural, pero no exige ratings múltiples ni PikoScore;
- NOV-010 deduplica TMDb-only por `tmdb_id` antes de crear candidato;
- NOV-007 repite la deduplicación en admisión como segunda barrera;
- el único duplicado TMDb-only histórico detectado en producción era Will y Grace, TMDb 74321;
- el usuario autorizó explícitamente la limpieza y se ejecutó en Neon de forma controlada;
- se conservó la ficha canónica antigua `tt990049053054057053053`, se fusionaron póster/backdrop, país y 5 créditos útiles de la ficha errónea, y Plex quedó enlazado al `rating_key` activo `159392`;
- se retiró la referencia de serie obsoleta `156955` junto con 52 referencias de episodio y 52 diagnósticos asociados a ese rating key inactivo;
- se eliminó la ficha duplicada `tt990049053057051057050`; el candidato histórico se conservó marcado con `deduplicatedTo` para trazabilidad;
- verificación final: 1 sola obra TMDb-only con `tmdb_id=74321`, 0 residuos de la ficha duplicada en tablas canónicas, 1 referencia de serie activa, 52 episodios oficiales y Lifecycle `COMPLETE`;
- sin migraciones ni mutaciones manuales de Neon;
- Vercel Production no fue desplegado por el asistente;
- WKR-07 quedó **APROBADA y persistida**.

### CAMBIO FUNCIONAL INTERCALADO — Series sin fecha TMDb no exigibles

El usuario detectó que episodios oficiales aún ausentes de Plex pero sin `air_date` en TMDb aparecían como disponibilidad pendiente / por confirmar (caso real: Héroes de Guardia T2).

Estado:
- rama funcional: `fix/series-undated-not-due`;
- PR **#574** — **MERGEADA**;
- CI **#746** — **SUCCESS**;
- merge en `main`: `078e5ddef9f79c764f721a74f5bdd40636c9f57a`;
- regla canónica: episodio ausente + `air_date IS NULL` = **no exigible aún**;
- no cuenta como faltante exigible;
- no genera disponibilidad España pendiente ni `availability_unknown` operativo;
- no fuerza `SERIES_REVIEW`;
- PROC-SER-004 omite comprobaciones TMDb/Watchmode para episodios sin fecha;
- en UX se muestra **Sin fecha de estreno / No exigible aún**;
- cuando TMDb publique fecha, vuelve a aplicar fecha + margen normal;
- validación read-only en Héroes de Guardia T2: 8 ausentes físicos, 0 exigibles, 0 pendientes España, 8 no exigibles aún;
- sin migraciones ni mutaciones de datos;
- Vercel Production no fue desplegado por el asistente;
- WKR-07 quedó **APROBADA y persistida**.

### CAMBIO FUNCIONAL INTERCALADO — Plex global: timeout 1000 s + retries inmediatos

El usuario pidió corregir la última ejecución fallida de `PROC-NOV-009`, que agotó el timeout mientras Plex estaba ocupado.

Estado:
- causa confirmada: revisión previa de identidades en `lib/plex-sync.js` conservaba un timeout único de 280.000 ms;
- última ejecución afectada: sección Plex 3 (Películas, ~10.982 títulos), fallo a ~280,9 s;
- el error era retryable, pero Batch aplicaba la espera global de 6 h / 24 h;
- rama funcional: `fix/plex-global-long-timeout-immediate-retries`;
- PR **#575** — **MERGEADA**;
- CI inicial #748 falló únicamente por un contrato de test aún fijado a 280 s; test actualizado;
- CI final **#749 — SUCCESS** incluido build;
- merge en `main`: `488779fe0a5eea0136bf0c8d75cbde8f1b98b667`;
- timeout de requests de `PROC-NOV-009`: **1000 s**;
- los 3 intentos Batch de `PROC-NOV-009` son consecutivos, sin backoff de 6 h / 24 h;
- la excepción no altera la política de retry del resto de procesos;
- sin migraciones ni mutaciones directas de datos;
- WKR-13 sigue **PENDIENTE DE DECISIÓN**.

### CAMBIO FUNCIONAL INTERCALADO — Novedades Plex: dedupe por rating key ya catalogado

Tras una sincronización Plex exitosa, `El retorno de D'Artacán` volvió a aparecer en Novedades aunque ya estaba catalogado como TMDb-only.

Causa confirmada:
- ficha canónica: `tt990049053057052052056`, TMDb `68370`, Plex rating key `159448`;
- Plex empezó a publicar además IMDb `tt0891408` para ese mismo rating key;
- NOV-008 sólo comprobaba si ese IMDb concreto existía en `movies`, por lo que creó candidato nuevo `tt0891408`;
- la barrera previa por TMDb-only no aplicaba porque el nuevo candidato ya llegaba como identidad IMDb normal.

Corrección:
- PR **#576** — **MERGEADA**;
- CI **#752 — SUCCESS**;
- merge en `main`: `6f9f4d512d277bd02b64638b0d4bb39486f9adc9`;
- NOV-008 excluye items Plex cuyo `rating_key` ya esté enlazado en `plex_catalog_status`;
- intake canónico Plex deduplica también por `rating_key`;
- Novedades oculta candidatos Plex antiguos cuyo rating key ya pertenezca al catálogo;
- NOV-007 impide admisión duplicada por rating key aunque exista candidato viejo;
- NOV-008 autocierra candidatos antiguos relacionados como `catalogued`, conservando trazabilidad;
- sin migraciones ni mutaciones directas manuales de Production;
- WKR-13 sigue **PENDIENTE DE DECISIÓN**.

### LIMPIEZA CONTROLADA — Upgrade de identidad TMDb-only a IMDb real · El retorno de D'Artacán

Tras el fix de dedupe por rating key, se autorizó una limpieza transaccional de Production para fusionar las dos fichas existentes del mismo título.

Canónica final:
- IMDb real: `tt0891408`;
- TMDb: `68370`;
- Plex rating key: `159448`;
- tipo: Serie;
- conserva ratings/PikoScore de la ficha real;
- conserva referencia oficial TMDb/TVDb y los 26 episodios de la ficha TMDb-only;
- créditos consolidados: 17;
- Plex enlazado una sola vez;
- lifecycle final: `TECH_PENDING`, coherente con 26 episodios pendientes de PikoQuality.

Ficha sintética retirada:
- antiguo ID técnico: `tt990049053057052052056`;
- eliminada de `movies` y dependencias operativas;
- sólo permanece un registro en `catalog_candidates` como trazabilidad, marcado `catalogued`, `deduplicatedTo=tt0891408` y `deduplicatedBy=identity_upgrade_real_imdb`;
- auditoría global de todas las tablas base con `imdb_id`: ningún otro residuo del ID sintético.

Resultado final validado en Neon:
- `movies` para TMDb 68370 = 1;
- ratings = 3;
- créditos = 17;
- series_reference = 1;
- episodios oficiales = 26;
- plex_link = 1;
- synthetic_movie = 0;
- lifecycle/read model = `TECH_PENDING`.

### CAMBIO FUNCIONAL INTERCALADO — Blindaje SER-001 + limpieza de rating keys obsoletos

Antes de ejecutar Calidad → Series → Actualizar Plex se hizo auditoría preventiva y se encontraron dos riesgos reales.

1. **Timeout/lease SER-001**:
- SER-001 conservaba 45/60/90 s para inventarios pesados;
- existía evidencia real de ejecución parcial por timeout y otra ejecución correcta de ~370 s;
- PR **#577** — MERGEADA;
- CI **#754 — SUCCESS**;
- main: `4e4469b9d9eabfb9fb424be3a432f4fc3d0bfa72`;
- inventarios pesados pasan a 1000 s por intento;
- requests pequeños mantienen 45/60/90 s;
- heartbeat periódico mantiene viva la lease durante requests largos;
- SER-001/SER-002 consumen 3 intentos seguidos sin backoff 6 h / 24 h.

2. **Referencias antiguas por cambio de Plex rating_key**:
- detectadas 3 referencias antiguas inactivas con reemplazo activo para el mismo IMDb:
  - Colegio Abbott: 136286 → 159286;
  - La maldición de Bly Manor: 148417 → 158814;
  - La maldición de Hill House: 156476 → 158802;
- limpieza de Production autorizada y ejecutada:
  - 3 series_reference;
  - 112 series_reference_episodes;
  - 112 series_diagnostics;
  - 8 series_season_availability;
  - 0 overrides manuales;
  - plex_items históricos se conservaron;
- tras limpieza: 0 stale refs con reemplazo activo;
- Hill House corrigió lifecycle SERIES_REVIEW → TECH_PENDING;
- Bly Manor TECH_PENDING;
- Colegio Abbott sigue SERIES_REVIEW por 85 faltantes reales.

Protección permanente:
- PR **#578** — MERGEADA;
- CI **#756 — SUCCESS**;
- main: `d2b6bceaa2645ab53297819ec16062473f14ab49`;
- SER-001 retira automáticamente una referencia vieja sólo si:
  - show viejo inactivo;
  - 0 episodios Plex activos bajo la clave vieja;
  - 0 overrides manuales;
  - plex_catalog_status apunta a otro rating_key;
  - el reemplazo está activo;
  - existe series_reference activa del mismo IMDb;
- recalcula lifecycle tras la limpieza;
- conserva plex_items históricos.

WKR-13 quedó APROBADA y persistida.

### CAMBIO FUNCIONAL INTERCALADO — Advertencia de capítulos con varios archivos físicos

El usuario pidió que Calidad → Series informe de **todos** los episodios que Plex agrupa con 2 o más archivos físicos, sin que PikoFilm filtre, clasifique ni decida cuál conservar.

Implementación:
- PR **#579** — MERGEADA;
- CI **#758 — SUCCESS**;
- main: `c582326e48ffb0e8469392f9f3e20b43d820daaf`;
- nueva zona `Advertencias de organización → Capítulos agrupados por Plex`;
- incluye todo episodio activo con `count(plex_files)>1`, sin filtrar por calidad, formato, tamaño, duración ni nombre;
- muestra serie, Txx Exx, título y todos los archivos físicos;
- por archivo muestra nombre, tamaño, duración y contenedor;
- paginación de 50 casos para proteger rendimiento;
- no ofrece borrado ni recomendación automática;
- sin migraciones ni mutaciones de datos.

Datos medidos al definirlo:
- 54.155 episodios activos, todos con fichero conocido;
- 54.793 archivos físicos;
- 508 episodios con 2+ archivos agrupados por Plex.

WKR-13 quedó APROBADA y persistida.

### CAMBIO FUNCIONAL INTERCALADO — Advertencia de series con nombres de archivo fuera de formato

El usuario pidió una segunda zona de organización en Calidad → Series para detectar **qué series** tienen episodios cuyos archivos no siguen la estructura esperada, sin mostrar el detalle capítulo a capítulo.

Formato esperado:
- `NOMBRE SERIE - 01x01 - NOMBRE CAPÍTULO.ext`.

Implementación:
- PR **#580** — MERGEADA;
- CI final **#763 — SUCCESS**;
- main: `2eb766622aa3639c646b012553cb67759e40c14e`;
- nueva advertencia `Series con nombres a revisar`;
- muestra **una única fila por serie**;
- no muestra capítulos ni nombres de fichero;
- muestra nº de archivos fuera de formato y nº total de archivos de episodios de la serie;
- ordena por mayor nº de archivos fuera de formato;
- paginación de 50 series;
- sin migraciones ni mutaciones de datos.

Datos medidos al definirlo:
- 247 series necesitan revisión;
- 5.931 archivos fuera de formato;
- 54.793 archivos físicos de episodios analizados.

WKR-13 quedó APROBADA y persistida.

### WKR-13 — Concurrencia gobernada por workload

**APROBADA.**

- La concurrencia efectiva se limita por proceso/workload, no sólo por slots físicos del worker.
- Cada workload puede declarar un techo inferior según Neon, Plex, APIs externas, CPU/memoria, duración, rate limits, recovery e interferencia.
- El runtime aplica backpressure y no libera cientos de items sólo porque exista capacidad física.
- Operaciones podrá mostrar capacidad física, límite efectivo, slots ocupados/disponibles y cola pendiente.
- No introduce autoscaling, réplicas nuevas ni ML; una réplica por servicio sigue siendo suficiente mientras los datos lo respalden.
- Invariante: la capacidad física nunca autoriza por sí sola una concurrencia insegura.

### ESTADO ACTUAL PUNTO 6

La Fase 2 queda **COMPLETADA**: WKR-01 a WKR-13 han sido revisadas individualmente, todas APROBADAS y persistidas.

### CAMBIO FUNCIONAL INTERCALADO — SER-001 reconcilia archivos físicos aunque Plex no cambie updatedAt

Incidente real:
- el usuario limpió duplicados físicos de American Horror Story y ejecutó `Actualizar Plex`;
- la serie seguía apareciendo en `Capítulos agrupados por Plex`;
- Production conservaba 4 snapshots antiguos: 4x10, 5x01, 5x07 y 5x12;
- los 132 episodios de la serie no habían sido re-leídos físicamente en la última SER-001;
- esos `plex_files` seguían con `synced_at` del 31/08;
- causa: SER-001 inventariaba los 54k+ episodios con `includeMedia=0` y sólo reconsultaba `Media/Part` para episodios cuyo metadata lógico/updatedAt cambiaba.

Corrección:
- PR **#581** — MERGEADA;
- CI final **#766 — SUCCESS**;
- main: `634cd04fda1a076b3d5ccd89ad1c42f585129078`;
- el inventario paginado de episodios usa `includeMedia=1`;
- compara `Media/Part` masivamente con `plex_files` por nombre, tamaño, duración, contenedor, índices y Plex part id;
- un cambio físico se reconcilia aunque `updatedAt` no cambie;
- reemplaza sólo `plex_media/plex_files` de episodios realmente distintos;
- llamada individual `/library/metadata/{episode}` queda como fallback sólo si Plex omite `Media`;
- nueva métrica `episode_files_changed`;
- sin migraciones ni mutación manual de datos.

Validación pendiente de ejecución real:
- tras Railway SUCCESS, el usuario debe volver a lanzar `Actualizar Plex`;
- comprobar que American Horror Story deja de mostrar esos 4 agrupados si Plex ya tiene un único archivo por episodio;
- comprobar también que disminuyen automáticamente las advertencias de nombres corregidos.

Fase 3 del Punto 6 sigue activa. INNO-WKR-01 está RECHAZADA y persistida. INNO-WKR-02 sigue pendiente de decisión.

### SIGUIENTE PASO EXACTO

Fase 3 — Road Map Innovador ACTIVA. **INNO-WKR-01, INNO-WKR-02 e INNO-WKR-03 están RECHAZADAS y persistidas**. Presentar **INNO-WKR-04** y mantener el mismo gate.

La rama `audit/v5-06-workers` ya fue sincronizada de forma segura con `main` tras el merge #569 y quedó 0 commits por detrás antes de persistir WKR-06.

Mantener el gate: no presentar WKR-08 hasta que WKR-07 quede APROBADA o RECHAZADA y persistida.

## Incidente Plex corregido durante Punto 6

- El 2026-09-19 una ejecución manual de `PROC-SER-001` terminó `partial` porque la lectura de la biblioteca Plex `Series` superó el timeout fijo de 45 s.
- Se confirmó el mismo patrón histórico el 2026-09-13: timeout prácticamente exacto a 45 s en `sync_library`.
- No fue una caída general de Railway/Neon/Plex: `PROC-NOV-009` y sincronizaciones individuales Plex funcionaban alrededor del mismo intervalo.
- PR #569 corrige el problema: reintentos de peticiones Series Plex con ventanas 45/60/90 s, heartbeat entre intentos y propagación del fallo transitorio como `retryable` en vez de convertirlo en `partial/no_change`.
- Tests específicos añadidos; CI #732 verde.
- PR #569 mergeada a `main` como `fed1ec0f40eef52b262785933ca97f48154e9625`.
- Railway Plex desplegó ese commit con estado SUCCESS y el worker arrancó con adapters `PROC-NOV-009`, `PROC-SER-001` y `PROC-SER-002`.
- No se ejecutó manualmente una nueva sincronización de producción sólo para probar el cambio.
- WKR-06 quedó posteriormente **APROBADA** y persistida; durante el incidente todavía estaba pendiente.

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
- Auditoría Punto 6: `docs/V5_AUDIT_06_WORKERS.md`
- Decisiones Punto 6: `docs/V5_DECISIONS_06_WORKERS.md`
- Innovaciones Punto 6: `docs/V5_INNOVATIONS_06_WORKERS.md`
- Punto de reentrada de chat: `docs/CURRENT_V5_HANDOFF.md`

El Punto 6 está activo en `audit/v5-06-workers`. Su Fase 1 está cerrada; continuar por Fase 2 y persistir cada decisión antes de presentar la siguiente.