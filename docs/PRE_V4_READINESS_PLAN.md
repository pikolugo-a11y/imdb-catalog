# PikoFilm — Plan maestro de cierre V3 y preparación V4

> **Documento persistente y canónico para preparar PikoFilm V4.**
>
> Creado: 2026-09-01
> Repositorio: `pikolugo-a11y/imdb-catalog`
>
> Este documento existe para que el trabajo pueda retomarse desde cualquier chat o sesión sin depender del contexto conversacional. Antes de iniciar V4 debe recorrerse y actualizarse este plan.

## 1. Objetivo

PikoFilm está muy cerca de una versión funcionalmente finalizada. Antes de añadir funcionalidades V4 se realizará una fase formal de **V3 Finalization / V4 Readiness** cuyo objetivo es dejar el sistema:

- limpio de código e infraestructura legacy;
- con una arquitectura única y comprensible;
- con Neon depurado y documentado;
- con Railway reducido a servicios realmente necesarios;
- con GitHub libre de temporales, workflows y issues obsoletos;
- con todos los procesos unitarios, globales, Batch y automáticos inventariados;
- con documentación funcional, técnica y operativa completa;
- con UX revisada de extremo a extremo;
- con deuda técnica conocida y cuantificada;
- y con un roadmap V4 basado en el sistema real, no en documentación histórica.

**Regla principal:** no comenzar desarrollo funcional V4 hasta superar el gate final de este documento.

## 2. Principios de trabajo

1. **El sistema vivo manda.** Código, esquema real de Neon, servicios efectivos y comportamiento actual tienen prioridad sobre documentación antigua.
2. **Auditar antes de borrar.** Ningún elemento dudoso se elimina sin comprobar consumidores, dependencias, datos y efecto operativo.
3. **Una responsabilidad, una implementación canónica.** Versiones V1/V2/V3, aliases y compatibilidad histórica deben desaparecer cuando ya no sean necesarios.
4. **Batch reutiliza lógica canónica.** No debe existir una segunda implementación funcional divergente para procesamiento masivo.
5. **Cambios destructivos verificables.** Limpieza de Neon mediante migraciones seguras; infraestructura sólo después de demostrar que no tiene consumidores.
6. **Git conserva la historia.** Limpiar la versión actual no significa reescribir el historial del repositorio.
7. **Documentar el presente, no la cronología.** La documentación final debe explicar cómo funciona PikoFilm hoy.
8. **Issues abiertas = trabajo futuro real.** Las decisiones terminadas, sustituidas o históricas deben cerrarse.
9. **No hacer deployments automáticamente.** Se mantiene la regla operativa vigente del proyecto salvo decisión expresa posterior.
10. Cada fase debe terminar con evidencia y una decisión explícita antes de avanzar a la siguiente cuando exista riesgo destructivo.

## 3. Estado inicial observado al crear este plan

Estos puntos son pistas iniciales y deben verificarse durante la auditoría, no tratarse como conclusiones definitivas:

- La documentación existente está parcialmente desfasada respecto al sistema vivo.
- `package.json` declara actualmente varios runtimes/workers (`lifecycle`, `imdb-discovery`, `batch-fast`, `batch-api`, `batch-plex`).
- Railway presenta servicios activos para API worker, Batch FAST y Technical Snapshot, además de un servicio temporal/backup sin deployment observado que debe investigarse.
- Neon corresponde al proyecto `pikofilm`, PostgreSQL 18, con una única rama `production` en el momento de la revisión inicial.
- Existen nombres y capas generacionales V1/V2/V3/V4 que deben clasificarse.
- Existen dos ubicaciones de migraciones que deben justificarse o consolidarse.
- Existen temporales, probes, diagnósticos y workflows puntuales que deben auditarse.
- La issue maestra de procesos #273 ya identifica legacy físico pendiente de retirar y sirve como material de partida, pero no será la fuente final de verdad.

## 4. Clasificación obligatoria durante la auditoría

Cada pieza relevante se clasificará como una de las siguientes:

- **CANONICAL** — implementación vigente y fuente de verdad.
- **COMPATIBILITY** — compatibilidad todavía necesaria, con motivo y condición de retirada.
- **DUPLICATE** — responsabilidad cubierta por otra implementación.
- **DEAD** — sin consumidores ni función vigente.
- **LEGACY** — arquitectura anterior sustituida.
- **TEMP** — diagnóstico, migración puntual, prueba o recurso temporal.
- **UNKNOWN** — uso no demostrado; bloquea eliminación hasta resolverlo.

La matriz de trabajo debe registrar, como mínimo:

`Elemento → consumidores → datos → infraestructura → tests → clasificación → riesgo → decisión → acción`.

---

# FASE P0 — Baseline V3

## Objetivo

Crear una fotografía inequívoca de la versión que estamos cerrando.

## Trabajo

- Registrar commit de `main` usado como baseline.
- Revisar estado de CI.
- Inventariar ramas relevantes.
- Inventariar workflows y su función.
- Inventariar servicios Railway y deployments.
- Inventariar proyecto/rama/esquema Neon.
- Inventariar rutas principales de la aplicación.
- Inventariar variables/configuración por responsabilidad sin documentar secretos.
- Registrar procesos conocidos y executors.
- Crear rama dedicada de limpieza si procede.

## Salida

Un baseline reproducible que permita comparar todo el trabajo PRE-V4.

---

# FASE P1 — Auditoría exhaustiva del repositorio

## Objetivo

Comprender el 100 % de las piezas relevantes antes de eliminar legacy.

## Revisar

- imports y consumidores reales;
- exports sin uso;
- Server Actions y APIs sin consumidor;
- componentes React sin montar;
- rutas antiguas y redirects;
- CSS importado/no importado y generaciones coexistentes;
- módulos V1/V2/V3/V4;
- implementaciones duplicadas;
- operaciones unitarias frente a Batch;
- workers y runtimes;
- Dockerfiles;
- configuraciones Railway;
- workflows GitHub Actions;
- scripts operativos;
- `tmp/`, probes, diagnósticos y hotfixes;
- migraciones y scripts ya aplicados;
- dependencias npm;
- tests y contratos;
- variables de entorno históricas;
- read models/writers de generaciones distintas;
- aliases y capas de compatibilidad;
- código conocido como legacy en #273, incluyendo vías antiguas de Identidad/Validación/Series/Novedades/Discovery cuando sigan presentes.

## Salida

Matriz completa **BORRAR / CONSOLIDAR / RENOMBRAR / CONSERVAR / INVESTIGAR**.

No se realizarán borrados dudosos antes de completar esta clasificación.

---

# FASE P2 — Limpieza física de GitHub y código

## Objetivo

Dejar un repositorio cuya estructura represente la arquitectura actual.

## Trabajo

- retirar código DEAD/LEGACY/TEMP demostrado;
- consolidar duplicados;
- retirar aliases vencidos;
- normalizar nombres canónicos y evitar sufijos históricos innecesarios;
- decidir/consolidar ubicaciones de migraciones;
- retirar temporales y probes;
- retirar diagnósticos de títulos concretos;
- retirar workflows one-shot ya terminados;
- retirar scripts de migración sin función futura cuando sea seguro;
- retirar Dockerfiles/configuraciones de servicios inexistentes;
- retirar documentación circunstancial sustituida;
- actualizar tests después de retirar código;
- revisar dependencias npm;
- ejecutar build y suite completa.

## Criterio de salida

Alguien nuevo debe poder navegar el repositorio sin tener que adivinar cuál de varias generaciones es la vigente.

---

# FASE P3 — Auditoría y limpieza de Neon

## Objetivo

Dejar PostgreSQL como modelo de datos canónico, eficiente y documentado.

## Inventario obligatorio

- schemas;
- tablas;
- vistas y materialized views;
- secuencias;
- índices;
- constraints;
- funciones;
- triggers;
- tamaños;
- cardinalidad;
- lectores en código;
- writers en código;
- retención;
- relación con procesos y Lifecycle.

## Clasificación de datos

Cada estructura se marcará como:

- **CANÓNICA**;
- **READ MODEL**;
- **COMPATIBILIDAD TEMPORAL**;
- **REGENERABLE**;
- **LEGACY**;
- **UNKNOWN**.

## Revisiones específicas

- tablas vacías;
- columnas legacy;
- tablas/runs de arquitecturas anteriores;
- coexistencia de `pipeline_runs`, `batch_*`, `series_quality_runs`, estados PikoQuality/People u otros modelos de ejecución;
- JSON/payloads grandes;
- logs sin retención;
- runs/checkpoints antiguos;
- snapshots;
- cachés;
- índices duplicados o inútiles;
- índices ausentes en consultas calientes;
- bloat y coste;
- constraints/secuencias huérfanos;
- datos derivados que puedan regenerarse;
- fuente de verdad de cada dominio.

## Regla destructiva

Los cambios de esquema/datos estructurales se harán mediante migraciones revisables y verificables, no mediante borrados improvisados en producción.

## Salida

`DATA_ARCHITECTURE` + esquema limpio + política clara de retención y regeneración.

---

# FASE P4 — Limpieza de Railway y execution plane

## Objetivo

Mantener únicamente infraestructura que tenga una responsabilidad real y documentada.

## Trabajo

- cruzar servicios Railway con workers del repositorio;
- cruzar cada servicio con Dockerfile/configuración;
- comprobar variables y dependencias;
- identificar servicios sin deployments o sin consumidores;
- revisar el servicio temporal/backup observado;
- comprobar necesidad real de FAST/API/Plex/Lifecycle/Technical y cualquier otro executor;
- eliminar configuraciones y servicios huérfanos sólo tras verificación;
- revisar restart policies, health, concurrencia y coste;
- normalizar nombres evitando versiones históricas si ya existe una única implementación canónica.

## Arquitectura objetivo a validar

- **Vercel:** UI/control plane.
- **Neon:** data/state plane.
- **Railway:** execution plane pesado/persistente según responsabilidad.
- **GitHub Actions:** sólo tareas para las que exista una razón explícita; no motor continuo del Lifecycle.

La división exacta de workers se decidirá por responsabilidades reales, no por esta propuesta inicial.

---

# FASE P5 — Catálogo definitivo de procesos y Batch

## Objetivo

Poder explicar cualquier trabajo que PikoFilm ejecuta de principio a fin.

## Para cada proceso documentar

`trigger → UI/API → operación canónica → executor → fuentes externas → tablas leídas → tablas escritas → Lifecycle before/after → observabilidad → error → retry → idempotencia → Batch → infraestructura`.

Además registrar:

- individual/global;
- manual/automático;
- síncrono/asíncrono;
- lightweight/heavy;
- runtime;
- heartbeat;
- pause/resume/cancel;
- timeout;
- retry/backoff;
- circuit breaker;
- rate limit/cuota;
- concurrencia;
- caché;
- dependencias;
- efectos secundarios;
- coste aproximado cuando sea relevante.

## Regla Batch

Batch debe orquestar/reutilizar operaciones canónicas. Cualquier divergencia funcional entre ejecución unitaria y masiva se clasifica como deuda prioritaria.

## Fuente inicial

Usar #273 y sus PROC como inventario de partida, comprobarlos contra código vivo y finalmente sustituir la issue como fuente de verdad por documentación versionada.

---

# FASE P6 — Documentación definitiva de PikoFilm

## Objetivo

Que la aplicación pueda entenderse, operarse y mantenerse sin depender de conversaciones previas.

## Estructura objetivo propuesta

```text
docs/
  README.md
  architecture/
    SYSTEM_ARCHITECTURE.md
    DATA_ARCHITECTURE.md
    EXECUTION_ARCHITECTURE.md
    OBSERVABILITY.md
    EXTERNAL_SOURCES.md
  product/
    FUNCTIONAL_SPECIFICATION.md
    LIFECYCLE.md
    UX_INFORMATION_ARCHITECTURE.md
  processes/
    PROCESS_CATALOG.md
    BATCH_ARCHITECTURE.md
    PLEX.md
    PIKOQUALITY.md
    DISCOVERY.md
  operations/
    RUNBOOK.md
    RAILWAY.md
    NEON.md
    VERCEL.md
    GITHUB_ACTIONS.md
    INCIDENT_RECOVERY.md
    BACKUP_RESTORE.md
  development/
    REPOSITORY_STRUCTURE.md
    LOCAL_DEVELOPMENT.md
    TESTING.md
    MIGRATIONS.md
    CONTRIBUTING.md
  V4_ROADMAP.md
  CHANGELOG.md
```

La estructura podrá ajustarse durante el trabajo para evitar documentación artificialmente fragmentada.

## Diagramas mínimos

- arquitectura física;
- Lifecycle;
- Novedades → Catálogo;
- películas;
- series;
- Plex;
- Personas;
- Sagas;
- PikoQuality;
- Batch;
- observabilidad;
- ejecución de un job;
- fronteras Vercel/Neon/Railway/GitHub.

## Limpieza documental

Una vez creada la documentación canónica:

- retirar documentos históricos que contradigan el presente;
- consolidar roadmaps anteriores;
- conservar sólo historia que tenga valor explícito;
- evitar varias fuentes de verdad para el mismo concepto.

---

# FASE P7 — Limpieza completa de Issues

## Objetivo

Que la lista de issues abiertas represente exclusivamente trabajo futuro real.

## Decisiones

- **completed:** implementado y verificado;
- **superseded/not planned:** sustituido o descartado;
- **consolidar:** duplicados absorbidos por una issue canónica;
- **reescribir:** parcialmente vigente;
- **V4 backlog:** mejora futura válida.

No se eliminará historia útil si cerrar/consolidar mantiene mejor trazabilidad.

Cuando `PROCESS_CATALOG.md` sea canónico y #273 deje de aportar trabajo pendiente, cerrar #273.

---

# FASE P8 — Auditoría funcional y UX completa

## Objetivo

Recorrer PikoFilm como producto y comprobar coherencia entre todas sus ventanas.

## Pantallas/dominos a revisar

Como mínimo:

- Home;
- Catálogo;
- ficha película;
- ficha serie;
- Novedades;
- Calidad y todas sus colas;
- Series y detalle;
- Personas;
- Sagas;
- PikoQuality;
- Excluidas;
- Plex/compatibilidad si sigue existiendo;
- Admin;
- Operaciones;
- Batch;
- runs, errores y diagnósticos visibles.

## Seis capas de revisión

### 1. Propósito
Cada pantalla debe tener una responsabilidad explicable en una frase.

### 2. Arquitectura de información
Jerarquía, orden, separación consulta/administración y densidad.

### 3. Lenguaje
Mismos conceptos y acciones deben utilizar terminología consistente en toda la aplicación.

### 4. Componentes
Headers, cards, tablas, badges, botones, filtros, menús, paginación, modales, empty/loading/error/success states.

### 5. Interacción
Navegación, back, URL state, confirmaciones, acciones destructivas, disabled/loading, doble ejecución, feedback, responsive, teclado y accesibilidad.

### 6. Coherencia funcional
El estado mostrado en una pantalla debe significar exactamente lo mismo en las demás y corresponder al modelo canónico.

## Salida

Auditoría UX consolidada con hallazgos clasificados por severidad y propuestas V4.

---

# FASE P9 — Auditoría transversal

## Rendimiento

- queries lentas;
- N+1;
- cargas de tablas grandes;
- paginación;
- payloads;
- tamaño cliente;
- caching.

## Coste

- transferencia Neon;
- compute;
- workers persistentes;
- llamadas externas;
- snapshots;
- retención.

## Observabilidad

Cualquier ejecución importante debe poder explicarse sin inspección SQL manual.

## Robustez

- errores silenciosos;
- idempotencia;
- atomicidad;
- concurrencia;
- doble ejecución;
- timeouts;
- recuperación tras caída.

## Seguridad

- secretos;
- endpoints administrativos;
- inputs;
- SQL;
- autorización;
- redirects;
- exposición accidental de información sensible.

## Accesibilidad

- teclado;
- focus;
- labels;
- contraste;
- responsive/móvil.

## Resiliencia

Definir comportamiento ante caída o degradación de Neon, Railway, Plex, TMDb, MDBList, FilmAffinity y demás fuentes.

## Testing

Mapear qué contratos protegen cada proceso y qué áreas carecen de cobertura significativa.

---

# FASE P10 — Roadmap V4

El roadmap sólo se cerrará después de las auditorías anteriores.

## Categorías

### V4.0 — Deuda necesaria
Problemas que amenacen coherencia, datos, operación o mantenibilidad.

### V4.1 — UX / producto
Mejoras de claridad, navegación, consistencia y experiencia.

### V4.2 — Potencia funcional
Nuevas capacidades de producto validadas contra la arquitectura final.

### V4.3 — Optimización
Rendimiento, costes, observabilidad, cachés, índices y ejecución.

## Evaluación de cada propuesta

`valor → coste → riesgo → dependencias → complejidad → prioridad`.

Ninguna propuesta entra automáticamente por existir en una issue V3 antigua.

---

# GATE FINAL — V3 cerrada / V4 Ready

No declarar PikoFilm preparada para V4 hasta cumplir todos los puntos aplicables:

- [ ] baseline V3 registrado;
- [ ] cero legacy conocido sin decisión;
- [ ] cero código UNKNOWN relevante;
- [ ] cero servicios Railway misteriosos;
- [ ] cero tablas/estructuras Neon misteriosas;
- [ ] cero workflows sin responsabilidad documentada;
- [ ] procesos unitarios y Batch alineados o deuda explícita priorizada;
- [ ] documentación coincide con producción;
- [ ] issues abiertas exclusivamente de futuro;
- [ ] build verde;
- [ ] suite de tests/contratos verde;
- [ ] rutas principales revisadas;
- [ ] todos los procesos inventariados;
- [ ] arquitectura física documentada;
- [ ] arquitectura de datos documentada;
- [ ] runbook operativo disponible;
- [ ] recuperación/incidentes documentados;
- [ ] UX auditada de extremo a extremo;
- [ ] rendimiento/coste/seguridad revisados;
- [ ] backlog V4 priorizado.

Una vez superado el gate, valorar crear tag/release conceptual **`v3-final`** y comenzar V4 desde ese punto.

---

# Orden operativo recomendado

1. P0 — baseline.
2. P1 — inventario completo.
3. Revisar juntos la matriz de decisiones.
4. P2 — limpieza del repositorio.
5. P3 — Neon.
6. P4 — Railway/execution plane.
7. P5 — procesos y Batch.
8. P6 — documentación final.
9. P7 — issues.
10. P8 — funcional/UX.
11. P9 — auditoría transversal.
12. P10 — roadmap V4.
13. Gate V3 Final.

Las fases pueden solaparse cuando sea seguro, pero no se debe utilizar ese solapamiento para saltarse verificaciones destructivas.

---

# Cómo retomar este trabajo en otro chat

Mensaje recomendado:

> **Seguimos con PikoFilm. Lee `docs/PRE_V4_READINESS_PLAN.md` del repositorio `pikolugo-a11y/imdb-catalog`, comprueba el estado persistente actual de GitHub/Neon/Railway y continúa desde la primera fase PRE-V4 que no esté cerrada. No des por válido el estado de una conversación anterior si el sistema vivo lo contradice.**

Al cerrar cada bloque importante, actualizar este documento o la documentación canónica correspondiente para que el progreso no dependa del chat.

---

# Estado del plan

**PRE-V4 READINESS: INICIADO — pendiente de P0/P1.**

Próximo trabajo recomendado: **P0 Baseline + P1 Inventario exhaustivo**, sin borrados destructivos hasta disponer de la matriz de clasificación.
