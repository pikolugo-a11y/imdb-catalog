# PikoFilm — Batch Engine / Autopilot Lifecycle

**Estado:** arquitectura propuesta y aprobada para implementación incremental  
**Fecha:** 23/08/2026  
**Objetivo:** recuperar automatización masiva sin volver a ejecutar procesos largos o agresivos desde el frontal, Vercel Functions o GitHub Actions.

## 1. Principio central

Lifecycle sigue siendo la arquitectura canónica. La unidad de trabajo es **un título / una serie / un archivo / una etapa**. “Unitario” no significa “manual” ni “solo uno para siempre”: significa que cada operación es aislable, idempotente, trazable y reanudable.

El Batch Engine puede ejecutar miles de trabajos unitarios consecutivos, pero nunca convierte una pantalla web en un proceso largo ni crea un segundo flujo paralelo al Lifecycle.

Regla:

`Lifecycle decide qué necesita cada título → Batch Engine ejecuta solo la siguiente acción segura → Lifecycle se recalcula → el título avanza o se detiene para revisión humana.`

## 2. Separación de planos

### Control plane — Vercel / PikoFilm UI
Vercel sirve interfaz, lectura, creación/pausa/cancelación de runs y feedback. Una acción del usuario puede crear un batch run en Neon, pero **no procesa el lote dentro de la petición web**.

### State plane — Neon
Neon conserva cola, leases, checkpoints, presupuestos, eventos y estado de ejecución. PostgreSQL selecciona trabajos, evita duplicados y hace agregaciones cerca de los datos.

### Execution plane — worker dedicado
El trabajo batch se ejecuta fuera del request web. El host definitivo se decidirá antes de implementar ejecución productiva. Debe permitir procesos de larga duración, baja concurrencia, secretos server-side, salida a Internet controlada y apagado inmediato.

GitHub Actions y Vercel no son el execution plane general del Autopilot.

## 3. Qué puede automatizarse

### Clase FAST — local / SQL / datos ya materializados
Riesgo externo muy bajo. Puede procesar lotes grandes con límites de DB.

- recalcular Lifecycle;
- calcular PikoScore con ratings almacenados;
- validaciones de archivo que usen Plex ya sincronizado;
- diagnósticos de episodios y agregados;
- sagas/agregados locales;
- retenciones y limpieza segura;
- snapshots y KPIs.

### Clase API — APIs oficiales o fuentes controlables
Automatizable con rate limit y backoff.

- TMDb identidad y metadata;
- OMDb ratings;
- Plex sync/detalle;
- datasets IMDb;
- Wikidata;
- referencia de Series vía TMDb.

### Clase CAUTIOUS — scraping o fuente sensible
Automatizable solo de forma conservadora.

- FilmAffinity;
- cualquier HTML externo no diseñado como API;
- fallbacks web de identidad/evidencia.

Por defecto esta clase usa concurrencia 1, pausas, jitter, presupuesto diario y circuit breaker estricto.

## 4. Estados Lifecycle y política de Autopilot

| Estado | Acción automática permitida | Resultado automático | Revisión humana |
|---|---|---|---|
| `IDENTITY_PENDING` | Sí | resolver IDs | si no hay match fiable |
| `IDENTITY_VALIDATION` | Sí | validar evidencia | si score dudoso/error |
| `IDENTITY_REVIEW_REQUIRED` | No | — | obligatoria |
| `DATA_INCOMPLETE` | Sí | completar datos | si fuente crítica no resuelve |
| `PIKOSCORE_PENDING` | Sí | refrescar ratings si toca + calcular | no, salvo error persistente |
| `MOVIE_FILE_PENDING` | Sí | validar archivo | si genera finding |
| `MOVIE_FILE_REVIEW` | No | — | obligatoria |
| `SERIES_SYNC_PENDING` | Sí | crear/refrescar referencia | si inconsistencia |
| `SERIES_REVIEW` | No | — | obligatoria |
| `TECH_PENDING` | Sí | PikoQuality | no por score bajo; solo error técnico persistente |
| `COMPLETE` | No | — | — |
| `EXCLUDED` | Nunca | — | — |

El Autopilot nunca salta una fase ni ejecuta una etapa posterior si el Lifecycle no la permite.

## 5. Modelo lógico de cola

La implementación debe separar **run** y **job**.

### `batch_runs`
Representa una ejecución solicitada por el usuario o mantenimiento autorizado.

Campos mínimos previstos:
- `id`;
- `mode` (`autopilot`, `stage`, `maintenance`);
- `target_stage` opcional;
- `status` (`queued`, `running`, `paused`, `completed`, `cancelled`, `failed`);
- `created_at`, `started_at`, `finished_at`;
- `requested_by`;
- `limits` JSON pequeño y versionado;
- contadores agregados;
- `stop_reason`.

### `batch_jobs`
Una unidad procesable e idempotente.

Campos mínimos previstos:
- `id`, `run_id`;
- `entity_type`, `entity_id`;
- `stage`;
- `status` (`queued`, `leased`, `running`, `retry_wait`, `done`, `review`, `failed`, `cancelled`);
- `attempt`;
- `priority`;
- `available_at`;
- `leased_until`, `worker_id`;
- `started_at`, `finished_at`;
- `error_class`, `error_message` acotado;
- `result_summary` JSON pequeño;
- clave idempotente única por run/entidad/etapa cuando aplique.

No se guardan respuestas HTML/API brutas salvo diagnóstico excepcional y temporal.

## 6. Adquisición segura de trabajos

El worker pide un trabajo mediante transacción y bloqueo tipo `FOR UPDATE SKIP LOCKED` o mecanismo equivalente.

Reglas:
- lease corto y renovable;
- un job no puede estar activo en dos workers;
- si el worker muere, el lease expira y el job vuelve a ser elegible;
- cada operación verifica el estado actual antes de ejecutar;
- si Lifecycle ya avanzó, el job se marca `done/skipped` sin repetir trabajo.

Esto permite apagar/reiniciar el worker sin perder el punto.

## 7. Concurrencia

Valores iniciales conservadores; se aumentan solo con métricas reales.

- FAST: 4 trabajos simultáneos como máximo inicialmente, reduciendo si Neon muestra presión.
- TMDb/Wikidata/Plex/OMDb: 1–2 trabajos simultáneos por fuente inicialmente.
- FilmAffinity/web sensible: **1** simultáneo global.
- Un mismo título no puede procesar dos etapas simultáneamente.
- Nunca se permite concurrencia ilimitada derivada del tamaño de la cola.

Los límites son configuración persistida, no constantes ocultas imposibles de cortar desde Admin.

## 8. Rate limits y presupuestos

Cada fuente tendrá un bucket independiente con:
- requests por segundo/minuto;
- concurrencia máxima;
- presupuesto diario opcional;
- cooldown global;
- contador de errores consecutivos;
- timestamp `blocked_until`.

La ausencia de un límite oficial conocido **no autoriza** a aumentar tráfico. Se usa siempre un límite propio conservador.

## 9. Circuit breaker

Una fuente se pausa automáticamente ante señales de abuso o indisponibilidad.

Disparadores mínimos:
- HTTP 429;
- HTTP 403/401 inesperado;
- bloqueo/captcha/antibot detectable;
- varios timeouts consecutivos;
- ratio de error anormal;
- respuesta incompatible repetida.

Estados: `closed` → `open` → `half_open` → `closed`.

Cuando el breaker está abierto:
- no se lanzan nuevas peticiones a esa fuente;
- los jobs pasan a `retry_wait` o quedan bloqueados por fuente;
- el resto de clases puede continuar si no depende de ella;
- Admin muestra claramente la causa.

## 10. Reintentos

No hay bucles rápidos.

Backoff base recomendado:
- intento 1: +30 s;
- intento 2: +2 min;
- intento 3: +10 min;
- intento 4: +1 h;
- posteriores: revisión/manual o cooldown largo según error.

Añadir jitter para evitar patrones periódicos. Los errores permanentes (`not_found`, identidad ambigua, credencial inválida) no se reintentan indefinidamente.

## 11. Kill switch y control humano

Admin debe ofrecer como mínimo:
- **Pausar Autopilot**: no adquiere nuevos jobs;
- **Reanudar**;
- **Cancelar run**: conserva resultados ya terminados;
- **Bloquear fuente** manualmente;
- **Reabrir fuente** tras revisión;
- ver activos, pendientes, retry, review y errores;
- ver consumo por fuente y velocidad reciente.

La pausa debe aplicarse antes de tomar el siguiente trabajo, no depender de reiniciar el deployment.

## 12. Modos de ejecución

### Stage batch
Procesa solo una fase: por ejemplo, todos los `PIKOSCORE_PENDING` elegibles. Es el primer modo a implementar porque es más fácil de validar.

### Autopilot
Un título puede avanzar varias fases seguras consecutivas. Tras cada etapa se recalcula Lifecycle y se decide de nuevo. Se detiene al llegar a Complete, Review, Excluded, error persistente o presupuesto agotado.

### Maintenance
Trabajos administrativos autorizados: reconciliación Lifecycle, retención, snapshots, etc. No mezcla scraping con mantenimiento SQL.

## 13. Priorización

Orden inicial recomendado:
1. títulos ya parcialmente procesados;
2. trabajos locales/FAST;
3. novedades recientes;
4. elementos Plex nuevos/cambiados;
5. backlog antiguo.

Dentro de cada grupo, evitar que un único título fallido bloquee la cola.

## 14. Presupuestos de seguridad iniciales

Antes de disponer de métricas propias se empieza por debajo de la capacidad de las plataformas:

- FilmAffinity/web sensible: concurrencia 1, intervalo con jitter y presupuesto diario configurable.
- APIs oficiales: concurrencia 1–2; aumentar solo si no hay 429 y la documentación de la fuente lo permite.
- Neon: lotes pequeños de escritura, transacciones cortas, agregación SQL y sin cargar el catálogo completo en memoria.
- Plex: reutilizar snapshot local; pedir detalle remoto únicamente para elementos que lo necesitan.

No se persigue máxima velocidad; se persigue **avance constante sin riesgo de suspensión**.

## 15. Relación con GitHub Actions

GitHub Actions queda para:
- CI;
- Discovery IMDb manual actual mientras se migra;
- actualización offline del dataset IMDb mientras se migra;
- mantenimiento de solo lectura acotado.

No se creará un workflow por fase Lifecycle ni un Action que procese indefinidamente la cola. A medio plazo Discovery y ratings IMDb pueden migrarse al execution plane común si aporta simplicidad.

## 16. Relación con Vercel

Vercel no ejecuta el lote. Sus Server Actions pueden:
- crear run;
- pausar/reanudar/cancelar;
- consultar estado;
- ejecutar una operación unitaria solicitada expresamente por el usuario.

Nunca deben mantener un request abierto esperando cientos de títulos ni usarse como scraper batch.

## 17. Observabilidad

Métricas mínimas:
- jobs/hora por clase y etapa;
- duración p50/p95;
- éxito/error/review;
- retries;
- llamadas por fuente;
- 429/403/timeouts;
- breaker state;
- backlog por Lifecycle;
- edad del job más antiguo;
- filas/bytes aproximados procesados cuando sea relevante para Neon.

`pipeline_runs` puede seguir resumiendo ejecuciones de alto nivel, pero el detalle batch debe estar en tablas propias con retención definida.

## 18. Seguridad

- worker con credenciales mínimas necesarias;
- secretos solo en entorno del execution plane;
- ningún token en payloads de cola;
- no permitir que un job arbitrario indique URL/comando ejecutable;
- lista cerrada de handlers/etapas;
- sanitizar errores antes de persistirlos;
- idempotencia obligatoria antes de activar reintentos automáticos.

## 19. Orden de implementación recomendado

### M46-A — Control y cola
Crear esquema de `batch_runs`, `batch_jobs`, configuración, leases, pausa/cancelación y panel Admin sin ejecutar procesos externos.

### M46-B — FAST worker
Implementar primero procesos locales seguros: PikoScore, Lifecycle/diagnósticos/agregados. Validar reanudación, kill switch e idempotencia.

### M46-C — API worker
Añadir TMDb/Wikidata/OMDb/Plex con rate limits, budgets y circuit breaker.

### M46-D — CAUTIOUS worker
Añadir FilmAffinity/fallback web con concurrencia 1, backoff fuerte y presupuesto explícito.

### M46-E — Autopilot
Permitir encadenar etapas según Lifecycle y detenerse automáticamente ante estados de revisión.

### M46-F — Migración de tareas offline
Evaluar mover Discovery IMDb y ratings dataset desde GitHub Actions al worker común. Solo hacerlo si reduce riesgo y complejidad.

## 20. Criterios de aceptación antes de activar producción

1. apagar el worker no pierde ni duplica trabajos;
2. reanudar continúa desde checkpoint;
3. dos workers no procesan el mismo job;
4. una fuente con 429 abre breaker y deja de recibir tráfico;
5. pausa global impide tomar nuevos jobs;
6. cancelación no revierte trabajos ya confirmados;
7. un estado Review nunca se autoacepta;
8. Excluded nunca se procesa;
9. cada job ejecuta handlers canónicos, no lógica duplicada;
10. Vercel responde rápido y no espera al batch;
11. GitHub Actions no participa en el procesamiento continuo;
12. Neon no recibe lecturas masivas innecesarias;
13. Admin explica qué está haciendo el motor y por qué se detuvo;
14. límites por fuente se pueden reducir sin redeploy;
15. ejecución piloto con pocos títulos pasa una batería funcional antes de aumentar lotes.

## 21. Decisión pendiente: host del worker

La arquitectura es deliberadamente agnóstica del proveedor. Antes de implementar M46-B se comparará un runtime de worker dedicado que cumpla:
- proceso persistente o jobs largos;
- coste bajo/predecible;
- secretos;
- logs;
- parada inmediata;
- red saliente estable;
- sin prohibición de este patrón de automatización;
- despliegue simple y sin convertir GitHub/Vercel en infraestructura batch.

No se elige proveedor solo por ser gratuito; se prioriza estabilidad y bajo riesgo de suspensión.
