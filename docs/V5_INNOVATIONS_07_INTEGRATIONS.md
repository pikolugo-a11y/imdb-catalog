# PikoFilm V5 — Innovaciones Punto 7 · Integraciones externas

Estado: **Fase 3 COMPLETADA — 5/5 innovaciones revisadas una a una**.

Sólo las innovaciones expresamente aprobadas se incorporarán a `docs/ROADMAP_INNOVADOR.md`.

## INNO-INT-01 — PikoFilm Integration Fabric

**Estado: RECHAZADA**  
**Fecha: 2026-09-20**

### Propuesta evaluada

Extraer las integraciones externas fuera del núcleo de PikoFilm y convertirlas en una capa independiente de adquisición de evidencia, desacoplando procesos funcionales de proveedores concretos.

### Decisión

**RECHAZADA.**

No se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Alcance de la decisión

Se mantiene la estrategia V5 ya aprobada de clientes canónicos, gobierno común, autoridad por dato, health y contratos explícitos dentro de la arquitectura actual, sin introducir una nueva capa distribuida de Integration Fabric.


## INNO-INT-02 — PikoFilm Shadow Sources

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Propuesta evaluada

Permitir que PikoFilm ejecute temporalmente una fuente externa alternativa en paralelo con la fuente oficial vigente, sin autoridad funcional ni capacidad de modificar datos canónicos.

La fuente sombra podrá medir, sobre tráfico y entidades reales:

- coincidencia y discrepancias frente a la fuente oficial;
- cobertura;
- latencia;
- errores y disponibilidad;
- frescura;
- cuota/coste;
- calidad y granularidad por tipo de dato.

### Decisión

**APROBADA.**

Se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Guardrails

- La fuente sombra nunca escribe verdad canónica.
- No participa en Lifecycle, Calidad, catálogo ni fallbacks mientras esté en modo sombra.
- Los experimentos serán temporales, acotados por muestra, duración y cuota.
- Una mejora observada no autoriza sustitución automática del proveedor oficial.
- Cualquier promoción de una fuente sombra requerirá decisión posterior explícita.

### Relación con otras capacidades

Sentinel valida que una integración funciona de extremo a extremo. Shadow Sources evalúa si otra integración o estrategia sería objetivamente mejor antes de sustituir la actual.


## INNO-INT-03 — PikoFilm Source Trust Ledger

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Propuesta evaluada

Construir una memoria histórica objetiva de fiabilidad por integración y por tipo de dato, evitando valoraciones globales simplistas de cada proveedor.

El ledger podrá conservar, con granularidad suficiente:

- coincidencias y discrepancias entre fuentes;
- correcciones posteriores;
- cambios confirmados;
- estabilidad/frescura histórica;
- errores, timeouts y rate limits;
- decisiones manuales que contradijeron una fuente;
- evidencia posterior que permita determinar qué fuente terminó alineándose mejor con la verdad confirmada.

### Decisión

**APROBADA.**

Se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Guardrails

- La matriz de autoridad de INT-06 sigue siendo la regla funcional canónica.
- El Trust Ledger no cambia automáticamente la autoridad de una fuente.
- Coincidir con otras fuentes no equivale a tener razón; sólo se considerará evidencia confirmada con reglas explícitas.
- Cualquier ajuste automático futuro de prioridad o fallback requerirá una decisión posterior específica.
- Las métricas deberán segmentarse por dato/contexto cuando el comportamiento de una fuente difiera por dominio, antigüedad, mercado u otra dimensión relevante.

### Relación con otras capacidades

Shadow Sources compara una candidata durante un experimento. Source Trust Ledger conserva la reputación histórica observada de las fuentes a lo largo del tiempo.


## INNO-INT-04 — PikoFilm Source Replay Lab

**Estado: RECHAZADA**  
**Fecha: 2026-09-24**

### Propuesta evaluada

Crear un laboratorio de replay de integraciones basado en un corpus limitado y saneado de respuestas reales históricas para probar parsers, fallbacks y clientes sin volver a llamar al proveedor.

### Decisión

**RECHAZADA.**

No se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Alcance de la decisión

Se mantiene la validación mediante tests, contratos, Sentinel y demás mecanismos aprobados, sin añadir por ahora un corpus histórico específico de payloads reales para replay.


## INNO-INT-05 — PikoFilm Adaptive Source Router

**Estado: APROBADA**  
**Fecha: 2026-09-24**

### Propuesta evaluada

Permitir que PikoFilm elija dinámicamente qué fuente autorizada consultar primero para un tipo de dato cuando existan varias rutas válidas, usando señales operativas reales.

Las señales podrán incluir:

- health actual de la integración;
- rate limit y cuota restante;
- latencia reciente;
- confianza histórica del Source Trust Ledger;
- frescura de la última evidencia;
- coste de llamada;
- disponibilidad de fallback;
- contexto del título o serie.

### Decisión

**APROBADA.**

Se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Guardrails

- INT-06 sigue definiendo la autoridad funcional por dato.
- El router no puede saltarse una fuente obligatoria cuando la regla funcional la exige.
- Toda decisión adaptativa relevante debe ser explicable y observable.
- No puede elevar cuotas, concurrencia o coste fuera de límites aprobados.
- Cualquier autonomía adicional sobre autoridad o sustitución de proveedores requiere decisión futura explícita.

### Relación con otras capacidades

Shadow Sources permite evaluar alternativas; Source Trust Ledger acumula reputación histórica; Adaptive Source Router usa esas señales operativas para seleccionar la ruta de consulta más adecuada sin alterar la autoridad canónica.


## Cierre de la Fase 3

**COMPLETADA.** Se revisaron las 5 innovaciones mínimas del Punto 7:

- INNO-INT-01 — PikoFilm Integration Fabric: **RECHAZADA**.
- INNO-INT-02 — PikoFilm Shadow Sources: **APROBADA**.
- INNO-INT-03 — PikoFilm Source Trust Ledger: **APROBADA**.
- INNO-INT-04 — PikoFilm Source Replay Lab: **RECHAZADA**.
- INNO-INT-05 — PikoFilm Adaptive Source Router: **APROBADA**.

El Punto 7 queda listo para cierre formal: Fase 1 completa, INT-01 a INT-10 aprobadas y Fase 3 completada.
