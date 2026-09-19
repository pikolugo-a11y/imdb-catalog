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
