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
