# PikoFilm V5 — Decisiones 04: Procesos automáticos y Batch

Estado: **FASE 2 ACTIVA**  
Rama: `audit/v5-04-processes`

Este documento registra decisiones aprobadas/rechazadas del Punto 4. Cada decisión se persiste antes de presentar la siguiente.

---

## PROC-01 — Registro canónico y ejecutable de procesos

**Estado: APROBADA.**

### Problema que resuelve

La auditoría detectó que la identidad y metadata de los procesos `PROC-*` están repartidas entre:

- `docs/processes/PROCESS_CATALOG.md`;
- `lib/process-display.js`;
- starters Batch;
- adapters de workers;
- `SAFE_AUTOMATIC_PROCESS_CODES`;
- políticas del planner;
- configuración de automatizaciones;
- excepciones especiales.

La deriva ya es real: `PROC-SER-007` y `PROC-LC-001` ejecutan producción pero no aparecen en el catálogo maestro documental.

### Decisión

V5 tendrá **un único registro canónico ejecutable y versionado en Git para todos los procesos PikoFilm**.

Ese registro será la fuente técnica de verdad sobre la identidad y el contrato de ejecución de cada `PROC-*`.

### El registro debe poder declarar, cuando aplique

- código;
- nombre legible;
- dominio;
- estado: activo / legacy / retirado;
- modelos de ejecución admitidos: manual, individual, Batch, automático, sistema;
- tipo de ejecución: Batch común, controlador especializado, GitHub Actions, Vercel chunked u otra excepción explícita;
- pool requerido: `api`, `fast`, `plex` o especial;
- adapter/capacidad requerida del worker;
- si puede entrar en el planner automático;
- si es global;
- concurrencia/limitaciones estructurales;
- core canónico al que delega;
- fuentes externas relevantes;
- protecciones operativas necesarias.

No todos los campos tienen que ser obligatorios para todos los modelos de ejecución; el esquema debe expresar explícitamente las excepciones.

### Invariantes

1. **Ningún componente puede inventar una segunda definición funcional del mismo proceso.**
2. Todo `PROC-*` activo que se use en código debe existir en el registro canónico.
3. Los nombres, labels y metadata de UI/documentación se derivarán del registro o se validarán contra él para evitar divergencia.
4. Planner y automatizaciones no mantienen listas paralelas de autoridad: un proceso automático debe estar expresamente autorizado por el registro.
5. Los workers no pueden declarar adapters desconectados del registro.
6. Los procesos especiales —por ejemplo `PROC-PQ-002` o `PROC-NOV-001`— no se fuerzan artificialmente al Batch común; el registro declara su modelo de ejecución real.
7. Un proceso global protegido como `PROC-NOV-009` puede declarar explícitamente `automatic=false`; CI debe impedir introducirlo en planificación automática por accidente.
8. Los procesos dudosos/históricos como `PROC-NOV-013` deben clasificarse como activos, legacy o retirados; no se borran por intuición.

### CI / validación obligatoria

V5 debe añadir validaciones automáticas que fallen cuando, al menos:

- aparece un `processCode` desconocido;
- un proceso Batch referencia un pool/adapter no declarado;
- un adapter desplegable no está respaldado por un proceso registrado;
- un proceso marcado como no automático aparece en planner/automatizaciones;
- existe metadata duplicada contradictoria entre registro y consumidores;
- un proceso declarado activo carece de las piezas estructurales obligatorias para su modelo de ejecución.

La validación exacta puede implementarse con tests/CI, pero debe ser ejecutable y no depender de revisión manual.

### Límites

- El registro **no absorbe lógica de negocio** de Series, Personas, PikoScore, Novedades, etc.
- Las reglas de elegibilidad permanecen en sus cores/módulos canónicos.
- No se crea una “mega-configuración” que sustituya el código funcional.
- La aprobación no autoriza aún refactor masivo, cambios de Neon, despliegues ni cambios de comportamiento de procesos.
- No añade workers, polling ni coste operativo material.

### Resultado esperado

Una sola identidad/contrato por proceso, con workers, planner, Actividad, UI técnica, CI y documentación alineados sobre esa definición.


---

## PROC-02 — Preflight de capacidades antes de encolar Batch

**Estado: APROBADA.**

### Problema que resuelve

La auditoría encontró un caso real en `PROC-SAGA-001`:

- se materializaron 1.584 items;
- el worker API desplegado no tenía registrado el adapter requerido;
- los 1.584 items fallaron con `Adapter API no registrado`;
- tras corregir/desplegar el adapter, una nueva ejecución procesó correctamente los 1.584.

El Batch Engine conservó la durabilidad, pero permitió crear trabajo destinado de antemano a fallar por una incompatibilidad entre el control plane y la capacidad real del worker desplegado.

### Decisión

Antes de materializar un Batch, V5 verificará que el worker/pool realmente desplegado declara la capacidad necesaria para ejecutar ese `process_code` y su adapter/modelo de ejecución.

PROC-01 define **qué capacidad requiere** cada proceso. PROC-02 verifica **qué capacidad ofrece realmente** la infraestructura desplegada.

### Estado de capacidades del worker

Cada worker durable deberá exponer o publicar una foto vigente y ligera de su capacidad, incluyendo como mínimo cuando aplique:

- identidad del servicio/pool;
- versión/build/commit;
- versión del contrato/registro;
- process codes/adapters soportados;
- momento de arranque o última publicación;
- estado compatible/no compatible.

No se necesita un historial voluminoso de heartbeats de capacidades. La necesidad principal es conocer el estado desplegado vigente.

### Preflight obligatorio

Antes de crear `batch_run_control` + `batch_run_items` para un Batch común:

1. consultar PROC-01 para saber pool/adapter/capacidad requerida;
2. consultar la capacidad vigente del worker correspondiente;
3. validar compatibilidad de proceso, adapter y versión de contrato;
4. sólo entonces materializar el Batch.

Si la capacidad no está disponible o es incompatible, el Batch no se materializa.

### Diferenciar incompatibilidad de indisponibilidad temporal

No deben confundirse:

- **worker compatible temporalmente offline:** el sistema puede conservar/demorar trabajo durable según el modelo de ejecución;
- **worker desplegado incompatible o sin adapter:** no se materializa trabajo masivo destinado a fallar.

El preflight se diseña para impedir principalmente la segunda clase.

### Automatización / planner

Si un proceso automático llega a su ventana pero la capacidad desplegada es incompatible:

- no se pierde demanda;
- no se fabrican miles de fallos;
- el plan queda demorado/bloqueado de forma explícita y observable;
- puede reintentarse cuando vuelva a existir capacidad compatible.

La semántica exacta de estados de planificación se definirá junto con las propuestas posteriores del Punto 4.

### Versionado y despliegues parciales

El contrato debe detectar escenarios como:

`control plane nuevo → requiere adapter/contrato V5 → worker aún ejecuta build anterior`.

En ese caso debe fallar el preflight antes de encolar.

### Recuperaciones ad hoc

La implementación futura deberá permitir retirar gradualmente reparaciones específicas del tipo:

`si PROC-LC-001 falló con "Adapter API no registrado", reencolar`.

El objetivo es que el error de capability drift quede prevenido por contrato general y no por excepciones específicas por proceso/mensaje.

### Relación con CI

PROC-01 valida estáticamente que el repositorio declara correctamente procesos/adapters/pools.

PROC-02 añade la validación **runtime/deploy real**: que la versión efectivamente desplegada declare lo mismo antes de recibir trabajo.

Ambas capas son complementarias.

### Límites

- No obliga a que un worker esté continuamente ejecutando trabajo.
- No convierte una caída temporal de Railway en corrupción del Batch.
- No añade lógica funcional de dominio.
- No modifica reglas de elegibilidad.
- No autoriza ahora cambios en Neon, Railway, Vercel ni producción.
- La solución debe ser ligera y no introducir polling de alta frecuencia ni coste material.

### Resultado esperado

PikoFilm no volverá a crear un Batch masivo para una capacidad que el worker desplegado no puede ejecutar. Los fallos de incompatibilidad se detectan antes de crear la cola, con diagnóstico explícito y sin contaminar observabilidad con miles de errores evitables.


---

## PROC-03 — Política de reintentos por proceso y tipo de fallo

**Estado: APROBADA.**

### Problema que resuelve

El Batch Engine común aplica hoy una política prácticamente uniforme:

- máximo 3 intentos;
- primer retry aproximadamente a las 6 horas;
- siguientes intentos aproximadamente a las 24 horas.

La auditoría confirma que esa simplicidad funciona, pero mezcla fallos con semánticas muy distintas: timeout/red, HTTP 429, cuota agotada, error permanente, estado funcional pendiente o incompatibilidad de capacidad.

### Decisión

V5 clasificará el motivo de fallo antes de decidir si, cuándo y cuántas veces reintentar un item Batch.

El runtime común aplicará una política declarativa ligada al contrato PROC-01, con un default conservador y excepciones sólo cuando exista una necesidad real.

### Clases mínimas de fallo

Como base:

- **TRANSIENT** — red, timeout, 5xx y equivalentes técnicamente recuperables;
- **RATE_LIMIT** — 429 o throttling temporal;
- **QUOTA** — cuota diaria/mensual agotada;
- **PERMANENT** — error determinista que no mejorará repitiendo lo mismo;
- **FUNCTIONAL_PENDING** — el proceso no puede completarse aún por una condición funcional, pero no existe fallo técnico;
- **CAPABILITY** — worker/build incompatible; debe quedar prevenido por PROC-02 y no convertirse en retries por item.

No se crearán decenas de categorías ni políticas arbitrarias.

### Comportamiento esperado

#### TRANSIENT

Retry con backoff progresivo y acotado. El primer retry puede ser mucho más rápido que las 6 horas actuales cuando la fuente/proceso lo permita.

#### RATE_LIMIT

Respetar `Retry-After`, `blocked_until` y el circuit breaker ya existentes. No generar cientos de fallos/retries independientes mientras la fuente está explícitamente bloqueada.

#### QUOTA

Esperar hasta que la cuota vuelva a estar disponible según la gobernanza de la fuente. No consumir intentos inútilmente.

#### PERMANENT

No repetir automáticamente el mismo fallo hasta alcanzar un contador arbitrario. Terminar el item con diagnóstico funcional/técnico apropiado.

#### FUNCTIONAL_PENDING

No se trata como error técnico. La siguiente comprobación se programa por la regla de negocio del proceso.

Ejemplo importante: disponibilidad/estreno de Series se vuelve a evaluar por sus reglas de frescura/margen, no mediante retries agresivos del item.

#### CAPABILITY

No se materializa el trabajo cuando PROC-02 detecta incompatibilidad. Un error residual de capacidad debe bloquear/escalar, no iniciar una cascada de retries.

### Política por proceso

PROC-01 podrá declarar ajustes sobre una política base, por ejemplo:

- máximo de intentos para errores transitorios;
- backoff;
- ventanas de retry;
- si una clase se transforma en revisión funcional;
- sensibilidad especial del dominio.

El objetivo no es que cada proceso tenga su propio algoritmo; los procesos comparten unas pocas políticas comunes y sólo ajustan lo necesario.

### Integración con gobernanza API

PROC-03 reutiliza, no sustituye:

- leases de fuente;
- límites diarios;
- reserva manual/Batch;
- circuit breaker;
- `blocked_until`;
- tratamiento de 429.

La política de retry del item debe interpretar esos estados para no programar trabajo cuando la fuente ya declara que no está disponible.

### Fuente canónica del intento

Para Batch común, el intento pertenece al item:

- `batch_run_items.attempt_count` es la fuente estructural;
- `process_run_errors.retry_attempt` sirve de trazabilidad del error concreto.

`process_runs.retry_count` no debe considerarse hoy una métrica canónica de retries Batch. Su retirada/deprecación se evaluará al implementar el modelo, sin autorizar ahora ninguna migración.

### Series

Series mantiene un criterio conservador:

- fallo técnico recuperable → retry según política;
- ausencia/disponibilidad aún no resoluble → siguiente comprobación funcional;
- margen de 7 días, conciliación Plex↔TMDb y decisiones manuales no se alteran por PROC-03.

### Límites

- No convierte todos los fallos en retries rápidos.
- No elimina límites de intentos.
- No modifica reglas funcionales de dominio.
- No sustituye el planner ni la gobernanza de APIs.
- No autoriza cambios en producción, migraciones ni reintentos retroactivos.
- La política final debe ser observable y explicable en Actividad/Operaciones.

### Resultado esperado

PikoFilm reintenta únicamente aquello que tiene sentido reintentar y espera el tiempo adecuado según la causa, reduciendo latencia de recuperación, llamadas inútiles y ruido operativo sin sacrificar seguridad.
