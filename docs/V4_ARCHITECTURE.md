# PikoFilm V4 — Arquitectura canónica final

Estado: **FUENTE CANÓNICA DE ARQUITECTURA V4**  
Baseline documentado: `main` después del merge de PR #511 (`323b1cd4dd2cc8b5def081bc98ab094006df3efe`).  
Este documento sustituye como autoridad principal a `docs/architecture/SYSTEM_ARCHITECTURE.md`, `DATA_ARCHITECTURE.md`, `EXECUTION_ARCHITECTURE.md` y `OBSERVABILITY.md`. El código y la infraestructura viva siguen mandando ante cualquier discrepancia.

---

## 1. Objetivo de esta arquitectura

PikoFilm es una aplicación personal de gestión de catálogo audiovisual que separa de forma estricta cuatro responsabilidades:

1. **producto y control interactivo**;
2. **datos y estado compartido**;
3. **ejecución persistente de procesos**;
4. **excepciones controladas de ejecución externa**.

La arquitectura está diseñada para que una operación funcional tenga **una sola receta canónica**, independientemente de que se lance manualmente, desde un Batch, desde el planificador o como continuación de Lifecycle.

La regla estructural más importante es:

```text
individual -> process_run -> operación canónica X
Batch      -> cola/lease -> child process_run -> operación canónica X
```

Batch, Railway, cron y las acciones manuales pueden cambiar el **modo de orquestación**, nunca la receta funcional. Una intención individual que pueda superar la ventana HTTP puede materializarse como Batch durable de una sola entidad: Vercel valida/encola y Railway ejecuta el mismo core canónico.

---

## 2. Topología física

```text
                         +------------------------+
                         |        Usuario         |
                         +-----------+------------+
                                     |
                                     v
                         +------------------------+
                         |  Vercel / Next.js      |
                         |  UI + control plane    |
                         +-----+-------------+----+
                               |             |
                   reads/writes|             | llamadas ligeras / dispatch
                               v             v
                    +----------------+   +--------------------+
                    | Neon Postgres  |   | APIs / servicios   |
                    | data/state     |   | externos           |
                    +-------+--------+   +--------------------+
                            ^
                            |
                  coordinación compartida
                            |
          +-----------------+-------------------+
          |                 |                   |
          v                 v                   v
 +----------------+ +----------------+ +--------------------+
 | Railway API    | | Railway FAST   | | Railway Plex /     |
 | worker         | | worker         | | Technical worker   |
 +----------------+ +----------------+ +--------------------+

 Excepción explícita:
 Vercel -> GitHub Actions -> Discovery IMDb (PROC-NOV-001)
```

### 2.1 Vercel / Next.js — interfaz y plano de control

Responsabilidades:

- render de la aplicación y navegación;
- Server Components y Server Actions;
- lectura de Neon para las superficies de producto;
- acciones manuales e individuales compatibles con el tiempo de request;
- creación de `process_runs` cuando Vercel es quien inicia el trabajo;
- creación y control de Batch;
- acciones de pausa/reanudación/cancelación;
- configuración administrativa segura;
- dispatch a Railway o GitHub Actions cuando el trabajo no debe vivir dentro del request;
- crons ligeros de coordinación (`activity-planner`, snapshot del dashboard).

Vercel **no es un worker de larga duración**. No debe alojar loops persistentes, barridos extensos ni polling Plex. Una acción manual pesada puede conservar UX individual y responder tras encolar una unidad durable en Railway.

### 2.2 Neon PostgreSQL — plano de datos y estado

Neon es el punto de coordinación común entre la UI y todos los executors. Aloja:

- datos editoriales canónicos;
- identidad externa;
- relaciones normalizadas;
- Lifecycle;
- read models;
- estado físico persistido derivado de Plex;
- ratings y PikoScore;
- PikoQuality y snapshots técnicos;
- Personas y filmografía;
- Sagas y miembros;
- Novedades/candidatos/exclusiones;
- observabilidad de procesos;
- estado operativo Batch;
- gobierno de APIs;
- intención futura del planificador.

Neon no es sólo almacenamiento: es **data plane + state plane + coordinación**.

### 2.3 Railway — plano de ejecución persistente

Los servicios Railway existen por responsabilidad, no por su nombre histórico:

- **API worker**: procesos con llamadas externas gobernadas, pool `api`;
- **FAST worker**: tareas rápidas/CPU/SQL sin dependencia principal de fuente gobernada, pool `fast`;
- **Plex worker**: trabajos centrados en Plex, pool `plex`;
- **Technical Snapshot worker**: captura técnica persistente de PikoQuality.

Un worker Railway:

- reclama trabajo persistido;
- mantiene lease/heartbeat cuando aplica;
- ejecuta el core canónico correspondiente;
- actualiza observabilidad y estado Batch;
- libera o reintenta el item según la política vigente.

La configuración viva del servicio también forma parte de la arquitectura: el `startCommand` debe arrancar el worker canónico sin SQL de reparación oculto; el servicio debe seguir `main` y evitar drift de commits. Cuando la integración lo permita, auto-deploy y `Wait for CI` deben mantener el runtime alineado con el código validado.

Antes de desbloquear un productor automático que despache a Railway —especialmente `PROC-PLAN-002`— se verifica que los pools consumidores implicados ejecutan el `main` esperado.

### 2.4 GitHub Actions — excepción controlada

GitHub Actions no es el motor general de PikoFilm. El caso canónico es `PROC-NOV-001` (Discovery IMDb):

- inicio manual;
- Vercel crea/relaciona la observabilidad;
- el workflow recibe el `run_id` canónico;
- la ejecución es explícita y acotada.

No se debe trasladar Batch o Lifecycle general a GitHub Actions sin una decisión arquitectónica nueva.

---

## 3. Estructura lógica por capas

```text
UI / rutas Next.js
        |
        v
Server Actions / starters / consultas
        |
        +-----------> observabilidad (process_runs)
        |
        v
wrapper unitario / starter Batch
        |
        v
operación canónica de dominio
        |
        +--> datos canónicos
        +--> Lifecycle
        +--> read models
        +--> eventos / errores
        +--> llamadas externas gobernadas
```

Se evita introducir una capa paralela por pantalla. La UI consume datos canónicos o read models; no crea una segunda lógica de negocio.

---

## 4. Clasificación de persistencia

Toda estructura persistente debe poder clasificarse en una de estas categorías:

| Categoría | Significado | Regla |
|---|---|---|
| CANÓNICA | Fuente de verdad funcional | Se escribe sólo desde operaciones autorizadas |
| READ MODEL | Derivado para lectura eficiente | Regenerable o reconciliable; no debe recibir decisiones funcionales |
| OPERATIVA | Estado necesario para ejecución | Batch, leases, límites, scheduler, etc. |
| OBSERVABILIDAD | Evidencia de qué se ejecutó | `process_runs`, eventos, errores |
| COMPATIBILIDAD | Estructura todavía consumida pero no objetivo | No eliminar sin consumer sweep |
| REGENERABLE | Cache/snapshot reconstruible | Puede purgarse sólo con contrato explícito |
| LEGACY | Sin consumidores vivos demostrados | Eliminación sólo tras auditoría |
| UNKNOWN | Uso no demostrado | **Bloquea eliminación** |

Nunca se decide que algo es legacy por el nombre, sufijo de versión o antigüedad aparente.

---

## 5. Modelos de datos canónicos principales

Esta sección define la responsabilidad, no pretende ser un dump del esquema SQL.

### 5.1 Catálogo editorial

`movies` y relaciones asociadas representan la obra admitida en PikoFilm. La existencia editorial en PikoFilm **no depende** de que exista actualmente un archivo en Plex.

Propiedades del dominio:

- IMDb es el identificador principal de obra en los flujos de catálogo;
- TMDb y otros IDs son identidad externa asociada;
- tipo película/serie forma parte del estado editorial validado;
- título, original, año/estreno, duración, países y géneros se normalizan para producto;
- las exclusiones bloquean readmisiones silenciosas;
- correcciones manuales tienen precedencia cuando se ha definido un override explícito.

### 5.2 Ratings y PikoScore

`title_ratings` contiene ratings externos normalizados. PikoScore 3:

- se calcula desde datos persistidos;
- no hace llamadas externas durante el cálculo puro;
- sólo se recalcula cuando cambian sus inputs o el Lifecycle lo necesita;
- es distinto de PikoQuality.

### 5.3 Plex y realidad física

Plex es fuente de verdad para presencia física/reproducción. PikoFilm persiste la información necesaria para:

- saber si una obra está o no físicamente presente;
- conocer archivos/episodios asociados;
- detectar desapariciones/cambios;
- calcular fingerprints técnicos;
- validar películas y series.

Una desaparición de Plex cambia estado físico (`missing`, `active=false`, etc.) pero **no elimina la obra editorial**.

### 5.4 Series

El dominio mantiene, según corresponda:

- referencia TMDb de serie/temporada/episodios;
- estado de confianza y vigencia de la referencia;
- información Plex de episodios/archivos;
- disponibilidad España por temporada/episodio;
- overrides manuales;
- diagnósticos de missing/unmapped/combinados;
- read model para listado y ficha de Calidad.

### 5.5 Personas

`person_refresh_state`, `person_filmography` y estructuras asociadas representan estado funcional de Personas, no trazas de ejecución. La receta canónica es `PROC-PER-001`.

### 5.6 Sagas

`saga_collections` y `saga_collection_members` representan el universo persistido de colecciones TMDb y su cruce con catálogo/Plex. El render normal nunca llama a TMDb.

### 5.7 PikoQuality

`piko_quality` y `piko_quality_aggregates` contienen estado/read model funcional de calidad técnica. El fingerprint técnico determina vigencia. Los cálculos globales no sustituyen la verdad física de Plex.

### 5.8 Novedades

El dominio de Novedades mantiene un candidato único por IMDb y múltiples evidencias/orígenes. Principio:

```text
1 IMDb -> 1 candidato -> N evidencias -> 1 decisión editorial
```

La admisión/exclusión es decisión humana. Los orígenes no crean pipelines separados.

---

## 6. Lifecycle

Lifecycle es **estado funcional derivado**, no executor ni log.

Flujo conceptual:

```text
Novedades
 -> identidad
 -> validación de identidad
 -> datos
 -> ratings
 -> PikoScore
 -> realidad física Plex (si aplica)
 -> validación física de película / reconciliación de serie
 -> PikoQuality (si aplica)
 -> COMPLETE
```

Invariantes:

1. avanzar significa resolver la condición bloqueante, no ocultarla;
2. decisiones humanas no se absorben en Batch automático;
3. cambios de evidencia externa pueden reabrir trabajo;
4. el estado se recalcula desde fuentes canónicas;
5. `process_runs` explica **qué se ejecutó**; Lifecycle explica **cómo quedó funcionalmente la entidad**;
6. no existe una segunda máquina de estados por pantalla.

La implementación exacta proceso por proceso vive en `docs/processes/PROCESS_CATALOG.md` y el código.

---

## 7. Modelo canónico de procesos

Cada proceso funcional tiene:

- `process_code` estable;
- propósito funcional;
- tipo (`individual`, `batch`, `global`, `manual`, especial);
- entidad/alcance;
- wrapper/starter;
- core canónico;
- executor;
- fuentes externas;
- lecturas/escrituras;
- impacto Lifecycle;
- observabilidad;
- retry/idempotencia;
- paridad individual/Batch cuando aplica.

### 7.1 Familias vigentes

- `PROC-ID-*`: identidad;
- `PROC-IV-*`: validación de identidad;
- `PROC-DATA-*`: datos/ratings/PikoScore;
- `PROC-MOV-*`: validación física de películas;
- `PROC-SER-*`: Series;
- `PROC-NOV-*`: Novedades/Plex/admisión;
- `PROC-SAGA-*`: Sagas;
- `PROC-PER-*`: Personas;
- `PROC-PQ-*`: PikoQuality;
- `PROC-HOME-*`: snapshots del dashboard;
- `PROC-PLAN-*`: planificación funcional;
- `PROC-OPS-*`: intervención de Operaciones.

### 7.2 Paridad

Estados de paridad:

- **EXACTA**: mismo core y misma semántica;
- **PARCIAL controlada**: mismo core con guards/postprocesado deliberadamente distintos;
- **SIN BATCH**: operación global/unitaria sin motor Batch;
- **NO APLICA**: decisión humana no masificable;
- **MODELO ESPECIAL**: ejecución persistente fuera del Batch común;
- **RETIRADO**: proceso fuera del sistema vivo.

No se permite una segunda receta funcional dentro del worker.

---

## 8. Batch Engine común

### 8.1 Estado persistido

- `batch_run_control`: control del Batch padre;
- `batch_run_items`: unidades persistentes;
- `batch_engine_control`: estado/protecciones globales;
- `process_runs`: observabilidad padre/hijos.

### 8.2 Ciclo de un Batch

```text
starter
  -> crea/reutiliza parent process_run
  -> crea batch_run_control
  -> materializa batch_run_items
  -> worker reclama item
  -> lease + heartbeat
  -> crea child process_run por intento
  -> ejecuta core canónico
  -> succeeded / retry / failed
  -> agrega estado del Batch
  -> terminaliza parent
```

### 8.3 Pools

- `api`: procesos gobernados por APIs externas;
- `fast`: procesos rápidos/CPU/DB;
- `plex`: procesos Plex.

Technical Snapshot y `PROC-PQ-001` conservan modelos especializados.

SER-002 usa además el Batch común como frontera durable para el control manual individual: la UI puede materializar un único `ratingKey` explícito en el pool `plex`, sin ejecutar el core pesado dentro del request de Vercel.

### 8.4 Reglas de seguridad

- un solo Batch activo por proceso cuando así lo define su starter;
- ningún Batch puede ejecutar decisiones humanas;
- los hijos representan intentos reales, no filas ficticias precargadas;
- pause/resume/cancel son estados operativos fuera de la semántica funcional del core;
- leases permiten recuperación tras caída del worker;
- reintentos son acotados y espaciados;
- la concurrencia interna no evita los límites de fuente.

---

## 9. Gobierno de APIs externas

Fuentes gobernadas actualmente: **TMDb, OMDb y MDBList**.

### 9.1 Configuración

`batch_api_source_limits` y estructuras relacionadas mantienen parámetros persistidos. Para cada fuente se distingue:

- valor configurado;
- hard cap del código;
- valor efectivo aplicado;
- cuota/día cuando exista;
- reparto Batch/manual;
- circuit breaker;
- `blocked_until`;
- uso reciente y errores/rate limits.

### 9.2 Fail-closed

Principio permanente:

> Una fuente gobernada no puede consultarse sin gobernanza.

Los cores que usan TMDb/OMDb/MDBList requieren `apiGate`. Si falta:

- se lanza error de programación antes del `fetch`;
- el error identifica `processStep='api_governance'` / `apiGateReason`;
- no existe fallback implícito a una llamada directa.

Cada llamada externa adquiere un permiso independiente. Un pool interno de 8 hilos, por ejemplo, no autoriza 8 llamadas simultáneas si el límite efectivo es menor.

### 9.3 Manual y Batch

Manual y Batch usan la misma persistencia y el mismo gate. La única diferencia legítima es la `lane`/prioridad configurada.

### 9.4 Watchmode

Watchmode no forma parte automáticamente del conjunto anterior. Si en el futuro debe gobernarse desde Operaciones, requiere decisión y contrato explícitos.

---

## 10. Observabilidad

### 10.1 Fuente canónica

- `process_runs` — ejecución padre/individual/global;
- `process_run_events` — pasos/eventos significativos;
- `process_run_errors` — errores técnicos asociados.

No se crea un segundo sistema de tracing para Actividad, Calidad o cada vertical.

### 10.2 Campos conceptuales de `process_runs`

Una ejecución puede expresar:

- `run_id`;
- `process_code`;
- `run_kind`;
- `trigger_source`;
- `executor`;
- `entity_type` / `entity_id`;
- `parent_run_id`;
- `correlation_key`;
- `idempotency_key`;
- estado técnico (`queued`, `running`, `succeeded`, `partial`, `failed`, `cancelled`);
- resultado funcional (`updated`, `no_change`, `pending`, `blocked`, `not_found`, `invalid`, etc.);
- tiempos/duración;
- contadores, métricas, contexto;
- before/after compacto cuando aporta valor.

### 10.3 Errores vs incidencias activas

`process_run_errors` conserva el hecho histórico. Operaciones calcula/representa si el problema sigue activo:

- error sin éxito posterior equivalente -> incidencia activa;
- éxito posterior mismo proceso/alcance -> autorresuelta;
- resolución manual -> deja de requerir atención, sin borrar el error;
- recurrencia posterior -> nueva incidencia activa.

### 10.4 Actividad y Operaciones

Son dos vistas hermanas:

```text
mismo process_run / correlación
        |
        +--> Actividad: qué hizo PikoFilm y qué resultado tuvo
        |
        +--> Operaciones: cómo se ejecutó técnicamente y qué estado operativo dejó
```

---

## 11. Retención

Ventana detallada V4: **30 días** para Actividad y Operaciones.

La purga coordinada puede eliminar detalle histórico sólo si preserva:

- ejecuciones `queued/running`;
- Batch activos/pausados/retryable;
- items con lease, retry o reconciliación pendiente;
- integridad de parents/children;
- estado funcional actual;
- estado operativo vigente;
- agregados/snapshots necesarios.

La retención no autoriza borrar datos funcionales por tener más de 30 días. La purga terminal canónica forma parte del ciclo horario de PLAN-002; por tanto la salud del cron también es salud de retención.

---

## 12. Planificador de Actividad

### 12.1 Persistencia

`process_plans` representa **intención futura**, no ejecución ni log.

Puede almacenar/derivar:

- proceso previsto;
- volumen/alcance;
- ventana funcional segura;
- fecha/franja planificada;
- prioridad;
- lock manual;
- pico deliberado;
- relación con run real una vez ejecutado;
- estado `pendiente de planificar`, `planificado`, `retrasado`, etc.

### 12.2 Planner

`PROC-PLAN-002` corre desde Vercel Cron con cadencia horaria y:

1. reconcilia demanda conocida;
2. estima carga desde comportamiento reciente;
3. distribuye trabajo flexible dentro de su ventana segura;
4. detecta/replanifica retrasos seguros;
5. respeta prioridad, locks y picos deliberados;
6. lanza sólo starters canónicos autorizados.

El middleware privado permite explícitamente que la ruta cron alcance su autenticación propia. La ruta exige `CRON_SECRET` de forma fail-closed. Actividad considera sano el planificador sólo si existe un PLAN-002 `succeeded|running` reciente; una configuración estática no basta para afirmar “activo”.

### 12.3 Lista inicial de trabajo autoplanificable

El planificador puede orquestar únicamente procesos declarados seguros, entre ellos:

- MOV-001;
- SER-002 como continuación de invalidaciones detectadas;
- SER-003;
- SER-004;
- DATA-002;
- PER-001;
- PQ-001.

**El sync Plex global permanece manual y nunca se añade al planner.**

---

## 13. Automatización y cron

### 13.1 Cron de planificación

`/api/cron/activity-planner` ejecuta coordinación horaria y mantenimiento asociado (incluida retención cuando corresponda). No debe convertirse en un worker pesado. El middleware sólo abre el paso a la ruta; la autorización real sigue siendo `CRON_SECRET` fail-closed dentro del endpoint.

### 13.2 Snapshot de dashboard

`PROC-HOME-001`, mediante `/api/cron/dashboard-snapshot`, captura agregados históricos de dashboard/almacenamiento. Es una excepción automática pasiva y comparte el mismo helper de autenticación fail-closed.

### 13.3 Plex

No existe polling Plex programado. El disparador global es humano:

```text
usuario -> Sincronizar Plex -> PROC-NOV-009
```

Tras ese disparo, las consecuencias derivadas sí pueden automatizarse.

---

## 14. Flujos de referencia

### 14.1 Admisión de una obra

```text
origen manual/Plex/Discovery/Saga/Persona
  -> candidato Novedades
  -> preparación de mínimos
  -> usuario pulsa Añadir
  -> PROC-NOV-007
  -> título entra en catálogo
  -> continuación Lifecycle durable
  -> procesos canónicos necesarios
  -> completo / revisión humana / bloqueo / error
```

### 14.2 Sync Plex

```text
usuario pulsa Sincronizar Plex
  -> PROC-NOV-009
  -> snapshot/diff Plex
  -> PROC-NOV-008 si aparecen candidatos
  -> invalidaciones físicas
  -> MOV-001 / SER-002 según tipo y evidencia
  -> Series/PikoQuality downstream según necesidad
```

No hay segundo click obligatorio por cada entidad afectada.

### 14.3 Ratings

```text
planner/manual
  -> DATA-002
  -> API gate
  -> MDBList/OMDb/TMDb según cascada canónica
  -> persiste ratings
  -> si inputs cambiaron o hace falta -> DATA-003
```

### 14.4 Series

```text
Plex cambia -> SER-002 automático en Railway Plex
usuario fuerza detalle -> Vercel encola SER-002 dirigido -> Railway Plex
TMDb vence -> SER-003
Disponibilidad UNKNOWN vencida -> SER-004
anomalía ambigua -> SER-005 / decisión humana
volver a automático -> SER-006
```

SER-002 manual no mantiene abierto el request durante la lectura completa de Plex; la intención es individual, la ejecución es durable y comparte `syncPlexSeriesDetailCore` con el camino Batch.

### 14.5 Persona

```text
abrir persona -> sólo lectura
refresco manual/planner Batch -> PER-001
  -> TMDb gobernado
  -> perfil + filmografía persistida
```

### 14.6 Operaciones: resolver incidencia

```text
error histórico
  -> Operaciones calcula incidencia activa
  -> éxito posterior equivalente => autorresuelta
  OR
  -> usuario descarta/resuelve => PROC-OPS-002
  -> error original permanece consultable
```

---

## 15. Separación de superficies y responsabilidades

| Superficie | Pregunta que responde | No debe hacer |
|---|---|---|
| Inicio | ¿Cómo está PikoFilm a alto nivel? | Resolver incidencias técnicas |
| Catálogo | ¿Qué obras forman parte de PikoFilm? | Mostrar pipeline/Lifecycle |
| Ficha | ¿Qué sabemos de esta obra? | Ser consola operativa |
| Novedades | ¿Qué títulos esperan decisión de admisión? | Mostrar trabajo ya resuelto |
| Calidad | ¿Qué necesita atención funcional? | Mostrar stacks/workers |
| Personas | ¿Qué personas/filmografías son relevantes? | Refrescar al navegar |
| Sagas | ¿Qué compone la colección y qué está físicamente disponible? | Inferir visionado |
| Actividad | ¿Qué hizo PikoFilm y qué resultado tuvo? | Ser log técnico |
| Operaciones | ¿Cómo se ejecutó y qué requiere intervención técnica? | Ser feed funcional |

---

## 16. Seguridad e invariantes operativas

1. **No secretos** en código, docs, issues ni logs.
2. **UNKNOWN bloquea delete** en limpiezas estructurales.
3. **Vercel producción la despliega el usuario**; los agentes no hacen deploy automático.
4. **Plex global manual**; no introducir polling.
5. **API governance fail-closed** para fuentes declaradas gobernadas.
6. **No reset global** de PikoFilm.
7. **Recuperación contextual**: sólo acciones válidas para el estado real.
8. **Idempotencia** en starters/acciones que puedan recibir doble click/reintento.
9. **Decisiones humanas protegidas** frente a automatización silenciosa.
10. **Batch no decide editorialmente**.
11. **No borrar historia para “resolver” una incidencia**; se cambia su estado operativo, no el hecho original.
12. **Read models no son fuente de verdad**.
13. **Cron fail-closed**: una ruta cron puede atravesar el middleware, pero sin `CRON_SECRET` válido no ejecuta trabajo.
14. **Config Railway versionable**: no se incrusta lógica de reparación/mutación en `startCommand` fuera de Git.
15. **Paridad de commit antes de automatizar**: un productor automático no se habilita si su worker consumidor está conocido como desactualizado.

---

## 17. Rendimiento y coste

Principios permanentes:

- filtrar/agregar en PostgreSQL cuando sea razonable;
- paginación de listados grandes;
- evitar `SELECT *` en caminos críticos;
- hidratar detalle sólo para la página visible;
- navegación interna sin prefetch masivo (`NoPrefetchLink`);
- búsquedas globales textuales esperan al menos 3 caracteres, manteniendo accesos exactos por identificador;
- acotar candidatos antes de joins/`EXISTS` caros en búsquedas interactivas;
- no llamar APIs externas durante render normal de Catálogo, Personas o Sagas;
- usar read models persistidos cuando el coste de recomputación por request sea alto;
- retener observabilidad detallada sólo 30 días;
- progresar deuda histórica de forma gradual;
- evitar fanout en apertura de páginas;
- índices sólo con un caso de consulta demostrado.

CI protege específicamente navegación sin prefetch masivo y lectura acotada de Personas.

Las lambdas Python históricas `api/fa-search.py` y `api/fa-evidence.py` se retiraron tras consumer sweep: dependían de `batch_jobs`, relación V1 ya eliminada, y no tenían consumidores V4. Sus dependencias Python dejaron de formar parte del runtime Vercel.

---

## 18. Deployment y CI

### 18.1 CI principal

El workflow valida, como mínimo:

- sintaxis de workers canónicos;
- self-check de PikoScore 3;
- suite `test:quality` con contratos de todas las verticales V4;
- navegación sin prefetch masivo;
- rendimiento/lectura acotada de Personas;
- `next build` con `DATABASE_URL` placeholder.

CI corre en PR y también sobre cada `push` integrado en `main`. Una PR no debe mergearse si falla cualquiera de estas barreras. El run posterior a merge permite además que Railway use `Wait for CI` cuando esa opción esté habilitada.

### 18.2 Producción

Flujo operativo:

```text
branch -> PR -> CI verde -> merge main -> alinear/verificar Railway -> usuario despliega Vercel -> validación funcional/visual
```

Railway/Neon sólo se modifican cuando el cambio realmente lo requiere y deben conservarse las fronteras físicas descritas aquí. Antes del deploy de Vercel que desbloquee PLAN-002 se confirma especialmente que el worker API no arrastra un commit anterior.

La protección de `main` y required checks debe mantenerse activa cuando GitHub/plan/permisos lo permitan. Si no está disponible, la regla operativa rama -> PR -> CI -> merge sigue siendo obligatoria y no se sustituye por push directo.

---

## 19. Reglas para cambios futuros

Antes de introducir o modificar un proceso:

1. identificar el `PROC` o decidir explícitamente uno nuevo;
2. definir/confirmar operación canónica;
3. identificar trigger y executor;
4. enumerar fuentes y gobernanza;
5. enumerar lecturas/escrituras;
6. definir efecto Lifecycle;
7. definir observabilidad y resultado funcional;
8. definir error/retry/idempotencia;
9. si existe Batch, demostrar que usa el mismo core;
10. revisar retención/impacto operacional;
11. actualizar tests de contrato;
12. actualizar esta arquitectura si cambia una frontera o invariante;
13. actualizar `PROCESS_CATALOG.md` si cambia la receta/ejecución concreta.

Antes de eliminar una tabla, módulo, servicio o ruta:

1. search de readers/writers/imports;
2. verificación en código vivo e infraestructura;
3. clasificar CANÓNICA/READ MODEL/COMPATIBILIDAD/LEGACY/UNKNOWN;
4. si UNKNOWN, detener la eliminación;
5. migración explícita si afecta Neon;
6. smoke/CI;
7. documentación en el mismo bloque.

---

## 20. Documentos especializados que siguen vigentes

Este documento es la autoridad arquitectónica global. Para detalle ejecutable se mantienen:

- `docs/processes/PROCESS_CATALOG.md` — inventario PROC y entrypoints vivos;
- `docs/processes/BATCH_ARCHITECTURE.md` — mecánica específica del Batch Engine;
- `docs/operations/RUNBOOK.md` — procedimientos operativos;
- `docs/V4_FUNCTIONAL_SPEC.md` — contrato funcional consolidado;
- `docs/V4_UX_SPEC.md` — contrato UX consolidado;
- `docs/PROJECT_RULES.md` y `docs/AI_DEVELOPMENT_GUIDE.md` — reglas de desarrollo.

Los documentos anteriores de arquitectura V3/PRE-V4 y contratos V4 por vertical quedan sustituidos por esta tríada consolidada y permanecen recuperables en el historial Git.