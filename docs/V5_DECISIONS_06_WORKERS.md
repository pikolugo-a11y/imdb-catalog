# PikoFilm V5 — Decisiones Punto 6: Workers y servicios persistentes

Fecha: 2026-09-19  
Estado: **Fase 2 activa**

Este documento registra las decisiones V5 del Punto 6. Cada propuesta debe quedar persistida antes de presentar la siguiente.

---

## WKR-01 — Contrato canónico de presencia, versión y capacidades de worker

**APROBADA.**

### Decisión

PikoFilm debe disponer de un contrato durable y común para conocer el estado real de cada instancia/pool de worker, separando claramente **presencia del worker** de **existencia de trabajo**.

El contrato deberá expresar, de forma equivalente a:

- identificador de instancia/worker;
- runtime/servicio y pool;
- estado operativo actual;
- capacidad/concurrencia declarada;
- versión/build/commit/deployment cuando aplique;
- instante de arranque;
- heartbeat vigente;
- capacidades/procesos/adapters realmente disponibles.

No se fijan todavía nombres de tabla ni columnas concretas.

### Estados

El modelo debe ser pequeño y operativo, con estados equivalentes a:

- `STARTING`;
- `READY`;
- `BUSY`;
- `DRAINING`;
- `UNAVAILABLE`;

y sólo añadir otros estados cuando exista una necesidad real.

### Preflight

Antes de materializar trabajo dirigido a un pool, PikoFilm debe poder comprobar al menos:

1. que existe capacidad `READY` vigente;
2. que el heartbeat no está expirado;
3. que el runtime declara la capacidad/proceso requerido;
4. que la versión/build cumple el contrato de compatibilidad exigido.

Si esa capacidad no existe, la demanda debe quedar pendiente/planificada de forma trazable en lugar de crear masivamente items destinados a fallar.

Esto implementa la dirección funcional ya aprobada en `PROC-02`.

### Heartbeat

El heartbeat de presencia no debe convertirse en una nueva fuente de polling/escrituras de alta frecuencia.

Principios:

- registro inmediato al arrancar;
- actualización inmediata ante cambios de estado, build o capacidades;
- heartbeat relativamente espaciado;
- expiración determinista cuando deja de recibirse;
- retirada/drain explícitos cuando sea posible.

La frecuencia exacta se decidirá en implementación con evidencia de coste y tiempo de recuperación.

### Separación fundamental

```
worker vivo y preparado
!=
worker ejecutando trabajo
```

Un worker `READY` con 0 items es un estado sano.

### UX/Operaciones

Operaciones debe poder mostrar la salud real del runtime sin inferirla a partir de que existan o no runs.

La información técnica de build/capabilities pertenece a Operaciones, no a Actividad.

### Límites

Esta aprobación:

- no decide todavía wake/sleep;
- no decide si Railway Serverless se usará;
- no cambia número de réplicas;
- no habilita autosuspend de Neon;
- no autoriza migraciones ni mutaciones de Production;
- no implementa todavía ninguna tabla ni heartbeat nuevo.

### Invariante

> PikoFilm nunca debe asumir que un worker está disponible por el mero hecho de que su servicio exista: antes de enviarle trabajo debe conocer de forma vigente su presencia, versión y capacidades reales.


---

## WKR-02 — Idle adaptativo sin polling agresivo

**APROBADA.**

### Decisión

Los workers persistentes API/FAST/Plex dejarán de consultar Neon con una cadencia agresiva constante cuando no exista trabajo.

La ausencia de demanda debe activar un **backoff progresivo**, manteniendo polling rápido únicamente mientras exista carga real.

Patrón conceptual:

- trabajo activo -> polling rápido;
- primera cola vacía -> espera corta;
- vacío sostenido -> incrementar progresivamente la espera;
- nuevo item encontrado -> volver inmediatamente a modo activo.

### Cadencia

No se fija todavía un valor único para todos los pools.

Cada pool podrá tener límites distintos según su perfil de carga y sensibilidad de latencia.

Ejemplos orientativos, no vinculantes:

- API: idle máximo más corto;
- FAST: idle máximo más largo;
- Plex: idle máximo más largo.

La cadencia definitiva deberá balancear:

- latencia de arranque;
- volumen real de trabajo;
- coste de consultas;
- recuperación;
- experiencia manual.

### Wake hint futuro

La solución puede evolucionar hacia un mecanismo ligero productor→worker que permita acortar el idle en cuanto aparezca demanda.

No se obliga ahora a implementar un broker, cola externa ni nueva plataforma.

Mientras no exista un wake explícito, el backoff máximo debe garantizar una latencia de inicio aceptable.

### Separación de responsabilidades

Se separan conceptualmente tres ritmos distintos:

1. **claim de trabajo**;
2. **mantenimiento/reconciliación de leases**;
3. **heartbeat de presencia WKR-01**.

Ninguno debe ejecutarse automáticamente con la misma frecuencia sólo porque compartan un loop.

### Recovery

La reducción de polling no puede:

- retrasar de forma peligrosa la recuperación de leases;
- impedir detectar trabajo atascado;
- dejar demanda indefinidamente sin consumidor;
- degradar la seguridad del Batch Engine.

### Límites

Esta aprobación:

- no activa Railway sleep/serverless;
- no cambia todavía topología ni número de servicios;
- no modifica autosuspend de Neon;
- no añade una cola externa;
- no autoriza cambios en Production ahora.

### Invariante

> La ausencia de trabajo debe reducir automáticamente la frecuencia de consulta; tener un worker disponible no implica consultar Neon de forma agresiva permanentemente.


---

## WKR-03 — Technical realmente quiescente cuando está detenido

**APROBADA.**

### Decisión

Cuando `Technical Snapshot` esté funcionalmente detenido, debe entrar en un estado realmente quiescente.

`requested_state='stopped'` no debe implicar:

- lectura de control cada ~10 segundos;
- escritura de heartbeat cada ~10 segundos;
- actualización repetitiva de `plex_technical_control`;
- logs INFO reiterando continuamente que sigue parado.

### Separación de señales

Se separan de forma explícita:

1. **presencia del runtime** — WKR-01;
2. **estado funcional de Technical** — running / paused / stopped.

Un worker puede estar disponible y sano mientras Technical permanece `stopped`.

### Transiciones

Los cambios de estado sí deben registrarse inmediatamente:

- running → paused;
- paused → running;
- running/paused → stopped;
- stopped → running.

Una vez estable en `stopped`, la señal repetitiva se reduce al mínimo necesario.

### Presencia

La presencia del servicio se mantendrá mediante el contrato común de WKR-01, con heartbeat de baja frecuencia y sin convertirlo en otro loop agresivo.

La frecuencia exacta se decidirá durante implementación según coste y tiempo de detección aceptable.

### Reactivación

El paso de `stopped` a `running` debe detectarse con latencia razonable.

La implementación futura puede usar:

- control con backoff;
- wake hint;
- mecanismo equivalente.

No se obliga todavía a una solución física concreta.

### Paused vs stopped

Se conserva la diferencia semántica:

- `paused`: existe intención de continuar el trabajo suspendido;
- `stopped`: no existe trabajo funcional activo.

Ambos estados deben ser de bajo consumo, pero no tienen por qué compartir exactamente la misma política de control.

### Observabilidad

Encaja con OBS-07:

- los cambios de estado se registran;
- el estado estable no genera spam continuo;
- el heartbeat y el logging quedan desacoplados.

### Límites

Esta aprobación:

- no apaga todavía el contenedor Railway;
- no activa sleep/serverless;
- no cambia autosuspend de Neon;
- no define todavía el mecanismo exacto de wake;
- no autoriza cambios en Production ahora.

### Invariante

> Un proceso funcional detenido no debe generar actividad continua sólo para confirmar que sigue detenido; la presencia del runtime y el estado funcional se observan por canales separados y de baja frecuencia.


---

## WKR-04 — Lease heartbeat propiedad del runtime

**APROBADA.**

### Decisión

La renovación básica del lease de cualquier child Batch será responsabilidad del runtime común, no de cada core funcional.

Cuando `executeClaimedItem()` o su equivalente empiece a ejecutar un item:

1. crea/inicia el child;
2. arranca un heartbeat automático de ejecución;
3. renueva periódicamente `process_runs.last_heartbeat_at` y `batch_run_items.lease_until`;
4. ejecuta el core funcional;
5. detiene siempre el heartbeat al terminar, fallar, cancelar o cerrar.

### Core funcional

Los cores pueden seguir emitiendo heartbeats/eventos funcionales para aportar contexto o progreso, pero ya no deben depender de esas llamadas manuales para mantener vivo el lease.

La seguridad temporal pertenece al runtime.

### Frecuencia

La frecuencia del heartbeat automático debe:

- guardar margen suficiente respecto al TTL del lease;
- evitar escrituras excesivas;
- ejecutarse sólo mientras haya un item realmente activo;
- detenerse de forma determinista al finalizar.

No se fija todavía un intervalo exacto.

### Recovery

Si el proceso muere de verdad:

- el heartbeat automático cesa;
- el lease expira;
- la reconciliación vigente puede recuperar/reencolar según la política;
- no se pierde el mecanismo actual de recuperación.

### Relación con WKR-01

- WKR-01 mantiene presencia/capacidad del worker.
- WKR-04 mantiene la vigencia del trabajo que ya está ejecutando.

Son señales distintas.

### Límites

Esta aprobación:

- no cambia todavía el TTL del lease;
- no cambia número de intentos;
- no modifica la política de retries de PROC-03;
- no autoriza cambios en Production ahora.

### Invariante

> Mientras un worker siga ejecutando legítimamente un child Batch, el runtime común debe mantener automáticamente vigente su lease; ningún core funcional debe depender de llamadas manuales de heartbeat para evitar una falsa expiración.


---

## WKR-05 — Drain seguro antes de reinicio o deploy

**APROBADA.**

### Decisión

Todo worker persistente que vaya a detenerse, reiniciarse o redeplegarse debe entrar primero, cuando el entorno lo permita, en un estado explícito de **drain**.

Secuencia canónica:

1. pasar a `DRAINING`;
2. dejar inmediatamente de reclamar trabajo nuevo;
3. mantener vivos los heartbeats de presencia y de los items ya activos;
4. permitir que las ejecuciones en vuelo finalicen normalmente;
5. confirmar ausencia de trabajo activo;
6. detener/reiniciar/redeplegar.

### Límite de drain

El drain no puede bloquear indefinidamente una operación de mantenimiento.

Debe existir un timeout explícito. Si una ejecución no termina dentro de ese margen:

- el worker deja de admitir trabajo nuevo igualmente;
- el apagado puede continuar;
- WKR-04 deja de renovar al morir el proceso;
- la lease expira;
- el recovery/retry canónico recupera la unidad según PROC-03 y el Batch Engine.

### Claims

Desde el instante en que un worker entra en `DRAINING`:

> no puede reclamar nuevos items.

Los items ya activos conservan ejecución normal hasta terminar o hasta que expire el límite de drain.

### Operaciones

WKR-01 debe permitir representar de forma explícita:

- worker `DRAINING`;
- número de items activos;
- motivo cuando sea relevante, por ejemplo deploy/mantenimiento;
- instante desde el que drena.

### Relación con PROC-10

PROC-10 decide **qué workers necesitan deploy**.

WKR-05 define **cómo se detienen de forma segura** los workers afectados.

Flujo futuro deseado:

`worker afectado → DRAINING → 0 trabajo activo → deploy → preflight WKR-01 → READY`.

### Disponibilidad

PikoFilm funciona actualmente con una réplica por servicio.

Por tanto, el objetivo no es prometer zero downtime, sino garantizar:

- trabajo durable;
- ausencia de claims nuevos durante drain;
- mínima interrupción de ejecuciones activas;
- recovery seguro cuando una ejecución no puede terminar;
- vuelta a servicio sólo después de readiness/capabilities válidas.

### Límites

Esta aprobación:

- no aumenta réplicas;
- no introduce blue/green deployment;
- no obliga todavía a automatizar el drain desde Railway;
- no cambia leases/retries;
- no autoriza cambios de Production ahora.

### Invariante

> Un worker que va a detenerse o redeplegarse debe dejar de aceptar trabajo nuevo antes de apagarse y, cuando sea posible, finalizar limpiamente sus ejecuciones activas antes de cederlas al mecanismo de recovery.



---

## WKR-06 — Política canónica de restart y fallo fatal

**APROBADA.**

### Decisión

Los workers persistentes deben compartir un contrato canónico de restart basado en la **causa real de terminación y su recurrencia**, no en cifras históricas arbitrarias distintas por servicio.

La política debe distinguir, de forma equivalente a:

- `EXPECTED_STOP`: parada limpia e intencionada;
- `DEPLOY_RESTART`: reinicio esperado por deploy o mantenimiento;
- `CRASH`: caída inesperada durante funcionamiento normal;
- `STARTUP_FAILURE`: fallo al arrancar por configuración, import, dependencia, incompatibilidad o condición equivalente;
- `RESOURCE_FAILURE`: muerte por memoria, recursos u otra condición de infraestructura equivalente.

No se fijan todavía nombres técnicos exactos ni códigos persistidos.

### Restart budget

Los fallos recuperables pueden provocar restart automático, pero siempre dentro de un **restart budget** limitado y observable.

La V5 debe eliminar como contrato objetivo diferencias arbitrarias como:

- FAST: 3 retries;
- API/Plex: 10 retries;
- Technical: `NEVER`.

El presupuesto definitivo podrá variar justificadamente por tipo de fallo o runtime, pero deberá derivarse de una política explícita y documentada.

Cuando se agota:

- el worker deja de intentar reinicios indefinidos;
- pasa a `UNAVAILABLE`;
- queda visible como incidencia operativa;
- deja de aceptar trabajo;
- requiere recuperación válida antes de volver a servicio.

### Reinicio no equivale a readiness

Un proceso que consigue volver a arrancar no está automáticamente preparado para consumir trabajo.

Después de cualquier restart, WKR-01 debe volver a validar como mínimo:

1. presencia/heartbeat vigente;
2. versión, build o deployment compatible;
3. capabilities/adapters requeridos;
4. preflight de dependencias necesario.

Sólo después puede volver a `READY` y reclamar trabajo.

### Terminaciones esperadas

`EXPECTED_STOP` y `DEPLOY_RESTART` no constituyen por sí solos una avería.

Cuando el entorno lo permita, los reinicios por deploy/mantenimiento deben seguir WKR-05:

`DRAINING → 0 trabajo activo o timeout de drain → restart → preflight → READY`.

### Trabajo activo durante un crash

Si el proceso muere con items activos:

- WKR-04 deja naturalmente de renovar sus leases;
- la lease expira;
- el mecanismo canónico de recovery/retry recupera las unidades según PROC-03 y Batch Engine;
- no se introduce un segundo mecanismo paralelo de recuperación.

### Observabilidad

Cada crash/restart relevante debe conservar evidencia suficiente para distinguir:

- causa de terminación;
- número de reinicios dentro de la ventana/budget;
- última recuperación;
- agotamiento del budget;
- transición posterior a `READY` o `UNAVAILABLE`.

Una recuperación posterior no borra el hecho histórico del crash.

### Límites

Esta aprobación:

- no fija todavía valores numéricos del restart budget;
- no cambia ahora configuración Railway Production;
- no aumenta réplicas;
- no introduce supervisor, Kubernetes ni plataforma nueva;
- no modifica retries funcionales de PROC-03;
- no autoriza migraciones ni mutaciones de Neon Production.

### Invariante

> Un worker se reinicia de acuerdo con la naturaleza y recurrencia del fallo, no por una cifra histórica arbitraria asociada al servicio; y un proceso reiniciado sólo vuelve a `READY` cuando demuestra de nuevo que está realmente preparado.

---

## WKR-07 — Deploy selectivo real por impacto de runtime

**APROBADA.**

### Decisión

Los despliegues Railway de PikoFilm deben determinar qué runtimes están realmente afectados por cada cambio y redeplegar únicamente esos servicios cuando el impacto pueda demostrarse de forma segura.

### Regla general

- cambio exclusivo de Plex → despliega Plex;
- cambio exclusivo de FAST → despliega FAST;
- cambio exclusivo de Technical → despliega Technical;
- cambio exclusivo de API → despliega API;
- cambios en módulos compartidos → despliegan sólo los runtimes que realmente consumen esos módulos;
- documentación, tests o cambios sin efecto runtime → no provocan redeploy Railway;
- cambios de infraestructura verdaderamente común → despliegan los servicios afectados;
- si el sistema no puede demostrar con seguridad el conjunto de runtimes afectados, se usa comportamiento conservador y se amplía el deploy antes que arriesgar incompatibilidad.

### Contrato de impacto

El selective deploy no puede depender sólo de rutas o nombres de carpetas. Debe existir un mapa verificable de dependencias/impacto entre código compartido, procesos y runtimes.

CI debe poder validar ese mapa y detectar incoherencias entre:

- archivos cambiados;
- módulos compartidos;
- adapters/procesos;
- runtimes Railway;
- Dockerfiles/builds afectados.

### Integración con decisiones previas

- PROC-10 decide qué runtime necesita deploy;
- WKR-05 define el drain seguro antes de detenerlo;
- WKR-06 gobierna restart y fallo fatal;
- WKR-01 valida que la nueva instancia esté realmente READY, con build y capabilities compatibles.

### Objetivo

Reducir reinicios, builds y riesgo operativo innecesarios sin sacrificar seguridad ni coherencia de despliegue.

### Límites

Esta aprobación:

- no añade réplicas;
- no introduce blue/green;
- no cambia la política de deploy de Vercel Production;
- no permite omitir un deploy cuando exista duda razonable sobre compatibilidad;
- no implementa todavía el mapa concreto de dependencias ni la automatización final.

### Invariante

> Un cambio sólo debe reiniciar los runtimes que realmente puedan verse afectados; cuando el impacto no pueda demostrarse con seguridad, PikoFilm debe preferir el deploy conservador antes que dejar servicios incompatibles.

---

## WKR-08 — CI valida los runtimes reales de Railway

**APROBADA.**

### Decisión

El CI de PikoFilm debe validar los runtimes reales que se despliegan en Railway, en lugar de asumir que una validación genérica en una sola versión de Node representa correctamente a todos los workers.

### Alcance

Para cada runtime afectado por un cambio, CI debe poder validar como mínimo:

- build de su Dockerfile real;
- versión Node efectiva;
- imports y compatibilidad ESM/CommonJS;
- arranque básico del worker;
- adapters/capabilities esperadas;
- variables de entorno obligatorias comprobables sin secretos reales;
- errores de sintaxis o incompatibilidades específicas del runtime.

### Integración con WKR-07

El selective deploy y el selective validation comparten el mismo mapa de impacto:

- Plex afectado → validar runtime Plex;
- API afectada → validar runtime API;
- FAST afectado → validar runtime FAST;
- Technical afectado → validar runtime Technical;
- código compartido → validar todos los runtimes consumidores;
- documentación/tests sin efecto runtime → no construir imágenes Railway;
- ante duda sobre impacto → ampliar validación de forma conservadora.

### Objetivo

Evitar estados en los que GitHub CI esté verde pero Railway falle después por diferencias reales de Node, Docker, módulos o arranque.

### Límites

Esta aprobación:

- no obliga todavía a homogeneizar versiones Node;
- no ejecuta procesos funcionales contra Production;
- no requiere secretos reales en CI;
- no sustituye tests unitarios/contratos ya existentes;
- no define todavía la implementación final del mapa de impacto.

### Invariante

> El código que puede desplegarse en un runtime Railway debe validarse en CI con un entorno equivalente al runtime real que lo ejecutará.

---

## WKR-09 — Contrato único de runtime Node y módulos ESM

**APROBADA.**

### Decisión

PikoFilm debe declarar explícitamente el runtime Node y el modelo de módulos esperado por cada worker, reduciendo diversidad cuando no aporte valor técnico y eliminando ambigüedades ESM/CommonJS.

### Runtime Node

- se definirá una versión Node objetivo común para los workers compatibles;
- una versión distinta sólo se mantendrá cuando exista una razón técnica real y documentada;
- los upgrades de Node serán explícitos, versionados y validados antes de producción;
- ningún cambio de imagen Docker podrá alterar accidentalmente la versión Node efectiva.

### Módulos

Cada runtime debe tener un contrato claro y coherente de módulos:

- package.json;
- extensiones .mjs/.cjs cuando correspondan;
- imports/exports;
- loaders o flags sólo cuando sean realmente necesarios;
- ausencia de ambigüedad que provoque MODULE_TYPELESS_PACKAGE_JSON.

Los warnings estructurales de módulos no deben aceptarse como ruido normal si Railway los clasifica como errores.

### Integración con WKR-08

CI debe comprobar el runtime declarado de cada servicio afectado y detectar incompatibilidades de Node, imports, ESM/CommonJS o arranque antes del merge.

### Objetivo

Reducir diferencias de comportamiento entre API, FAST, Plex y Technical y evitar fallos que sólo aparecen porque el mismo código se ejecuta bajo versiones Node o reglas de módulos distintas.

### Límites

Esta aprobación:

- no obliga a que los cuatro servicios terminen necesariamente en la misma versión Node;
- no fija todavía cuál será la versión objetivo;
- no autoriza cambios inmediatos de imágenes Docker en Production;
- no sustituye las validaciones específicas de cada runtime.

### Invariante

> Cada worker debe ejecutar sobre un runtime Node y un modelo de módulos explícitos, versionados y reproducibles; la diversidad sólo se conserva cuando existe una razón técnica demostrable.

---

## WKR-10 — Estado real de workers visible en Operaciones

**APROBADA.**

### Decisión

Operaciones debe ser la superficie canónica de PikoFilm para entender el estado funcional de los workers, apoyándose en el contrato durable de presencia de WKR-01 y sin duplicar innecesariamente la observabilidad propia de Railway.

### Información mínima por worker/pool

- estado operativo: STARTING / READY / BUSY / DRAINING / UNAVAILABLE;
- versión/build desplegado;
- heartbeat o última señal vigente;
- capacidad y concurrencia declaradas;
- adapters/procesos/capabilities disponibles;
- trabajo activo actual;
- demanda/cola pendiente para ese pool;
- estado de idle/backoff cuando aplique;
- drain activo y motivo;
- último restart/crash relevante;
- incompatibilidad de versión/capability si existe.

### Separación fundamental

Operaciones debe distinguir estado del worker y estado del trabajo.

Ejemplo:

- READY + 0 trabajos = estado sano;
- trabajo pendiente + 0 workers READY = incidencia operativa;
- Technical stopped funcionalmente + runtime READY = estado sano, no error.

### Frontera con Railway

PikoFilm no intentará replicar todo Railway.

CPU, memoria, build logs completos, métricas de infraestructura y administración del servicio siguen perteneciendo a Railway.

Operaciones muestra únicamente el estado funcional necesario para administrar PikoFilm y explicar por qué el trabajo puede o no ejecutarse.

### Integración

- WKR-01 aporta presencia/version/capabilities;
- WKR-05 aporta DRAINING y motivo;
- WKR-06 aporta restart/fallo fatal y UNAVAILABLE;
- WKR-02 aporta idle/backoff;
- OBS-01/OBS-07 aportan semántica de señal útil sin ruido.

### Límites

Esta aprobación:

- no convierte Operaciones en una copia de Railway;
- no exige replicar logs completos de infraestructura;
- no define todavía el diseño visual final;
- no modifica número de workers ni topología.

### Invariante

> PikoFilm debe poder explicar desde Operaciones si cada worker está disponible para ejecutar trabajo y por qué, sin inferirlo a partir de la existencia de runs ni obligar al usuario a correlacionar manualmente Neon y Railway.

---

## WKR-11 — Wake hint ligero productor → worker

**APROBADA.**

### Decisión

PikoFilm incorporará un mecanismo ligero de wake hint para reducir la latencia de detección de trabajo nuevo cuando los workers estén en backoff/idle, sin convertir esa señal en fuente de verdad ni dependencia crítica.

### Contrato

Cuando se cree trabajo para un pool:

- el trabajo se persiste normalmente en Neon;
- además puede emitirse una señal ligera de wake para ese pool;
- el worker sale de idle/backoff y vuelve a consultar la cola;
- si la señal se pierde, el trabajo sigue seguro y será detectado por polling adaptativo;
- señales duplicadas son inocuas;
- múltiples trabajos próximos pueden coalescerse en una sola señal.

### Fuente de verdad

Neon y el Batch Engine siguen siendo la fuente durable de trabajo.

El wake hint únicamente acelera la detección. No crea, modifica ni confirma trabajo funcional.

### Fallos seguros

- wake perdido → seguro;
- wake duplicado → seguro;
- worker no disponible → la demanda permanece pendiente;
- señal recibida sin trabajo → vuelve a idle sin efecto funcional.

### Integración

- WKR-02 aporta idle/backoff adaptativo;
- WKR-01 confirma presencia y transición READY/BUSY;
- WKR-10 permite ver demanda pendiente aunque no exista consumidor disponible.

### Infraestructura

La implementación debe buscar primero el mecanismo más pequeño compatible con la arquitectura actual.

No se introduce Redis, RabbitMQ, Kafka u otra plataforma salvo necesidad demostrada posteriormente.

### Límites

Esta aprobación:

- no activa Railway sleep/serverless;
- no permite depender exclusivamente del wake;
- no sustituye el polling adaptativo como red de seguridad;
- no cambia la durabilidad ni semántica de la cola.

### Invariante

> El wake hint puede acelerar el trabajo, pero su pérdida nunca puede provocar pérdida, bloqueo indefinido ni inconsistencia de trabajo.

---

## WKR-12 — Suspensión física sólo cuando wake/recovery estén demostrados

**APROBADA.**

### Decisión

PikoFilm preparará sus workers para poder entrar en suspensión física o scale-to-zero cuando exista beneficio material, pero no activará ese comportamiento hasta demostrar previamente wake, recovery, observabilidad y tiempos de arranque seguros.

### Precondiciones

Antes de suspender físicamente un pool deben estar funcionando y validadas:

- WKR-01: presencia/version/capabilities vigentes;
- WKR-02: idle/backoff adaptativo;
- WKR-11: wake hint fiable con polling como respaldo;
- recovery por leases y retries existente;
- Operaciones capaz de distinguir dormido de UNAVAILABLE.

### Despliegue gradual

La suspensión real se evaluará pool por pool.

Technical es el candidato natural para una primera prueba porque puede permanecer funcionalmente detenido durante largos periodos.

API, FAST y Plex sólo se evaluarán después si los datos reales demuestran beneficio y la latencia de wake es aceptable.

### Pruebas obligatorias

Antes de activar suspensión real debe demostrarse al menos:

- que nuevo trabajo despierta el servicio;
- que un wake perdido sigue recuperándose;
- que deploy/restart no pierde demanda;
- que el arranque ocurre dentro de una latencia aceptable;
- que no se rompen leases, drains ni retries;
- que Operaciones representa correctamente el estado dormido.

### Criterio económico

No se añadirá complejidad operacional únicamente para obtener un ahorro irrelevante. El beneficio real se contrastará en el Punto 14 — Coste.

### Frontera Neon

Esta decisión no modifica el autosuspend de Neon. Neon Production mantiene una decisión separada de compute y coste.

### Límites

Esta aprobación:

- no activa Railway sleep/serverless ahora;
- no autoriza scale-to-zero en Production;
- no cambia autosuspend de Neon;
- no obliga a que todos los pools puedan dormir;
- no añade una nueva plataforma.

### Invariante

> Ningún worker debe apagarse físicamente mientras PikoFilm no pueda demostrar que la demanda durable lo despertará o será recuperada de forma segura, observable y con latencia aceptable.
