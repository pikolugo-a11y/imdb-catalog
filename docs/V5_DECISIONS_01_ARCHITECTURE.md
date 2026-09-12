# PikoFilm V5 — Decisiones 01: Arquitectura general

Estado: **EN REVISIÓN**  
Rama de trabajo: `roadmap/v5-01-architecture-decisions`

Este documento registra las decisiones del Punto 1 — Arquitectura general. Cada decisión se persiste antes de pasar a la siguiente propuesta.

## ARQ-01 — Sacar `PROC-NOV-009` de la ejecución larga de Vercel

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

Vercel conservará la responsabilidad de iniciar y controlar la operación, pero no ejecutará la sincronización global de Plex de larga duración. La ejecución real de `PROC-NOV-009` se moverá a un executor durable en Railway, preferentemente al pool Plex, utilizando Neon como estado y coordinación durable.

### Comportamiento esperado

- El usuario seguirá iniciando la sincronización desde PikoFilm de forma manual.
- Vercel creará/encolará el trabajo y responderá rápidamente.
- Railway ejecutará la sincronización hasta completar, sin depender del límite temporal de una Server Action de Vercel.
- Neon mantendrá el estado canónico del run, progreso, eventos y resultado.
- Actividad/Operaciones seguirán mostrando el estado y resultado al usuario.
- No se introduce automatización nueva de Plex por esta decisión; sólo cambia el lugar de ejecución.

### Motivo

La auditoría detectó que `PROC-NOV-009` es trabajo pesado que actualmente contradice la frontera arquitectónica Vercel=control / Railway=ejecución durable. La incidencia real de timeout/504 y el límite preventivo de 280 s demuestran que mantener esta operación dentro de Vercel es frágil.

### Alcance V5

Esta decisión define la dirección arquitectónica. La implementación concreta se diseñará después de cerrar el roadmap V5 y deberá preservar trazabilidad, idempotencia, recuperación y UX existentes.

## ARQ-02 — Gateway único para lanzar trabajo largo

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 tendrá una única capa canónica para solicitar ejecuciones durables, de modo que las superficies de producto, automatizaciones y orquestadores pidan la ejecución de un proceso sin conocer directamente los detalles de la infraestructura que lo ejecuta.

La interfaz conceptual será equivalente a `enqueueProcess(...)` o similar. Su nombre exacto se decidirá durante implementación.

### Responsabilidades del gateway

- Resolver el destino correcto del proceso (`api`, `fast`, `plex` o una excepción explícita como GitHub Actions).
- Crear o reutilizar el `process_run` canónico aplicando la política de idempotencia correspondiente.
- Crear el control e items Batch cuando el proceso sea durable.
- Persistir `executor`, `worker_pool`, correlación y contexto de forma coherente.
- Rechazar combinaciones de proceso/pool/executor no permitidas por el registro canónico.
- Centralizar la trazabilidad mínima necesaria para que Actividad y Operaciones puedan seguir la ejecución.

### Límites

- No introduce un nuevo servicio ni un nuevo broker.
- Neon sigue siendo la coordinación durable.
- Railway y GitHub Actions conservan sus funciones actuales como executors donde corresponda.
- No obliga a convertir en asíncrono el trabajo que deba seguir siendo síncrono y corto.

### Motivo

La auditoría encontró que varios puntos del sistema conocen y construyen por separado detalles de `process_runs`, Batch, pools y executors. Esa dispersión aumenta el acoplamiento y facilita inconsistencias como asignar un executor incorrecto aunque el trabajo llegue al pool correcto.

ARQ-02 también será la vía natural para ARQ-01: Vercel solicitará `PROC-NOV-009` mediante el gateway y no necesitará conocer cómo se materializa la cola Plex.

### Alcance V5

La implementación deberá preservar idempotencia y semántica funcional de cada proceso. El gateway será una frontera arquitectónica común, no un lugar donde duplicar lógica de negocio propia de los procesos.

## ARQ-03 — Unificar el runtime de `process_runs`

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 tendrá un núcleo común y neutral para gestionar el ciclo de vida observado de todas las ejecuciones, independientemente de si el proceso se ejecuta desde Vercel, Railway API, Railway FAST, Railway Plex o el worker técnico.

Ese núcleo sustituirá la duplicación actual entre `lib/process-runtime.js`, `lib/batch-worker-runtime.mjs` y `lib/process-worker-runtime.mjs` en todo lo que pertenezca al envelope común de ejecución.

### Responsabilidades comunes

- Crear/iniciar `process_runs` con la misma semántica.
- Registrar eventos y errores de forma uniforme.
- Gestionar heartbeats y timestamps.
- Persistir métricas y snapshots `before/after`.
- Mantener relaciones parent/child, correlación e idempotencia.
- Cerrar ejecuciones con reglas canónicas para `succeeded`, `failed`, `partial`, `cancelled` y demás estados admitidos.
- Garantizar que `executor`, `worker_pool`, origen y contexto queden registrados de forma coherente.

### Límites

- No fusiona los workers ni elimina la especialización de pools.
- Cada executor conservará adapters propios para reclamar trabajo y ejecutar el core funcional correspondiente.
- El runtime común no contendrá lógica de negocio específica de Películas, Series, Plex, Personas u otros dominios.

### Motivo

La auditoría detectó al menos tres implementaciones paralelas del mismo ciclo de vida observado. Esta duplicación facilita deriva semántica y errores como el caso real en que ejecuciones del pool Plex quedaron persistidas con `executor='railway_batch_fast'`.

### Alcance V5

La migración deberá preservar la compatibilidad con el histórico existente de `process_runs` y con las superficies Actividad/Operaciones. La consolidación se realizará sobre un contrato común explícito, con adapters por executor cuando sean necesarios.

## ARQ-04 — Hacer `executor` y `worker_pool` invariantes verificables

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 hará que la relación entre `process_code`, `worker_pool` y `executor` sea una invariante explícita y verificable. Las combinaciones válidas quedarán declaradas en el registro canónico del proceso y cualquier combinación no autorizada deberá fallar antes de ejecutar trabajo funcional.

### Reglas

- Se eliminan defaults silenciosos de `executor` que puedan ocultar la identidad real del worker.
- El executor deberá proporcionarse explícitamente o derivarse de una identidad de worker fiable.
- El gateway de ARQ-02 validará la combinación antes de encolar.
- El worker volverá a validar su capacidad y la identidad esperada al reclamar el trabajo.
- La creación del child run usará la identidad real del executor y del pool.
- Tests y CI verificarán las combinaciones permitidas y detectarán deriva.

### Motivo

La auditoría encontró un caso real en producción: ejecuciones `PROC-SER-002` procesadas por el pool Plex quedaron registradas con `executor='railway_batch_fast'` debido a un valor por defecto del runtime Batch. Aunque el trabajo funcional terminase correctamente, la observabilidad dejó de representar la realidad.

### Alcance V5

La implementación deberá corregir la identidad de futuras ejecuciones sin reescribir de forma artificial el histórico existente. Actividad, Operaciones y diagnóstico técnico deberán poder confiar en que `executor` y `worker_pool` describen el lugar real de ejecución.

## ARQ-05 — Registro canónico ejecutable de todos los procesos

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 tendrá un único registro canónico en código para todos los procesos `PROC-*`. Ese registro será la fuente de verdad ejecutable de metadatos y contratos de proceso y servirá para validar la arquitectura, no para concentrar la lógica funcional.

### Contenido mínimo del registro

- `process_code` y nombre humano.
- Tipo de ejecución y duración esperada.
- `worker_pool` y `executor` permitidos.
- Capacidades requeridas.
- Si admite Batch, ejecución manual, automática o ambas.
- Política de idempotencia y correlación.
- Timeout/deadline aplicable cuando corresponda.
- Superficies u orquestadores autorizados para iniciarlo.
- Relación con continuaciones o procesos hijos cuando exista.

### Uso del registro

- El gateway de ARQ-02 resolverá y validará el destino a partir de este registro.
- ARQ-04 usará el registro para impedir combinaciones `process_code / worker_pool / executor` inválidas.
- CI deberá detectar procesos ejecutables no registrados, registros sin implementación o adapters que apunten a procesos desconocidos.
- `PROCESS_CATALOG.md` se generará o validará automáticamente contra el registro para evitar deriva documental.

### Límites

- El registro no contendrá la lógica de negocio de cada proceso.
- Los cores funcionales seguirán separados por dominio.
- Excepciones como GitHub Actions deberán quedar declaradas explícitamente en lugar de existir como rutas implícitas.

### Motivo

La auditoría encontró que la verdad sobre los procesos está repartida entre documentación, starters, adapters y workers. También detectó `PROC-LC-001` como proceso realmente ejecutado pero no representado correctamente en el catálogo canónico. Un registro ejecutable único evita procesos ocultos y convierte la documentación en algo verificable.

### Alcance V5

La introducción del registro deberá hacerse sin cambiar por sí sola la semántica funcional de los procesos existentes. Primero se modelará la realidad actual y después se aplicarán las evoluciones aprobadas del roadmap.

## ARQ-06 — Sacar la orquestación de Lifecycle Continuation del worker API

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

La receta funcional de `PROC-LC-001` dejará de vivir dentro del adapter del worker API. V5 tendrá un core canónico de orquestación de Lifecycle Continuation independiente del executor, responsable de definir la secuencia de pasos, gates y continuaciones funcionales.

### Reglas

- El worker API se limitará a reclamar el trabajo, preparar el contexto de ejecución y llamar al core canónico.
- La lógica que decide qué pasos de Lifecycle ejecutar y en qué orden vivirá fuera del worker.
- El core podrá ser invocado desde cualquier executor autorizado por el registro canónico sin duplicar lógica.
- Las reglas funcionales de Lifecycle seguirán siendo una única fuente de verdad y podrán probarse sin levantar un worker completo.
- ARQ-02, ARQ-03, ARQ-04 y ARQ-05 se utilizarán para resolver destino, runtime, identidad y contrato del proceso.

### Límites

- Esta decisión no cambia por sí sola la semántica funcional actual de Lifecycle.
- No fusiona los procesos que Lifecycle coordina ni convierte el core en un worker independiente.
- La elección del executor seguirá estando gobernada por el registro canónico.

### Motivo

La auditoría detectó que el worker API contiene actualmente lógica de orquestación funcional de `PROC-LC-001`, lo que acopla una receta de negocio a un executor concreto. Eso dificulta reutilización, pruebas y evolución de infraestructura y favorece duplicaciones futuras.

### Alcance V5

La implementación deberá extraer primero la receta actual sin alterar su comportamiento observable. Cualquier cambio funcional posterior sobre Lifecycle requerirá una decisión específica del roadmap correspondiente.
