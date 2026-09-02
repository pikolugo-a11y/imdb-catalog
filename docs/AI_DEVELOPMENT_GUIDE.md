# PikoFilm — guía de desarrollo orientado a IA

## Propósito

PikoFilm se desarrolla con asistencia intensiva de IA. Esta guía convierte la documentación en parte del sistema de desarrollo: una nueva sesión debe poder reconstruir el contexto real del proyecto desde el repositorio, sin depender de conversaciones previas.

## Fuente de verdad y orden de lectura

1. Sistema vivo: código de `main`, esquema real de Neon, servicios Railway, Vercel y workflows GitHub realmente activos.
2. Documentación canónica versionada.
3. Issues como backlog o material histórico de trabajo, nunca como verdad superior al sistema vivo.
4. Conversaciones previas sólo como apoyo, nunca como única fuente.

Entrada obligatoria de una nueva sesión: `AGENTS.md`.

Mientras PRE-V4 esté activo, leer también `docs/PRE_V4_READINESS_PLAN.md` antes de cambios estructurales.

## Contrato de proceso canónico

Cada proceso funcional debe tener una única operación canónica de negocio reutilizable por cualquier canal.

Patrón obligatorio:

```text
UI / acción individual ─┐
                       ├─> operación canónica X -> persistencia / Lifecycle / observabilidad
Batch / job masivo ────┘
```

El Batch puede encargarse de seleccionar elementos, crear ejecuciones, encolar, reclamar leases, controlar concurrencia, retry, pausa/reanudación/cancelación y agregar métricas. No puede reimplementar la lógica funcional de X.

Si una modificación funcional requiere editar por separado la lógica individual y la lógica Batch, existe una desviación arquitectónica que debe registrarse y corregirse.

## Catálogo de procesos como mapa de impacto

`docs/processes/PROCESS_CATALOG.md` será la fuente canónica de procesos. Para cada PROC debe registrar como mínimo:

`trigger -> UI/API -> operación canónica -> executor -> fuentes externas -> tablas leídas -> tablas escritas -> Lifecycle before/after -> observabilidad -> error -> retry -> idempotencia -> Batch -> infraestructura`.

Además: individual/global, manual/automático, síncrono/asíncrono, lightweight/heavy, runtime, heartbeat, pause/resume/cancel, timeout, retry/backoff, circuit breaker, rate limit/cuota, concurrencia, caché, dependencias, efectos secundarios y coste cuando sea relevante.

Cada proceso debe declarar una relación Batch con uno de estos estados:

- `EXACTA`: individual y Batch llaman al mismo núcleo canónico.
- `PARCIAL`: comparten núcleo pero existen diferencias auxiliares relevantes.
- `DIVERGENTE`: Batch contiene lógica funcional propia o comportamiento distinto.
- `SIN BATCH`: no existe ejecución masiva.
- `NO APLICA`: no es candidato natural a Batch.

Toda desviación debe incluir evidencia concreta y acción propuesta.

## Documentación que debe acompañar a un cambio

Antes de cerrar cualquier modificación, evaluar estos impactos:

| Si cambia... | Revisar/actualizar como mínimo |
|---|---|
| lógica de un PROC | `docs/processes/PROCESS_CATALOG.md` y documento del dominio |
| Batch, pools, leases, retry o concurrencia | `docs/processes/BATCH_ARCHITECTURE.md` + proceso afectado |
| Lifecycle | documentación de Lifecycle + procesos afectados |
| tablas, columnas, constraints, índices o retención | arquitectura de datos + procesos lectores/writers |
| Railway/workers | arquitectura de ejecución + Batch/procesos afectados |
| workflow GitHub | operaciones/GitHub Actions + proceso afectado |
| Vercel/control plane | arquitectura de ejecución/UX según corresponda |
| fuente externa, cuota o fallback | fuentes externas + procesos afectados |
| observabilidad, eventos, estados técnicos | observabilidad + procesos afectados |
| UX que dispara trabajo | especificación funcional + proceso afectado |

La documentación se actualiza en el mismo bloque de cambio. No dejar un cambio funcional “para documentar después”.

## Procedimiento obligatorio para IA antes de modificar código

1. Identificar el PROC o responsabilidad afectada.
2. Leer su entrada en `PROCESS_CATALOG.md` y su documentación de dominio.
3. Encontrar la operación canónica real en código.
4. Encontrar todos los callers: individual, Batch, workflow, worker, API y acciones indirectas.
5. Verificar lectores/writers y efecto Lifecycle.
6. Comprobar observabilidad y retry.
7. Modificar la operación canónica, no una copia específica de un canal.
8. Ejecutar tests/contratos relevantes.
9. Hacer comprobación de impacto documental y actualizar docs.
10. Si la realidad contradice la documentación, corregir la documentación antes de dar el trabajo por cerrado.

## Procedimiento para descubrir deuda o huecos

Durante auditorías y evoluciones buscar explícitamente:

- PROC presentes en código y ausentes del catálogo;
- PROC documentados sin implementación vigente;
- dos funciones que hagan la misma responsabilidad;
- Batch que copie lógica individual;
- guards Lifecycle diferentes entre individual y Batch;
- fuentes externas distintas según canal sin justificación;
- side effects presentes sólo en un canal;
- observabilidad distinta o incompleta;
- retries no idempotentes;
- workers sin proceso documentado;
- procesos sin executor real;
- tablas escritas sin propietario de proceso claro;
- estados terminales o transiciones sin responsable;
- automatismos que contradigan la política manual del producto.

## Regla de mantenimiento de esta documentación

`AGENTS.md` y este documento son infraestructura de desarrollo. No deben convertirse en una cronología. Deben explicar siempre cómo iniciar, interpretar y modificar PikoFilm hoy.

Cuando cambie la estructura documental, actualizar primero `AGENTS.md` y este mapa de entrada para que una nueva sesión de IA nunca dependa de conocer nombres antiguos o conversaciones anteriores.
