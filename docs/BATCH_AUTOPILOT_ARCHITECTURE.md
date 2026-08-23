# PikoFilm — Batch Engine / Autopilot Lifecycle

**Estado:** M46-A validado; M46-B FAST worker validado mediante piloto real 5/5  
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

### Execution plane — Railway
**Decisión cerrada en M46-B:** Railway es el execution plane dedicado inicial de PikoFilm. El worker corre como servicio persistente separado del frontal, con Dockerfile explícito, baja concurrencia, secretos server-side y kill switch persistido en Neon.

GitHub Actions y Vercel no son el execution plane general del Autopilot. **Los deployments de Vercel siguen siendo siempre manuales por el usuario; los deployments/redeploys del worker Railway sí pueden hacerse como parte de la operación del execution plane.**

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

La implementación separa **run** y **job** mediante `batch_runs` y `batch_jobs`. `result_summary` es la columna canónica para el resultado compacto del job; un job que termina correctamente debe limpiar `error_class` y `error_message` de intentos anteriores.

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

- FAST: **1 trabajo simultáneo en M46-B piloto**. El techo arquitectónico inicial sigue siendo 4, pero solo se aumentará tras métricas y pruebas específicas de concurrencia.
- TMDb/Wikidata/Plex/OMDb: 1–2 trabajos simultáneos por fuente inicialmente.
- FilmAffinity/web sensible: **1** simultáneo global.
- Un mismo título no puede procesar dos etapas simultáneamente.
- Nunca se permite concurrencia ilimitada derivada del tamaño de la cola.

Los límites son configuración persistida, no constantes ocultas imposibles de cortar desde Admin.

## 8. Rate limits y presupuestos

Cada fuente tendrá un bucket independiente con requests por segundo/minuto, concurrencia máxima, presupuesto diario opcional, cooldown global, contador de errores consecutivos y `blocked_until`. La ausencia de un límite oficial conocido no autoriza a aumentar tráfico.

## 9. Circuit breaker y reintentos

Una fuente se pausa automáticamente ante 429, 403/401 inesperado, captcha/antibot, timeouts consecutivos, ratio de error anormal o respuesta incompatible repetida. No hay bucles rápidos; se usa backoff y jitter. Los errores permanentes no se reintentan indefinidamente.

## 10. Kill switch y control humano

Admin debe permitir pausar/reanudar/cancelar, bloquear/reabrir fuentes y consultar activos, pendientes, retries, review, errores y consumo. La pausa se consulta antes de adquirir el siguiente trabajo y no depende de reiniciar Railway.

## 11. Modos de ejecución

### Stage batch
Procesa solo una fase. Es el modo validado inicialmente en M46-B con `PIKOSCORE_PENDING`.

### Autopilot
Un título puede avanzar varias fases seguras consecutivas tras recalcular Lifecycle. Aún no activado.

### Maintenance
Trabajos administrativos autorizados, separados del scraping.

## 12. Relación con GitHub Actions y Vercel

GitHub Actions queda para CI y tareas offline acotadas mientras se migran. No procesa continuamente la cola. Vercel es control plane: crea/consulta/pausa runs y operaciones unitarias; nunca mantiene un request abierto para un lote.

## 13. Seguridad

- worker con credenciales mínimas necesarias;
- secretos solo en Railway;
- ningún token en payloads de cola;
- lista cerrada de handlers/etapas;
- sanitizar errores;
- idempotencia obligatoria antes de activar reintentos automáticos;
- las fuentes externas permanecen deshabilitadas durante validación FAST.

## 14. Orden de implementación

### M46-A — Control y cola — VALIDADO
Esquema de cola, runtime control, leases, pausa/cancelación y Admin.

### M46-B — FAST worker — PILOTO 5/5 VALIDADO
Railway + Dockerfile explícito + worker `PIKOSCORE_PENDING`, concurrencia 1, lease 120 s y polling 5 s. El piloto real del 23/08/2026 procesó exactamente cinco títulos, todos finalizaron `done`, el run quedó `completed`, se persistió `result_summary`, PikoScore quedó en versión `2.0.0`, Lifecycle avanzó y el motor volvió automáticamente a estado PAUSADO al cerrar la prueba. No se habilitó ninguna fuente externa.

Incidencias descubiertas por el piloto y corregidas:
1. runtime Railway implícito no garantizaba Node/npm → Dockerfile explícito;
2. servicio Railway antiguo quedó enganchado a un snapshot anterior → servicio nuevo enlazado a `main`;
3. worker escribía inicialmente en `result` en vez de `result_summary` → corregido;
4. un retry exitoso conservaba el error histórico → el éxito limpia ahora `error_class/error_message`.

El piloto confirma el circuito: `Neon queue → Railway worker → PikoScore → Lifecycle → checkpoint/result_summary → run completed`.

### M46-C — API worker — SIGUIENTE BLOQUE
Añadir TMDb/Wikidata/OMDb/Plex con rate limits, budgets y circuit breaker. Debe comenzar con una sola fuente y piloto pequeño antes de ampliar.

### M46-D — CAUTIOUS worker
FilmAffinity/fallback web con concurrencia 1, backoff fuerte y presupuesto explícito.

### M46-E — Autopilot
Encadenar etapas según Lifecycle y detenerse automáticamente ante Review/Excluded/error persistente/presupuesto.

### M46-F — Migración offline
Evaluar Discovery IMDb y ratings dataset desde GitHub Actions solo si reduce riesgo y complejidad.

## 15. Criterios de aceptación

1. apagar el worker no pierde ni duplica trabajos;
2. reanudar continúa desde checkpoint;
3. dos workers no procesan el mismo job;
4. una fuente con 429 abre breaker;
5. pausa global impide tomar nuevos jobs;
6. cancelación conserva trabajos confirmados;
7. Review nunca se autoacepta;
8. Excluded nunca se procesa;
9. handlers canónicos, sin lógica paralela;
10. Vercel no espera al batch;
11. GitHub Actions no procesa la cola continua;
12. Neon evita lecturas masivas innecesarias;
13. Admin explica estado y parada;
14. límites por fuente se pueden reducir sin redeploy;
15. piloto pequeño antes de aumentar lotes.

**Validado ya por M46-B:** ejecución real stage batch 5/5, persistencia de resultado, retry, pausa/reanudación, ejecución fuera de Vercel/GitHub y retorno seguro a PAUSADO. Los criterios de concurrencia multiworker, cancelación, breakers y fuentes externas siguen pendientes de pruebas específicas posteriores.
