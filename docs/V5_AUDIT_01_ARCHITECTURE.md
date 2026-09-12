# PikoFilm V5 — Auditoría 01: Arquitectura general

Fecha: 2026-09-13  
Estado: **AUDITORÍA COMPLETADA — PROPUESTAS PENDIENTES DE DECISIÓN**  
Base auditada: `main` en `d260272c56750d367c673d5239de97e232849fb3`, contrastada después con el estado vivo de producción.

## 1. Objetivo

Auditar la arquitectura real de PikoFilm antes de definir V5, comprobando el sistema vivo y no sólo la documentación. El alcance de este bloque es:

- separación Vercel / Railway / Neon / GitHub Actions;
- responsabilidades reales de cada plano;
- límites entre trabajo síncrono y asíncrono;
- ejecución individual, Batch y continuaciones;
- acoplamientos entre componentes;
- coordinación durable;
- identidad del executor y trazabilidad entre planos;
- configuración y despliegue de servicios;
- riesgos de fallo parcial y version skew.

Quedan fuera de esta auditoría, salvo cuando afectan directamente a una frontera arquitectónica, el análisis exhaustivo de rendimiento, coste, seguridad, UX, calidad de datos y política detallada de reintentos; esos asuntos tienen bloques propios posteriores.

## 2. Fuentes verificadas

La auditoría ha contrastado:

- `docs/V4_ARCHITECTURE.md`;
- `docs/processes/PROCESS_CATALOG.md`;
- `docs/processes/BATCH_ARCHITECTURE.md`;
- `vercel.json`;
- configuración Railway del repositorio y configuración efectiva de los cuatro servicios de producción;
- workers `batch-api`, `batch-fast`, `batch-plex` y técnico;
- `lib/process-runtime.js`, `lib/batch-worker-runtime.mjs`, `lib/process-worker-runtime.mjs`;
- `app/novedades/plex-actions.js` y `lib/plex-sync.js`;
- `lib/lifecycle-continuation.js`;
- workflows GitHub Actions relevantes;
- despliegues vivos de Vercel y Railway;
- `process_runs` reciente en Neon y relación entre `executor`, `worker_pool`, padres e hijos Batch.

No se ha modificado producción ni datos de Neon durante esta auditoría.

## 3. Topología real actual

### 3.1 Vercel — producto y control interactivo

La separación conceptual de V4 es buena: Vercel sirve la interfaz, Server Actions, endpoints de cron y acciones de control. La arquitectura documentada declara explícitamente que Vercel no debe actuar como worker de larga duración.

En la práctica la mayor parte del sistema respeta ese límite, pero existe una excepción importante: `PROC-NOV-009` (sincronización global de Plex) sigue ejecutando trabajo de red y persistencia directamente dentro de una Server Action de Vercel. Actualmente se protege con un deadline de 280 s para terminar antes del hard timeout de 300 s, lo que evita dejar el run indefinidamente abierto, pero no elimina la contradicción arquitectónica.

La incidencia reciente de 504 demostró que esta frontera no es teórica: el proceso llegó al límite físico de Vercel y dejó un run incoherente hasta que se añadió recuperación stale.

### 3.2 Neon — data plane, state plane y coordinación

Neon es simultáneamente:

- base de datos de producto;
- estado de ejecución (`process_runs`, eventos, errores);
- cola durable Batch (`batch_run_items`, leases y control);
- coordinación entre Vercel y Railway;
- read models y estado operativo.

Esta elección es coherente con el tamaño actual del producto y evita introducir Kafka/Redis/SQS sólo por arquitectura. El motor Batch utiliza lease, recuperación de leases expiradas y `FOR UPDATE SKIP LOCKED`, lo que proporciona una base durable razonablemente sólida.

En el snapshot de esta auditoría no había ejecuciones `queued/running` sin finalizar, por lo que no hay señal de una cola viva bloqueada.

### 3.3 Railway — ejecución persistente

Los cuatro servicios productivos están activos y con despliegue `SUCCESS`:

- API worker;
- FAST worker;
- Plex worker;
- Technical Snapshot worker.

Los pools `api`, `fast` y `plex` separan correctamente trabajo por características de latencia y dependencia externa. La topología es más sana que un único worker monolítico.

No obstante, la implementación del worker Plex revela un fallo de frontera: utiliza `executeClaimedItem(...)` sin indicar su executor. El runtime Batch tiene como valor por defecto `railway_batch_fast`, de modo que los hijos realmente ejecutados por el pool Plex pueden persistirse como si fueran FAST.

Neon confirma el efecto real: en las últimas 24 h aparecieron 102 ejecuciones `PROC-SER-002` con `worker_pool='plex'` pero `executor='railway_batch_fast'`. No es sólo nomenclatura: la capa de observabilidad está perdiendo la verdad sobre dónde se ejecutó el trabajo.

### 3.4 GitHub Actions — excepción controlada

El uso actual de GitHub Actions está bastante acotado:

- `PROC-NOV-001` discovery IMDb es una excepción explícita y observable;
- `manual-maintenance.yml` sólo ofrece comprobaciones manuales de sólo lectura y acotadas;
- CI queda separado de la ejecución ordinaria del producto.

No se ha detectado que GitHub Actions se esté convirtiendo en un segundo motor Batch general, lo cual es positivo.

## 4. Hallazgos detallados

### ARCH-001 — `PROC-NOV-009` viola la frontera Vercel/control-plane

**Severidad:** alta.  
**Tipo:** arquitectura / resiliencia.

`syncPlexFromNews` abre el `process_run` con `executor='vercel'` y espera a `syncPlexFast(...)` mediante `Promise.race` con un deadline de 280 s. `syncPlexFast` no es una operación pequeña: consulta Plex, compara identidades, persiste cambios, invalida Series, recalcula cambios físicos y dispara continuaciones.

El guard de 280 s es una protección correcta para V4, pero sigue siendo una adaptación al límite de la plataforma. Una caída del request, cold restart o límite externo sigue pudiendo interrumpir el flujo en mitad de su trabajo.

**Conclusión:** V5 debería conservar Vercel como iniciador/control y mover la ejecución real a un executor durable.

### ARCH-002 — La capa de ejecución observada está duplicada en tres runtimes

**Severidad:** alta.  
**Tipo:** consistencia arquitectónica.

Actualmente existen al menos tres implementaciones del envelope de ejecución:

1. `lib/process-runtime.js` para Server/Vercel;
2. `lib/batch-worker-runtime.mjs` para hijos Batch;
3. `lib/process-worker-runtime.mjs` para el worker técnico.

Las tres crean/actualizan runs, eventos, errores, heartbeats y cierres con implementaciones distintas. El sistema mantiene una semántica parecida, pero no existe una única capa neutral que garantice que `executor`, errores, métricas y cierre sean equivalentes.

El bug de executor del pool Plex es una prueba concreta del riesgo de deriva, no una posibilidad hipotética.

### ARCH-003 — La identidad del executor no es una invariante fiable

**Severidad:** alta.  
**Tipo:** trazabilidad / arquitectura.

`executeClaimedItem` asume por defecto `executor='railway_batch_fast'`. FAST funciona por casualidad con ese default; API lo sobreescribe explícitamente; Plex no lo hace.

Esto permite estados contradictorios: `worker_pool='plex'` junto a `executor='railway_batch_fast'`.

**Conclusión:** la identidad del executor debe derivarse del worker/pool o ser obligatoria, nunca un default silencioso.

### ARCH-004 — `PROC-LC-001` existe en producción pero no en el catálogo canónico de procesos

**Severidad:** alta para mantenibilidad/gobierno.

`lib/lifecycle-continuation.js` crea runs `PROC-LC-001` y el API worker tiene lógica para ejecutarlos. Neon registra ejecuciones reales de este proceso. Sin embargo, el `PROCESS_CATALOG` auditado no lo declara como proceso canónico.

Esto rompe una propiedad esencial: no se puede reconstruir toda la arquitectura ejecutable desde su catálogo oficial.

### ARCH-005 — La orquestación de Lifecycle vive dentro del adapter del API worker

**Severidad:** media-alta.

El API worker no se limita a adaptar cola → operación canónica. Para Lifecycle Continuation contiene la receta que decide qué procesos ejecutar y en qué secuencia, con gates intermedios.

Esa lógica es negocio/orquestación, no infraestructura de worker. Si mañana se necesitara ejecutar la misma continuación desde otro executor, la receta quedaría ligada al worker actual o habría que copiarla.

### ARCH-006 — Fan-out posterior a Plex no es una transición durable única

**Severidad:** alta.  
**Tipo:** atomicidad lógica / recuperación.

Después de la sincronización Plex, `syncPlexFast` puede:

- lanzar MOV-001;
- lanzar SER-002;
- solicitar snapshot técnico.

Estas continuaciones se disparan secuencialmente desde el proceso que acaba de mutar estado. Si el executor muere después de parte de los cambios y antes de completar el fan-out, puede existir estado actualizado con sólo una parte de las continuaciones solicitadas.

No se propone una transacción gigante sobre todo el proceso; se propone que la intención de continuar quede durable antes de dar por concluida la fase productora.

### ARCH-007 — Configuración Railway no tiene una única fuente de verdad efectiva

**Severidad:** media-alta.

En el repo existen configs específicas `railway.batch-api.toml`, `railway.batch-fast.toml`, `railway.batch-plex.toml` y `railway.technical.toml`.

La configuración efectiva de Railway muestra que API y Technical referencian explícitamente sus config files, mientras FAST y Plex no muestran `configFile`. Por tanto, en esos servicios parte de la configuración depende del estado del panel Railway aunque existan archivos equivalentes en Git.

Además, `railway.toml` contiene comentarios que mencionan nombres antiguos/no existentes (`railway.api.toml`, `railway.lifecycle.toml`). Esto evidencia deriva documental/configuracional.

### ARCH-008 — Un cambio documental despliega workers que no han cambiado

**Severidad:** media.  
**Tipo:** acoplamiento de despliegue.

Los merges puramente documentales #547 y #548 provocaron nuevos deployments de API/FAST/Plex/Technical en Railway. No había cambios de runtime que justificasen reconstruir y reiniciar todos los workers.

Esto aumenta superficie de cambio, interrupciones, coste y tiempo de recuperación sin aportar valor funcional.

### ARCH-009 — El rollout de Railway no expresa claramente un gate CI uniforme

**Severidad:** media-alta.

La configuración viva de FAST, Plex y Technical muestra `checkSuites:false` o ausencia de un gate equivalente. Los servicios siguen `main` directamente. Aunque el flujo normal utiliza PR+CI antes del merge, un merge defectuoso puede comenzar su despliegue Railway sin una segunda barrera explícita del commit de `main`.

Esto debe revisarse en profundidad también en el bloque CI/CD, pero arquitectónicamente la relación “código aceptado → executor productivo” no está suficientemente formalizada.

### ARCH-010 — Existe riesgo natural de version skew entre planos

**Severidad:** media.

Railway sigue `main`; Vercel Production tiene un ciclo de despliegue separado. Actualmente ambos están alineados con `d260272…`, lo cual es correcto.

Sin embargo, el diseño permite ventanas en las que Vercel crea trabajo con una versión y Railway lo consume con otra. Mientras las tablas/contratos sean compatibles no hay problema, pero no existe una versión de protocolo o compatibilidad explícita que permita detectar automáticamente una combinación incompatible.

### ARCH-011 — El planner está correctamente colocado en Vercel en su estado actual

**Severidad:** OK / preservar.

Tras el cambio reciente, `PROC-PLAN-002` se ejecuta una vez por hora. Los registros posteriores al despliegue muestran ciclos horarios y tiempos del orden de pocos segundos. El historial de dispatch cada 5 minutos pertenece a la configuración anterior durante la transición de despliegue.

No hay evidencia para mover el planner a Railway: actualmente se comporta como coordinador ligero, que es precisamente la responsabilidad adecuada de Vercel.

### ARCH-012 — La cola durable en Neon es una buena decisión; no hace falta introducir otro broker por sistema

**Severidad:** OK / preservar.

El Batch Engine tiene estado durable, leases, reclaims y exclusión de claims simultáneos. Para la escala actual, añadir Redis/SQS/Kafka sólo para “tener una cola” aumentaría complejidad operacional.

V5 debería reforzar la cola actual y sus invariantes antes que multiplicar tecnologías.

### ARCH-013 — Los pools especializados son correctos, pero su contrato está implícito

**Severidad:** media.

La división API / FAST / Plex funciona, pero la asociación `process_code -> worker_pool -> executor -> capabilities` está repartida entre starters, adapters y configuración.

La consecuencia es que un proceso puede estar en el pool correcto y, aun así, declararse con executor incorrecto. Falta un registro declarativo único y validable.

### ARCH-014 — GitHub Actions está correctamente limitado

**Severidad:** OK / preservar.

Discovery IMDb es una excepción explícita, y mantenimiento manual está acotado a lectura. No se recomienda convertir Actions en executor general ni migrar allí los workers actuales.

### ARCH-015 — La arquitectura conceptual es mejor que su enforcement

**Severidad:** transversal.

Los principios escritos son razonables: Vercel controla, Neon coordina, Railway ejecuta, Actions es excepción. Los principales problemas encontrados aparecen porque esas fronteras son convenciones y no invariantes ejecutables.

La prioridad V5 no debería ser redibujar toda la arquitectura, sino convertir las fronteras correctas ya definidas en contratos que el código y CI no puedan violar silenciosamente.

## 5. Diagnóstico global

La arquitectura de PikoFilm **no necesita una reescritura**. La base es sensata y ya tiene piezas importantes de un sistema robusto: separación de planos, Batch durable, workers especializados, observabilidad canónica y un control-plane claro.

Los problemas relevantes son de **enforcement y puntos de fuga**:

1. un proceso pesado todavía vive dentro de Vercel;
2. existen runtimes paralelos con semántica duplicada;
3. metadata de executor puede ser falsa;
4. una orquestación viva no está registrada de forma canónica;
5. continuaciones no siempre quedan declaradas de forma durable;
6. configuración Railway está repartida entre Git y panel;
7. los deployments están demasiado acoplados al repositorio completo;
8. no existe contrato explícito de compatibilidad entre versiones de planos.

Por tanto, la dirección recomendada para V5 es **consolidar**, no añadir infraestructura por añadir.

## 6. Propuestas candidatas V5 — Arquitectura

Estas propuestas todavía **no están aprobadas**. Se revisarán una a una con el usuario y cada decisión se persistirá antes de avanzar.

### ARQ-01 — Sacar `PROC-NOV-009` de la ejecución larga de Vercel

Vercel crea el run/comando y responde rápido; un worker Railway Plex ejecuta la sincronización global de forma durable, sin depender del límite de 300 s.

### ARQ-02 — Crear un gateway único para trabajo durable

Toda operación que supere un presupuesto síncrono definido o haga loops/red externa prolongada debe entrar por una API interna de “enqueue durable job”, en vez de que cada Server Action decida cómo lanzar trabajo largo.

### ARQ-03 — Unificar el envelope de `process_run`

Extraer un núcleo común de start/event/error/heartbeat/finish usado por Vercel, Batch y workers técnicos, con adapters de transporte pero semántica única.

### ARQ-04 — Hacer `executor` y `worker_pool` invariantes verificables

Eliminar defaults silenciosos. El executor debe ser obligatorio o derivado del worker registrado; CI/runtime debe rechazar combinaciones imposibles como pool Plex + executor FAST.

### ARQ-05 — Crear un registro canónico ejecutable de procesos

Una única definición declarativa por `process_code` con executor permitido, pool, operación canónica, tipo de ejecución y capacidades. `PROCESS_CATALOG` se genera o valida contra ese registro. `PROC-LC-001` debe quedar incluido.

### ARQ-06 — Extraer Lifecycle Continuation del worker API

Mover la receta/orquestación de `PROC-LC-001` a un core de orquestación canónico y dejar al worker como mero adapter de cola/lease/trace.

### ARQ-07 — Introducir continuaciones durables / transactional outbox

Cuando una operación produce trabajo posterior, persistir la intención de continuación de forma durable junto al cambio que la origina o antes de cerrar la fase productora. Un dispatcher idempotente materializa después MOV/SER/PQ sin perder pasos por una muerte intermedia.

### ARQ-08 — Railway configuration-as-code real para los cuatro servicios

Todos los servicios deben referenciar explícitamente su archivo de configuración versionado. Eliminar ambigüedad panel-vs-Git y limpiar nombres/configs obsoletos.

### ARQ-09 — Limitar redeploys Railway por rutas afectadas

Definir watch patterns por servicio para que cambios sólo documentales, frontend o de otro worker no reconstruyan y reinicien los cuatro servicios.

### ARQ-10 — Gate de despliegue Railway posterior a CI

Formalizar que un commit de `main` sólo pueda convertirse en runtime Railway después de superar los checks requeridos, evitando rollout productivo de un commit todavía no validado.

### ARQ-11 — Añadir matriz de versión/protocolo entre planos

Persistir/exponer commit y versión de contrato de Vercel y cada worker. Si un productor/consumidor no es compatible, bloquear despacho con un motivo explícito en lugar de fallar de forma emergente.

### ARQ-12 — Tests arquitectónicos de fronteras

Añadir checks automáticos que detecten: trabajo durable ejecutado directamente en Vercel, procesos no registrados, executor/pool incompatibles, adapters que contengan recetas de negocio duplicadas y configuración Railway no canónica.

### ARQ-13 — Presupuesto formal para trabajo síncrono

Definir categorías, por ejemplo “interactivo”, “coordinador corto” y “durable”, con límites de tiempo/IO. El planner puede permanecer en Vercel porque cumple el presupuesto; Plex global no.

### ARQ-14 — Registro de capacidades por worker pool

Definir explícitamente qué procesos/capacidades puede ejecutar cada pool, su capacidad y dependencias externas. El claim/admission debe comprobarlo antes de entregar un item.

### ARQ-15 — Mantener Neon como backbone asíncrono único en V5

No introducir un segundo broker salvo evidencia futura de saturación. Consolidar jobs, leases, continuaciones y dispatch sobre la coordinación durable ya existente para reducir complejidad.

## 7. Orden recomendado de decisión

Para reducir dependencias entre decisiones, se recomienda revisar las propuestas en este orden:

1. ARQ-01
2. ARQ-02
3. ARQ-03
4. ARQ-04
5. ARQ-05
6. ARQ-06
7. ARQ-07
8. ARQ-08
9. ARQ-09
10. ARQ-10
11. ARQ-11
12. ARQ-12
13. ARQ-13
14. ARQ-14
15. ARQ-15

Una propuesta rechazada no se reintroducirá con otro nombre dentro de este bloque. Las dependencias de una propuesta rechazada se reevaluarán antes de presentarse.

## 8. Gate para cerrar el punto 1

El Punto 1 — Arquitectura general sólo quedará cerrado cuando:

- las 15 propuestas hayan sido revisadas una a una;
- cada una tenga decisión persistida `APROBADA` o `RECHAZADA`;
- el roadmap resumido refleje las aprobadas;
- no queden propuestas arquitectónicas de este bloque sin clasificar.

No se implementa V5 durante esta fase salvo instrucción expresa del usuario.
