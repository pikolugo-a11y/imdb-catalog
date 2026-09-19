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


---

## PROC-04 — Terminalización de poison items y cuarentena funcional

**Estado: APROBADA.**

### Problema que resuelve

La auditoría detectó casos que reaparecen en ejecuciones posteriores aunque el fallo sea repetitivo y conocido. El ejemplo vivo más claro está en `PROC-PQ-002`: cuatro elementos vuelven a fallar con mensajes del tipo “snapshot técnico sin streams”, provocando sucesivos runs `partial` pese a que el resto del trabajo converge.

### Decisión

V5 distinguirá entre un fallo todavía reintentable y un **item que ha demostrado no poder converger mediante el mismo mecanismo automático**.

Cuando PROC-03 determine, con suficiente evidencia y según política del proceso, que repetir el mismo trabajo ya no aporta valor, el item dejará de circular por la cola normal y pasará a un estado terminal explícito.

### Estados terminales conceptuales

Como mínimo se contemplan categorías equivalentes a:

- **PERMANENT_ERROR** — existe un fallo real que requiere corrección/revisión;
- **NOT_APPLICABLE** — la operación no aplica legítimamente a ese item;
- **MANUAL_REVIEW** — necesita decisión humana antes de continuar.

La implementación exacta puede variar por dominio, pero no se utilizará una única “papelera” opaca.

### Trazabilidad mínima

Todo item terminal debe conservar o exponer:

- entidad;
- process code;
- motivo/clase;
- último error o causa funcional;
- intentos realizados;
- cuándo se terminalizó;
- qué regla/política lo decidió;
- condición de reentrada o forma de revisión.

### Reentrada

La terminalización no es necesariamente eterna.

Si cambia la causa relevante —por ejemplo:

- cambia el fingerprint/versión del elemento Plex;
- cambia identidad;
- cambia referencia TMDb;
- cambia metadata necesaria;
- cambia una decisión/configuración que invalida la causa terminal;

el item puede volver a ser elegible de forma segura.

La condición de reentrada debe ser determinista y específica del dominio.

### Relación con PROC-03

- PROC-03 decide si un fallo merece retry y cuándo.
- PROC-04 decide cuándo **dejar de repetir** el mismo trabajo porque ya existe evidencia suficiente de no convergencia.

Ambas propuestas deben compartir clasificación de errores/estados para evitar lógicas paralelas.

### Semántica de runs

Un conjunto de incidencias terminales ya conocidas no debería convertir indefinidamente cada ejecución posterior en `partial`.

La ejecución debe distinguir entre:

- fallo nuevo/activo durante ese run;
- incidencia terminal ya conocida;
- item legítimamente no aplicable.

La semántica final exacta se coordinará con el Punto 5 — Observabilidad y errores, pero el principio queda aprobado aquí.

### Protección de Series

PROC-04 no sustituye estados funcionales propios de Series.

No se terminaliza un episodio por el mero hecho de:

- estar dentro del margen de 7 días;
- tener disponibilidad todavía desconocida;
- ser un especial;
- estar cubierto por `not_needed`;
- depender de un override manual.

Sólo actúa sobre repetición técnica inútil o casos cuyo contrato funcional permita expresamente un estado terminal.

### Límites

- No borra items ni errores.
- No oculta incidencias.
- No convierte automáticamente cualquier tercer fallo en “terminal”.
- No elimina revisión humana cuando sea necesaria.
- No autoriza ahora migraciones, cambios en Neon ni mutación de los cuatro casos vivos observados.
- Debe existir una ruta clara para invalidar/reabrir el estado cuando cambie la causa.

### Resultado esperado

Los mismos casos no contaminan indefinidamente nuevas ejecuciones. PikoFilm mantiene trazabilidad completa, reduce ruido y trabajo repetido y reserva `partial` para incidencias realmente activas o nuevas.


---

## PROC-05 — Semántica canónica de estados Batch y planner

**Estado: APROBADA.**

### Problema que resuelve

El planner actual puede marcar un plan como `completed` cuando el parent termina en `technical_status='partial'`, incluso si `functional_result='pending'`.

La auditoría no encontró aún un caso automático real perjudicado, pero el contrato permite confundir:

- ejecución técnicamente terminada;
- objetivo funcional realmente resuelto;
- necesidad de continuar/reintentar trabajo.

### Decisión

V5 separará y gobernará de forma canónica tres dimensiones:

1. **estado técnico** — qué ocurrió durante la ejecución;
2. **resultado funcional** — si el objetivo quedó resuelto;
3. **estado del plan** — si queda trabajo futuro que PikoFilm espera realizar.

Un plan sólo podrá considerarse **completed** cuando funcionalmente ya no quede trabajo pendiente de continuación automática.

### Reglas conceptuales

Como mínimo:

- `succeeded + objetivo resuelto + sin trabajo pendiente` → plan `completed`;
- `succeeded` con errores recuperados pero objetivo resuelto → plan `completed`;
- `partial + trabajo retryable/pendiente` → plan `delayed` o equivalente de continuación;
- `partial` causado únicamente por incidencias terminales conocidas de PROC-04 y sin trabajo futuro → plan puede quedar `completed` con incidencia;
- `failed` recuperable → continuidad/replanificación;
- `failed` permanente → incidencia terminal, no retry automático ciego;
- `cancelled` → plan cancelado.

La implementación exacta puede conservar los conjuntos pequeños actuales de estados; la decisión no exige multiplicar enums.

### Evaluador canónico

La lógica de transición deberá centralizarse en una función/contrato único equivalente a `evaluateProcessOutcome`, evitando que planner, Actividad, Batch padres y superficies administrativas interpreten combinaciones de forma distinta.

La evaluación podrá usar:

- estado técnico;
- resultado funcional;
- items totales/resueltos;
- items pendientes;
- items retryables;
- items terminalizados por PROC-04;
- cancelación;
- políticas PROC-03;
- excepciones explícitas declaradas en PROC-01.

### Parent Batch

El parent no debe inventar un resultado independiente de sus items.

Su resultado debe reflejar de forma consistente si:

- todo quedó resuelto;
- queda continuidad automática;
- sólo quedan terminales conocidas;
- existe un fallo estructural;
- fue cancelado.

### Relación con PROC-03 y PROC-04

Cadena aprobada:

`fallo → PROC-03 decide retry → PROC-04 decide terminalización → PROC-05 decide si el trabajo global puede cerrarse`.

### Observabilidad

`error_count > 0` no implica por sí solo fallo del proceso. Un run puede haber registrado errores recuperables y aun así haber cumplido el objetivo.

Actividad/Operaciones deberán poder distinguir, cuando corresponda:

- completado;
- completado con incidencias conocidas;
- incompleto y pendiente de retry;
- fallo terminal;
- cancelado.

La UX concreta se revisará en los puntos posteriores, pero la semántica nace aquí.

### Protección de dominios

- No altera reglas funcionales de Series/Plex/Lifecycle.
- Series mantiene margen de 7 días, disponibilidad, overrides y conciliación existentes.
- Cualquier cambio de transición se cubrirá con tests de contrato antes de implementación.

### Límites

- No reabre runs históricos.
- No modifica ahora `process_plans`, `process_runs` ni enums de Neon.
- No autoriza migraciones ni despliegues.
- No obliga a crear estados nuevos si la combinación de estados actuales puede expresar correctamente el contrato.

### Resultado esperado

PikoFilm deja de confundir “la ejecución acabó” con “el trabajo quedó terminado”. El planner sólo cierra lo que ya no necesita continuación funcional.


---

## PROC-06 — Planner horario único y eliminación del tick residual de 5 minutos

**Estado: APROBADA.**

### Problema que resuelve

La implementación conserva dos modos conceptuales del planner:

- ciclo completo;
- tick intermedio de sólo dispatch cada 5 minutos.

Sin embargo, la producción actual ejecuta únicamente el cron horario `0 * * * *`. Los logs de Vercel y la configuración viva lo confirman. Parte de la documentación todavía describe `*/5 * * * *`, por lo que existe una segunda arquitectura residual que ya no representa el sistema real.

### Decisión

V5 adopta oficialmente un **único reloj automático de mantenimiento: el ciclo horario completo**.

La vía global de dispatch cada 5 minutos deja de formar parte de la arquitectura objetivo y se retirará de código, documentación y tests cuando se implemente V5.

### Ciclo canónico

El planner horario realiza, de forma coherente:

1. reconciliación de planes/runs anteriores;
2. replanificación de trabajo demorado;
3. detección de demanda vigente;
4. forecast cuando aplique;
5. planificación;
6. dispatch de lo vencido;
7. housekeeping asociado mientras siga formando parte del contrato aprobado.

### Procesos urgentes

Una necesidad de reacción inmediata o sub-horaria no justifica reintroducir un cron global de 5 minutos.

Las continuaciones urgentes deben pertenecer al proceso concreto que las necesita y usar su mecanismo durable/directo correspondiente.

Ejemplos existentes:

- continuaciones de Plex;
- encadenados explícitos de procesos;
- acciones manuales que encolan trabajo durable inmediatamente.

### Alcance

Se alinearán:

- `vercel.json`;
- route del planner;
- helpers de planner;
- documentación;
- RUNBOOK;
- Actividad;
- tests y contratos.

Todos deberán expresar una única cadencia automática global horaria.

### Lo que no cambia

- `PROC-NOV-009` y `PROC-SER-001` siguen siendo globales manuales.
- Las continuaciones explícitas siguen pudiendo lanzarse inmediatamente.
- No cambian bloques, prioridades ni ventanas por aprobar PROC-06.
- No se elimina la ejecución manual.
- No se modifica ahora Vercel Production.

### Reapertura futura

Si una necesidad real demuestra que un proceso concreto requiere un SLA inferior a una hora, se diseñará para ese proceso. No se conservará un scheduler global secundario “por si acaso”.

### Resultado esperado

Menos código muerto y menos ambigüedad: planificación, ejecución, UX y documentación comparten una sola cadencia global real y verificable.


---

## PROC-07 — Planificación agregada por demanda, no por microplanes

**Estado: APROBADA.**

### Problema que resuelve

La planificación actual materializa el trabajo futuro en muchos microplanes homogéneos. En la auditoría se observaron:

- 305 planes totales;
- 278 futuros;
- 208 planes futuros sólo para `PROC-PER-001`, representando 5.095 personas en bloques de 25.

El modelo funciona, pero escala en número de filas con cada bloque futuro y obliga a replanificar/cancelar muchas filas cuando cambia la demanda real.

### Decisión

V5 separará explícitamente:

1. **demanda futura agregada** — cuánto trabajo existe, cuándo empieza a vencer, cuándo debe estar resuelto y qué prioridad/carga tiene;
2. **ejecución concreta** — el Batch real que se materializa cuando llega el momento de consumir parte de esa demanda.

El futuro se modelará preferentemente como demanda + capacidad, no como cientos de ejecuciones predibujadas.

### Demanda agregada

Cuando unidades comparten realmente la misma ventana funcional, PikoFilm podrá representarlas como un bucket agregado con, al menos:

- process code;
- dominio;
- volumen;
- ventana/fecha de elegibilidad;
- fecha límite;
- prioridad;
- perfil horario;
- carga estimada;
- origen automático/manual;
- protección;
- indicador de pico deliberado cuando aplique.

No se agregan unidades cuya diferencia temporal o funcional cambie su semántica.

### Materialización tardía

El planner horario consume progresivamente la demanda y sólo crea la ejecución real cuando toca lanzarla.

Ejemplo conceptual:

`demanda PER-001 = 450 → planner decide 25 ahora → materializa Batch de 25 → quedan 425`.

Las ejecuciones reales continúan totalmente trazables en `process_runs`/Batch.

### Visibilidad futura

La reducción de microplanes **no reduce la visibilidad en Actividad**.

PikoFilm seguirá pudiendo mostrar:

- volumen previsto por día/franja;
- carga futura;
- fecha estimada de finalización;
- ritmo recomendado;
- atrasos;
- próximos vencimientos;
- capacidad disponible.

La previsión puede derivarse de demanda + capacidad en vez de requerir una fila física por bloque futuro.

### Picos deliberados

Se conserva la capacidad de decidir explícitamente un pico.

Un usuario puede pedir que un día concreto se procese un volumen muy superior al reparto normal. Ese objetivo queda marcado como deliberado y el equilibrador no intenta “corregirlo” automáticamente.

### Reconciliación con demanda viva

Si la elegibilidad cambia antes de ejecutar:

- aumenta/disminuye demanda;
- algunas entidades dejan de ser elegibles;
- aparecen nuevas unidades;

el planner reconciliará el bucket agregado con la realidad actual en vez de mantener microplanes obsoletos.

### Series

Series mantiene criterio conservador.

Sólo se agregan unidades que compartan la misma ventana funcional. Fechas distintas de disponibilidad/recheck/next_check se mantienen separadas cuando agregarlas pudiera adelantar, retrasar o alterar una regla funcional.

### Datos que deben conservarse

La agregación no puede perder:

- deadline real;
- prioridad;
- origen;
- protección;
- intención manual;
- pico deliberado;
- carga estimada;
- volumen ya consumido;
- explicación del reparto.

### Límites

- No modifica elegibilidad funcional.
- No cambia límites de API ni concurrencia.
- No elimina planificación manual.
- No impide ejecutar un Batch inmediatamente.
- No obliga a una única fila por proceso; puede haber múltiples buckets cuando existen ventanas funcionales distintas.
- No autoriza ahora migraciones ni transformación de los 305 planes vivos.

### Resultado esperado

El planner escala por demanda significativa y no por cantidad de bloques futuros. Se mantiene la visibilidad del calendario, mejora la replanificación y se preserva la capacidad de repartir carga o provocar picos deliberados.


---

## PROC-08 — Concurrencia por entidad para Lifecycle

**Estado: APROBADA.**

### Problema que resuelve

La auditoría detectó que la admisión/Lifecycle mantiene una protección global muy conservadora: un Lifecycle activo puede bloquear la entrada de otro título aunque ambas entidades sean independientes.

La serialización protege consistencia, pero puede convertir un único título lento o problemático en cuello de botella para admisiones no relacionadas.

### Decisión

V5 moverá la exclusión de Lifecycle desde una serialización global por defecto hacia **exclusión por entidad o dependencia lógica real**, manteniendo locks globales únicamente donde exista una razón demostrada.

La regla conceptual es:

- dos ejecuciones sobre el mismo título/dependencia no compiten entre sí;
- títulos independientes pueden avanzar en paralelo dentro de los límites seguros del pool y de las APIs.

### Clave de exclusión

PROC-01 podrá declarar el alcance de exclusión de cada proceso, por ejemplo:

- `global`;
- `entity`;
- `resource` / dependencia compartida;
- otro scope explícito que resulte necesario.

Para Lifecycle, la clave natural será la identidad canónica de la entidad, normalmente `imdb_id`, siempre que la auditoría de writers confirme que es suficiente.

### Garantía para la misma entidad

Dos solicitudes concurrentes sobre el mismo título deben:

- reutilizar el run activo;
- adjuntarse/encadenarse a la continuación existente;
- o devolver de forma explícita “ya en proceso”.

Nunca deben crear dos pipelines funcionalmente contradictorios sobre la misma entidad.

### Concurrencia controlada

Aprobar PROC-08 no implica elevar indiscriminadamente la concurrencia.

Siguen vigentes:

- límites del pool;
- gobernanza de APIs;
- circuit breakers;
- cuotas;
- PROC-02 capability preflight;
- locks adicionales en recursos verdaderamente compartidos.

Puede haber varias entidades activas y, aun así, sólo unas pocas unidades ejecutándose simultáneamente.

### Dependencias globales

Antes de reducir un lock se deben revisar los writers del proceso.

Si un paso concreto toca un recurso global que exige serialización, ese recurso mantiene su exclusión específica. El objetivo es bloquear la dependencia real, no toda la tubería por defecto.

### Aplicación selectiva

PROC-08 no se extiende automáticamente a cualquier proceso.

Pueden seguir siendo globales/serializados:

- sincronizaciones Plex globales;
- rebuilds globales;
- operaciones administrativas sobre estado compartido;
- cualquier proceso cuyo contrato PROC-01 declare scope global.

### Validación obligatoria

La implementación futura requiere:

- inventario de writers;
- tests de carreras/concurrencia;
- idempotencia;
- pruebas en entorno seguro;
- límites conservadores iniciales;
- capacidad de volver temporalmente a serialización global si se detecta divergencia.

### Límites

- No cambia ahora la concurrencia de producción.
- No autoriza modificaciones de Neon.
- No elimina protecciones de identidad, Lifecycle o catálogo.
- No asume que todas las entidades sean independientes: esa independencia debe demostrarse por proceso/dependencia.

### Resultado esperado

Un título lento o problemático deja de bloquear trabajos independientes. PikoFilm serializa sólo aquello que realmente comparte estado y conserva idempotencia estricta sobre la misma entidad.


---

## PROC-09 — Contrato único para modelos de ejecución especiales

**Estado: APROBADA.**

### Problema que resuelve

PikoFilm utiliza varios modelos de ejecución legítimamente distintos:

- Batch Engine común;
- procesos chunked en Vercel;
- controladores persistentes especializados como `PROC-PQ-002`;
- workflows externos como `PROC-NOV-001` en GitHub Actions.

El problema no es la diversidad de motores, sino que cada uno expone estados, controles, progreso y recuperación de manera diferente.

### Decisión

V5 definirá un **contrato operativo común** para cualquier proceso durable, sin obligar a que todos utilicen el mismo motor.

PROC-01 declarará el modelo de ejecución de cada proceso y sus capacidades operativas.

### Modelos de ejecución explícitos

Como mínimo podrán existir categorías equivalentes a:

- `batch_common`;
- `vercel_chunked`;
- `persistent_controller`;
- `github_actions`;
- otros modelos excepcionales sólo si se declaran de forma explícita.

### Contrato operativo común

Todo proceso durable deberá poder exponer, cuando sea aplicable:

- ejecutor/modelo;
- estado actual;
- fecha de solicitud/inicio/fin;
- progreso;
- heartbeat o señal equivalente de vida;
- trabajo pendiente;
- resultado funcional;
- incidencias activas/terminales;
- capacidad de pause/resume/cancel;
- estrategia de recuperación;
- correlación con el runtime externo si existe.

La ausencia de una capacidad también debe ser explícita.

### Controles

PROC-01 podrá declarar capacidades como:

- pause;
- resume;
- cancel;
- retry;
- manual continuation;
- unsupported.

Actividad/Operaciones podrá mostrar controles a partir de este contrato en lugar de mantener excepciones por proceso.

### Recuperación por modelo

Cada modelo conserva su mecanismo interno:

- Batch común → lease expiry / reclaim / child runs;
- controlador persistente → heartbeat + estado del controlador;
- GitHub Actions → correlación con workflow/run;
- Vercel chunked → checkpoints/continuación según su diseño.

La semántica exterior debe ser común aunque la implementación sea distinta.

### Relación con PROC-05

El contrato operativo utilizará la semántica canónica de:

- estado técnico;
- resultado funcional;
- necesidad de continuación;
- terminalización.

No se crean interpretaciones paralelas para cada motor.

### Actividad y Operaciones

Una superficie puede consultar cualquier ejecución mediante una abstracción común equivalente a `getProcessExecutionState(run_id)`, evitando conocer internamente si el proceso vive en Railway, Vercel, GitHub Actions o un controlador especializado.

### Excepciones preservadas

- `PROC-NOV-001` mantiene GitHub Actions y su cooldown semanal.
- `PROC-PQ-002` puede mantener su controlador Technical Snapshot.
- `PROC-PQ-001` puede mantener ejecución chunked si sigue siendo el modelo adecuado.
- No se fuerza ninguna de ellas al Batch Engine común sólo por uniformidad.

### Límites

- No crea un orquestador central nuevo por sí sola.
- No migra procesos entre infraestructuras.
- No elimina GitHub Actions ni controladores especializados.
- No cambia lógica funcional.
- No autoriza ahora cambios de producción.

### Resultado esperado

PikoFilm puede conservar motores de ejecución especializados, pero todos hablan el mismo idioma operativo y pueden integrarse de forma uniforme en Actividad, Operaciones y observabilidad.
