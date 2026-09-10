# PikoFilm — guía de desarrollo orientado a IA

## Propósito

PikoFilm se desarrolla con asistencia intensiva de IA. Esta guía convierte la documentación en parte del sistema de desarrollo: una nueva sesión debe poder reconstruir el contexto real del proyecto desde el repositorio, sin depender de conversaciones previas.

## Fuente de verdad y orden de lectura

1. Sistema vivo: código de `main`, esquema real de Neon, servicios Railway, Vercel y workflows GitHub realmente activos.
2. Documentación canónica versionada.
3. Issues como backlog o material histórico de trabajo, nunca como verdad superior al sistema vivo.
4. Conversaciones previas sólo como apoyo, nunca como única fuente.

Entrada obligatoria de una nueva sesión: `AGENTS.md`.

La documentación global vigente está consolidada en:

- `docs/V4_FUNCTIONAL_SPEC.md` — comportamiento funcional;
- `docs/V4_ARCHITECTURE.md` — arquitectura técnica;
- `docs/V4_UX_SPEC.md` — UX/UI.

Los documentos PRE-V4, baselines de arranque y handoffs intermedios son históricos y no deben utilizarse como punto de partida actual.

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

`docs/processes/PROCESS_CATALOG.md` es la fuente canónica de procesos concretos. Para cada PROC debe registrar como mínimo:

`trigger -> UI/API -> operación canónica -> executor -> fuentes externas -> tablas leídas -> tablas escritas -> Lifecycle before/after -> observabilidad -> error -> retry -> idempotencia -> Batch -> infraestructura`.

Además: individual/global, manual/automático, síncrono/asíncrono, lightweight/heavy, runtime, heartbeat, pause/resume/cancel, timeout, retry/backoff, circuit breaker, rate limit/cuota, concurrencia, caché, dependencias, efectos secundarios y coste cuando sea relevante.

Cada proceso debe declarar una relación Batch con uno de estos estados:

- `EXACTA`: individual y Batch llaman al mismo núcleo canónico.
- `PARCIAL`: comparten núcleo pero existen diferencias auxiliares relevantes.
- `DIVERGENTE`: Batch contiene lógica funcional propia o comportamiento distinto; es una incidencia arquitectónica a resolver.
- `SIN BATCH`: no existe ejecución masiva.
- `NO APLICA`: no es candidato natural a Batch.

Toda desviación debe incluir evidencia concreta y acción propuesta.

## Tríada canónica como mapa de impacto

| Si cambia... | Revisar/actualizar como mínimo |
|---|---|
| comportamiento de producto | `V4_FUNCTIONAL_SPEC.md` |
| navegación, jerarquía, interacción o responsive | `V4_UX_SPEC.md` |
| fronteras Vercel/Neon/Railway/GitHub Actions | `V4_ARCHITECTURE.md` |
| fuente de verdad, tabla/categoría de persistencia | `V4_ARCHITECTURE.md` + PROC lectores/writers |
| lógica de un PROC | `PROCESS_CATALOG.md` + `V4_FUNCTIONAL_SPEC.md` si cambia comportamiento |
| Batch, pools, leases, retry o concurrencia | `BATCH_ARCHITECTURE.md` + `PROCESS_CATALOG.md` + arquitectura si cambia frontera |
| Lifecycle | `V4_FUNCTIONAL_SPEC.md` + procesos afectados |
| retención/observabilidad | `V4_ARCHITECTURE.md` + funcional/UX si cambia lo consultable |
| Railway/workers | arquitectura + Batch/proceso afectado |
| workflow GitHub | arquitectura/runbook + proceso afectado |
| Vercel/control plane | arquitectura + UX/funcional según corresponda |
| fuente externa, cuota o fallback | arquitectura + proceso afectado |
| UX que dispara trabajo | UX + funcional + proceso afectado |
| procedimiento operativo | `operations/RUNBOOK.md` |

La documentación se actualiza en el mismo bloque de cambio. No dejar un cambio funcional “para documentar después”.

## Procedimiento obligatorio para IA antes de modificar código

1. Leer `AGENTS.md` y la tríada canónica.
2. Identificar el PROC o responsabilidad afectada.
3. Leer su entrada en `PROCESS_CATALOG.md` si existe proceso.
4. Encontrar la operación canónica real en código.
5. Encontrar todos los callers: individual, Batch, workflow, worker, API y acciones indirectas.
6. Verificar lectores/writers y efecto Lifecycle.
7. Comprobar observabilidad, API governance, retry e idempotencia.
8. Modificar la operación canónica, no una copia específica de un canal.
9. Ejecutar tests/contratos relevantes.
10. Revisar la tríada y anexos técnicos afectados.
11. Si la realidad contradice la documentación, corregir la documentación antes de dar el trabajo por cerrado.

## Procedimiento para descubrir deuda o huecos

Durante auditorías y evoluciones buscar explícitamente:

- PROC presentes en código y ausentes del catálogo;
- PROC documentados sin implementación vigente;
- dos funciones que hagan la misma responsabilidad;
- Batch que copie lógica individual;
- guards Lifecycle diferentes entre individual y Batch;
- fuentes externas distintas según canal sin justificación;
- llamadas a fuentes gobernadas que eviten el API gate;
- side effects presentes sólo en un canal;
- observabilidad distinta o incompleta;
- retries no idempotentes;
- workers sin proceso documentado;
- procesos sin executor real;
- tablas escritas sin propietario de proceso claro;
- estados terminales o transiciones sin responsable;
- automatismos que contradigan la política manual del producto;
- UI que convierta trabajo automático en falsa atención humana;
- documentación histórica que vuelva a introducir una segunda autoridad.

## Reglas permanentes de continuidad

- Las decisiones aprobadas se persisten en Git antes de pasar a la siguiente decisión.
- El usuario despliega producción Vercel y realiza validación funcional/visual; el agente hace código, tests, PR, CI, fixes y merge.
- El sync Plex global permanece manual salvo nueva decisión explícita.
- Actividad y Operaciones usan la observabilidad canónica y conservan 30 días de detalle.
- Fuentes gobernadas deben fallar cerrado si falta gobierno.
- La historia documental vive en Git; `main` describe el presente.

## Regla de mantenimiento de esta documentación

`AGENTS.md`, esta guía y `docs/README.md` son infraestructura de desarrollo. No deben convertirse en una cronología. Deben explicar siempre cómo iniciar, interpretar y modificar PikoFilm hoy.

Cuando cambie la estructura documental, actualizar primero estos entrypoints para que una nueva sesión de IA nunca dependa de conocer nombres antiguos o conversaciones anteriores.
