# PikoFilm V5 — Auditoría 02: Rendimiento

Estado: **AUDITORÍA CERRADA — pendiente de decisiones V5**  
Fecha: **2026-09-13**  
Rama de trabajo: `audit/v5-02-performance`  
Base de código auditada: `main` después del cierre del Punto 1, merge `7cd962b9a6e23747eff210ae3d075425664b0a0d`.

Esta auditoría corresponde únicamente a la **Fase 1** del Punto 2 del marco V5. No aprueba por sí misma ninguna optimización. Las propuestas de V5 derivadas de este diagnóstico se revisarán después **una a una** con el usuario y se persistirán antes de pasar a la siguiente. Tras cerrar las propuestas V5 se revisará, también una a una, la ronda de innovaciones futuras.

---

## 1. Objetivo

Determinar dónde consume tiempo, consultas, CPU, memoria, tráfico o trabajo redundante PikoFilm en su estado real actual y separar:

- cuellos de botella medidos;
- riesgos de escalabilidad todavía tolerables por el tamaño actual;
- trabajo repetido evitable;
- protecciones de rendimiento que ya funcionan y deben conservarse;
- zonas donde faltan métricas suficientes para afirmar una causa;
- optimizaciones que serían peligrosas si sacrificasen frescura, exactitud o trazabilidad.

El objetivo no es perseguir microsegundos ni añadir caché indiscriminadamente. PikoFilm es una aplicación de datos con estado operativo vivo; una mejora sólo es válida si conserva la semántica funcional, la autoridad de Neon, los overrides manuales, la observabilidad y las fronteras Vercel/Railway/Neon ya fijadas en el Punto 1.

---

## 2. Metodología y fuentes examinadas

La auditoría no se ha limitado a documentación. Se contrastaron:

1. **Código de `main`**: rutas Next.js, consultas SQL, read models, búsquedas, paginación, refresco de pantallas y contratos de rendimiento existentes.
2. **Neon vivo, sólo lectura**: tamaños de tablas e índices, `pg_stat_user_tables`, scans, volumen de updates, bloat estimado, definiciones de vistas y `EXPLAIN (ANALYZE, BUFFERS)` de consultas representativas.
3. **Railway vivo**: CPU, memoria y red de los cuatro workers durante la última hora disponible.
4. **Vercel vivo**: despliegue productivo existente y patrones recientes de requests/runtime.
5. **Documentación canónica V4** y reglas permanentes para comprobar que una posible optimización no contradiga el producto.

No se ha modificado Neon. No se han creado ni eliminado índices. No se ha activado ninguna extensión. No se ha desplegado Vercel Producción.

### Limitación de telemetría

La instalación viva no tiene disponible `pg_stat_statements` para esta auditoría. Por tanto no existe aquí una clasificación histórica fiable de consultas por tiempo acumulado, frecuencia y p95/p99. Se utilizaron planes ejecutados en vivo, estadísticas de tablas, código y tráfico como evidencia. Esto permite localizar problemas claros, pero no autoriza a extrapolar un único `EXPLAIN ANALYZE` como latencia permanente de producción.

---

# 3. Mapa actual del camino de rendimiento

## 3.1 Lecturas interactivas

El patrón dominante es:

```text
navegador
  -> Vercel / Next.js dinámico
  -> una o varias consultas Neon
  -> render RSC/SSR
  -> navegador
```

Muchas superficies principales declaran `dynamic='force-dynamic'`. Esto es coherente con la necesidad de mostrar estado vivo, pero significa que una navegación o un `router.refresh()` vuelve a ejecutar el camino servidor + Neon salvo que una función concreta use caché propia.

## 3.2 Escrituras y procesos persistentes

El trabajo pesado/masivo se apoya en Neon + Railway. Los workers observados son API, FAST, Plex y Technical. En la ventana medida no muestran presión de CPU o memoria. El rendimiento interactivo actual no parece limitado por falta de capacidad bruta de Railway.

## 3.3 Read models y vistas

PikoFilm mezcla correctamente varios patrones:

- tablas canónicas;
- tablas read-model materializadas por lógica propia;
- vistas PostgreSQL no materializadas;
- agregados/caches persistidos;
- caché de aplicación en algunas superficies.

La existencia de un `read_model` en el nombre no implica que sea barato: `catalog_read_model` es una **vista normal**, por lo que su SQL se vuelve a expandir en cada consulta. `series_quality_read_model`, en cambio, sí es una tabla persistida, pero su estrategia de reconstrucción provoca mucha reescritura.

---

# 4. Protecciones que ya funcionan y deben preservarse

## PERF-G01 — Prefetch masivo ya bloqueado — BUENO

`NoPrefetchLink` fuerza `prefetch={false}` para navegación interna de alta fanout y evita que una pantalla con decenas de enlaces dispare navegación especulativa a destinos dinámicos. También evita convertir destinos deshabilitados en enlaces activos.

**Conclusión:** no reintroducir el prefetch automático de Next.js como una supuesta mejora de sensación de velocidad; en PikoFilm desplazaría trabajo al servidor/Neon antes de que el usuario lo solicite.

## PERF-G02 — Inicio ya usa caché selectiva — BUENO

La portada utiliza caché de aplicación para varias agregaciones pesadas con TTL, mientras conserva señales que necesitan mayor frescura. Es un patrón más sano que cachear la página completa o volver a computar todo en cada request.

**Conclusión:** V5 debería generalizar la idea de caché/invalidation por responsabilidad sólo donde la semántica lo permita, no imponer una estrategia global.

## PERF-G03 — Calidad global evita construir listas completas — BUENO

Los contratos de rendimiento de Calidad comprueban que los KPIs usen agregados ligeros y que no se carguen cientos/miles de filas sólo para producir una cifra del hub. Es una optimización estructural ya incorporada.

## PERF-G04 — Filmografía externa de Personas está acotada a la página — BUENO PARCIAL

La consulta de Personas no vuelve a cargar la filmografía externa completa para todos los candidatos: la parte canónica de `person_filmography` se restringe a las personas de la página seleccionada. El problema restante está antes, en la construcción/ranking global de candidatos.

## PERF-G05 — Paginación visible de 50 elementos — BUENO

Catálogo, Personas y otras superficies limitan la cantidad enviada al navegador. El problema en varias zonas no es el tamaño de la respuesta final sino cuánto trabajo se realiza **antes** de aplicar ese límite.

---

# 5. Evidencia viva de Neon

## 5.1 Tamaño actual aproximado de tablas

Mayores tablas observadas por tamaño de tabla:

| Tabla | Tamaño aproximado |
|---|---:|
| `person_filmography` | 170 MB |
| `piko_quality` | 45 MB |
| `title_ratings` | 35 MB |
| `admin_events` | 34 MB |
| `plex_items` | 34 MB |
| `process_run_events` | 32 MB |
| `process_runs` | 25 MB |
| `plex_technical_state` | 24 MB |
| `movie_credits` | 24 MB |
| `series_reference_episodes` | 21 MB |
| `movie_metadata` | 18 MB |
| `people` | 17 MB |
| `plex_streams` | 17 MB |
| `series_diagnostics` | 16 MB |
| `movies` | 14 MB |

El tamaño total todavía es moderado, pero ya existen suficientes cientos de miles de filas para que agregaciones globales por request sean visibles.

## 5.2 Cardinalidades y actividad relevantes

Estadísticas vivas aproximadas:

- `person_filmography`: ~549.899 filas.
- `movie_credits`: ~345.090.
- `title_ratings`: ~146.051.
- `people`: ~144.866.
- `process_run_events`: ~144.129.
- `plex_items`: ~86.324; ~365.000 updates acumulados en las estadísticas actuales.
- `plex_files` / `plex_media`: ~70.052 cada una; ~185.000 updates cada una.
- `piko_quality`: ~69.933.
- `plex_technical_state`: ~64.461; ~510.000 updates.
- `series_reference_episodes`: ~62.245.
- `series_diagnostics`: ~61.847 filas estimadas; ~136.000 inserts y ~74.000 deletes.
- `process_runs`: ~33.184; ~636.000 updates.
- `batch_run_items`: ~27.727; ~63.000 updates.
- `movies`: ~20.921.
- `plex_catalog_status`: ~20.921; ~355.000 updates.
- `series_quality_read_model`: sólo ~956 filas, pero ~244.000 updates.

Estas cifras no significan por sí solas que un update sea erróneo: heartbeats y estado vivo justifican actualizaciones frecuentes en estructuras operativas. Sí muestran dónde conviene separar escritura necesaria de reescritura completa de valores idénticos.

## 5.3 Bloat estimado

Se observó bloat/waste relevante en estructuras muy actualizadas:

- `plex_technical_state`: ~9,7 MB de waste estimado.
- `plex_items`: ~9,6 MB.
- `series_diagnostics`: ~3,0 MB.
- `series_reference_episodes`: ~2,9 MB.
- `catalog_candidates`: ~2,4 MB.
- `process_runs`: ~2,2 MB.
- `plex_media` / `plex_files`: ~1,9 MB cada una.
- `series_quality_read_model`: factor de bloat estimado ~6,7 pese a tener menos de 1.000 filas, con ~1,2 MB de waste.

El último caso es especialmente informativo: el problema no es volumen lógico sino reescritura repetida.

## 5.4 Índices

Se observaron 186 índices en las estadísticas consultadas. Algunos índices relativamente grandes tienen cero o muy pocos scans registrados en la ventana de estadísticas, por ejemplo:

- `idx_plex_technical_state_technical_fingerprint`: ~12 MB, 0 scans.
- `process_run_events_type_time_idx`: ~9,8 MB, 0 scans.
- `process_runs_correlation_key_idx`: ~2,4 MB, 0 scans.
- `plex_items_updated_idx`: ~2,1 MB, 0 scans.
- `admin_events_created_idx`: ~1,7 MB, 1 scan.
- `plex_items_active_idx`: ~1,1 MB, 0 scans.
- `title_ratings_status_idx`: ~1,0 MB, 1 scan.

**No se concluye que deban borrarse.** `idx_scan=0` depende del momento de reset de estadísticas y un índice poco frecuente puede proteger una operación crítica. La conclusión correcta para V5 es que existe un portfolio de índices suficientemente grande como para justificar una auditoría de evidencia/planes/consumidores antes de mantener o retirar cada candidato.

## 5.5 Scans secuenciales

Existen contadores muy altos en algunas tablas pequeñas (`genres`, controles, configuración, `series_reference`, `series_season_availability`). Un scan secuencial sobre una tabla de pocas filas puede ser la decisión óptima del planner, por lo que el número absoluto de scans no es criterio suficiente para añadir índices.

La señal útil aparece cuando se combina:

- tabla/relación grande;
- consulta frecuente;
- filtro no indexable;
- plan ejecutado caro;
- crecimiento esperado.

---

# 6. Hallazgos de lectura interactiva

## PERF-F01 — Personas recalcula el ranking global en cada request — ALTO / MEDIDO

### Hecho

La lista de Personas es dinámica. Para construir una página de 50 personas, la consulta parte de `people`, `movie_credits` y `catalog_read_model`, agrupa el universo relevante, calcula métricas y relevancia, ordena, limita y sólo después obtiene la parte canónica de `person_filmography` para las 50 personas seleccionadas.

### Medición

Un `EXPLAIN ANALYZE` representativo de la página inicial ejecutó en aproximadamente **1,26 s sólo dentro de PostgreSQL** en la muestra tomada. La parte de `person_filmography` ya acotada a las 50 personas costó una fracción pequeña; el coste dominante fue la agregación/ranking global sobre cientos de miles de créditos.

### Impacto

- La página ya parte de una latencia DB perceptible antes de red, RSC y render.
- Cada filtro/orden/página vuelve a pagar gran parte del trabajo.
- El coste crece con créditos/personas, no con las 50 filas mostradas.

### Conclusión

Es el cuello de botella interactivo más claro medido en esta auditoría. La mejora debe atacar **el ranking preparado**, no volver a microoptimizar la filmografía paginada que ya está acotada.

---

## PERF-F02 — Calidad · Series ejecuta una consulta global de episodios para clasificar ~956 series — ALTO / MEDIDO

### Hecho

`getClassifiedSeries()` carga el `series_quality_read_model` y calcula `availability_due` mediante un agregado sobre `series_episode_effective_status`. Después la clasificación, filtros, prioridad, orden y paginación final se realizan en JavaScript.

### Medición

El `EXPLAIN ANALYZE` representativo del query base de la lista tardó aproximadamente **201 ms**. La mayor parte del coste se concentró en la agregación de disponibilidad, que recorre la vista efectiva construida sobre decenas de miles de episodios/diagnósticos. Se leyeron miles de bloques para producir menos de 1.000 series.

### Impacto

- Incluso una vista que termina mostrando 50 filas paga el cálculo de todas las series.
- Los filtros de estado no reducen el trabajo SQL principal porque `primaryState` se calcula después en Node.
- El coste crece con episodios y diagnósticos.

### Conclusión

El read model de Series no está cumpliendo completamente el objetivo de convertir la pantalla de triage en una lectura barata: conserva parte de la clasificación derivada fuera del read model y recalcula evidencia global por request.

---

## PERF-F03 — Detalle de Series tiene fanout elevado de consultas — ALTO / ESTRUCTURAL

### Hecho

Un render normal del detalle de una serie hace:

1. query base de la serie;
2. siete consultas en paralelo para temporadas/totales/anomalías/combinados/PikoQuality/runs/overrides;
3. count del scope de episodios;
4. consulta paginada de episodios.

Por tanto existen al menos **10 consultas lógicas a Neon** para un render completo. Varias vuelven a usar `series_episode_effective_status`, que es una vista compleja sobre referencias, diagnósticos, disponibilidad y Plex.

### Impacto

La paralelización reduce wall-clock respecto a ejecutar las siete de forma secuencial, pero no reduce:

- CPU/IO total de Neon;
- conexiones/round-trips lógicos;
- trabajo repetido sobre la misma evidencia;
- amplificación cuando la página se refresca repetidamente.

### Conclusión

El detalle necesita una estrategia de lectura compuesta más eficiente: reducir consultas redundantes o disponer de un resumen persistido/consulta agregada coherente, sin convertir el frontend en una segunda fuente de verdad.

---

## PERF-F04 — Catálogo es razonable hoy, pero paga count + listado + vista expandida en cada request — MEDIO / MEDIDO

### Hecho

Catálogo ejecuta un count/resumen y después la consulta de 50 filas. Ambas parten de `catalog_read_model`, que es una **VIEW PostgreSQL no materializada**. El listado añade Plex, técnica, PikoQuality, agregados y un subquery de géneros por fila.

### Medición

En la muestra:

- query de resumen/count: ~24 ms;
- query de primera página: ~31 ms;
- búsqueda substring normalizada tipo `matrix`: ~44 ms para el count.

El camino normal ronda por tanto decenas de ms de DB por request y sigue siendo aceptable al tamaño actual.

### Riesgo

La búsqueda usa `translate(lower(...)) LIKE '%texto%'`, que fuerza un patrón poco aprovechable por índices B-tree ordinarios y escala aproximadamente con el número de títulos. La paginación por `OFFSET` también pierde eficiencia para páginas muy profundas, aunque con ~21k títulos todavía no es un blocker.

### Conclusión

No es el primer problema a resolver, pero merece preparar V5 para crecimiento sin sacrificar búsqueda acento-insensible ni orden determinista.

---

## PERF-F05 — `catalog_read_model` hace trabajo derivado en cada lectura y el listado vuelve a agregar géneros — MEDIO

### Hecho

`catalog_read_model` no es una tabla materializada; su definición incluye joins y subqueries correlacionados de géneros/países. La consulta del Catálogo vuelve a construir un array de géneros canónicos para cada una de las 50 filas.

### Impacto

Existe duplicación conceptual entre lo que la vista ya sabe derivar y lo que la consulta final vuelve a derivar. PostgreSQL puede optimizar partes no utilizadas, pero no existe garantía de que cada consumidor pague sólo lo mínimo a medida que el view crece.

### Conclusión

V5 debería aclarar qué campos derivados son responsabilidad real del read model y qué joins deben permanecer bajo demanda.

---

## PERF-F06 — Actividad mezcla resumen, calendario detallado y cronología en el mismo ciclo de refresco — MEDIO-ALTO

### Hecho

La pantalla de Actividad carga en paralelo varios bloques. `getActivityCalendar()` incluye varias consultas y puede manejar hasta cientos de planes/estadísticas para construir planificación y sobrecarga. Ese calendario también alimenta KPIs usados fuera de la vista estricta de calendario.

Mientras existe actividad, `ActivityRefresh` hace un `router.refresh()` cada **30 segundos** con la pestaña visible y vuelve a refrescar al recuperar foco/visibilidad.

### Impacto

El refresco no pregunta sólo “¿cambió el run activo?”; vuelve a solicitar el árbol RSC y puede recalcular bloques que cambian mucho menos frecuentemente, incluyendo planificación futura.

### Conclusión

La frescura de actividad viva y la frescura del calendario no necesitan necesariamente la misma frecuencia ni el mismo payload.

---

## PERF-F07 — Hay polling de página completa a 2–3 segundos en controles Batch — ALTO

### Hecho confirmado en código

- `BatchAutoRefresh`: `router.refresh()` cada **3 s** activo; 7 s si pausado.
- `IdentityBatchAutoRefresh`: `router.refresh()` cada **3 s**.
- `TechnicalAutoRefresh`: componente existente con `router.refresh()` cada **2 s** cuando está activo.
- `IdentityAutoRefresh` ordinario es más prudente: sólo refresca al volver tras al menos 3 minutos oculto.

### Evidencia operativa

Los logs recientes de Vercel muestran ráfagas de rutas dinámicas consultadas repetidamente y cache `MISS`. No toda repetición puede atribuirse a estos componentes sin correlación de sesión, pero el código confirma que existen rutas donde una ejecución activa puede provocar un SSR/RSC completo cada pocos segundos.

### Impacto

Un único navegador abierto durante 10 minutos puede generar aproximadamente:

- ~200 renders a intervalo de 3 s;
- ~300 a intervalo de 2 s;

antes de contar consultas DB internas de cada render.

### Conclusión

Actualizar progreso no debería requerir necesariamente reconstruir una pantalla dinámica completa. Es una de las fuentes de amplificación más claras del sistema.

---

## PERF-F08 — Búsquedas substring dependen de scans/LIKE en varias verticales — MEDIO

### Hecho

Catálogo, búsqueda global, Personas, Sagas y superficies operativas usan variantes de `lower(...) LIKE '%q%'`, `ILIKE` y en algunos casos JSON/contexto convertido a texto.

La UI de búsqueda global sí tiene protecciones útiles:

- mínimo de caracteres;
- debounce de ~220 ms;
- límite pequeño de resultados;
- caché de cliente acotada.

### Riesgo

Esas protecciones reducen frecuencia, pero no cambian el coste de una consulta individual cuando el universo crece. `people` ya ronda 145k filas y `movie_credits` 345k.

### Conclusión

No es necesario introducir un motor de búsqueda externo. Sí conviene evaluar normalización/indexación PostgreSQL adecuada para los campos realmente buscados y mantener el límite/debounce existentes.

---

## PERF-F09 — Sagas carga y ordena un universo completo antes de paginar — MEDIO-BAJO hoy / RIESGO FUTURO

### Hecho

El dashboard de Sagas obtiene el conjunto agregado y después aplica parte del filtrado, cálculo y paginación en Node. El universo actual es pequeño en comparación con Personas.

### Impacto

No es un hotspot medido hoy, pero repite el anti-patrón “cargar todo para mostrar 50”. El coste crecerá con colecciones/miembros y no con el tamaño de página.

### Conclusión

Debe corregirse por diseño cuando se toque la vertical, pero no merece desplazar los problemas medidos de Personas/Series/polling.

---

# 7. Hallazgos de escritura y read models

## PERF-F10 — `series_quality_read_model` sufre write amplification extrema — ALTO / MEDIDO

### Hecho

La reconstrucción ejecuta un `INSERT ... SELECT ... ON CONFLICT DO UPDATE` sobre todos los shows activos y establece `updated_at=now()` también en conflicto. No condiciona el `UPDATE` a que cambie realmente algún campo funcional.

### Evidencia viva

La tabla tiene aproximadamente **956 filas**, pero las estadísticas reflejan alrededor de **244.000 updates**. El bloat estimado llega a un factor ~6,7.

### Impacto

- WAL y escrituras evitables;
- autovacuum/analyze más frecuentes;
- churn de páginas aunque el estado lógico sea idéntico;
- pérdida de significado de `updated_at` como señal de cambio real;
- coste indirecto en backups/storage/IO.

### Conclusión

El read model debe poder refrescarse de forma idempotente sin reescribir filas idénticas.

---

## PERF-F11 — Tablas Plex/operativas muestran alta frecuencia de updates y bloat — MEDIO-ALTO

### Hecho

`plex_technical_state`, `plex_items`, `plex_catalog_status`, `process_runs` y otras estructuras presentan cientos de miles de updates y varios MB de waste estimado.

### Interpretación prudente

Parte es inherente al producto:

- heartbeats;
- leases;
- snapshots técnicos;
- cambios de presencia Plex;
- progreso de procesos.

No se puede etiquetar el volumen completo como redundante.

### Conclusión

V5 debe auditar actualizaciones “sin cambio”, granularidad de heartbeats y reconstrucciones globales, pero preservando recuperación durable y observabilidad. El objetivo es reducir escrituras semánticamente nulas, no debilitar leases ni estado vivo.

---

## PERF-F12 — Read models no tienen un contrato uniforme de frescura/coste — MEDIO

Algunos read models son tablas persistidas; otros nombres `*_read_model` son views; algunos se reconstruyen completos; otros se calculan al leer; otros tienen caché de aplicación. Esa heterogeneidad puede ser correcta por dominio, pero no hay un contrato transversal que permita responder rápidamente:

- quién lo regenera;
- qué evento lo invalida;
- cuánto puede estar stale;
- si una lectura es O(1), O(página), O(catálogo) u O(histórico);
- si una reconstrucción actualiza sólo cambios o reescribe todo.

Esto es una oportunidad de V5, no necesariamente un defecto funcional actual.

---

# 8. Infraestructura y capacidad

## PERF-F13 — Railway no está saturado — BUENO / MEDIDO

Métricas aproximadas de la última hora observada:

| Worker | CPU media | CPU máx. | Memoria media | Memoria máx. |
|---|---:|---:|---:|---:|
| API | ~0,0025 | ~0,0067 | ~0,086 GB | ~0,240 GB |
| FAST | ~0,0038 | ~0,0089 | ~0,044 GB | ~0,158 GB |
| Plex | ~0,0038 | ~0,0292 | ~0,048 GB | ~0,119 GB |
| Technical | ~0,0018 | ~0,0352 | ~0,062 GB | ~0,157 GB |

La ventana es corta y no representa picos históricos, pero demuestra que en el momento auditado no existe presión sostenida de CPU/memoria.

**Conclusión:** aumentar instancias/tamaño de workers no debe ser la primera respuesta de V5. Antes deben eliminarse consultas/relecturas/escrituras redundantes y mejorar la forma de repartir trabajo.

---

## PERF-F14 — El problema interactivo principal está más cerca de DB/request amplification que de compute — CONCLUSIÓN TRANSVERSAL

La combinación observada es:

- workers con capacidad ociosa;
- algunas consultas dinámicas caras;
- fanout de múltiples queries por pantalla;
- refrescos de página completa frecuentes;
- read models que reescriben mucho.

Por tanto la optimización prioritaria debería reducir **trabajo por evento del usuario / por cambio real**, no sólo hacer máquinas más grandes.

---

# 9. Caching, frescura e invalidación

## PERF-F15 — `force-dynamic` es generalizado y la caché es local a unas pocas funciones — MEDIO

Varias rutas clave son totalmente dinámicas: Catálogo, Personas, Calidad/Series, PikoQuality, Actividad, Operaciones y detalles. Esto protege frescura y evita bugs de datos stale, pero también hace que cada refresh vuelva al servidor.

La portada demuestra que PikoFilm puede cachear de forma selectiva agregados relativamente estables sin cachear todo el producto.

### Riesgo de una optimización ingenua

Aplicar `revalidate=...` global o cachear páginas completas podría ocultar:

- procesos que acaban de terminar;
- cambios manuales;
- errores operativos;
- estados Plex recientes.

### Conclusión

La unidad correcta de caché debe ser **consulta/read model con contrato de frescura**, no página completa por defecto.

---

## PERF-F16 — No hay un presupuesto explícito de latencia/consultas por superficie — MEDIO

Los tests de rendimiento existentes son útiles, pero son principalmente contratos estructurales:

- no cargar filmografías completas;
- no montar listas gigantes para KPIs;
- no prefetch masivo;
- no crear DDL en lectura.

No existe un gate transversal que diga, por ejemplo:

- máximo de queries lógicas por render crítico;
- presupuesto aproximado de lectura para una lista;
- prohibición de “load-all-then-slice” en datasets declarados grandes;
- umbral de regresión de plan o número de filas recorridas.

No se propone convertir CI en benchmark frágil; sí falta un contrato verificable de complejidad.

---

# 10. Observabilidad específica de rendimiento

## PERF-F17 — Falta telemetría histórica de consultas — MEDIO

`pg_stat_statements` no estaba disponible en la inspección viva. Sin esa fuente es difícil responder con precisión:

- cuáles son las 20 queries que más tiempo total consumen;
- cuáles se ejecutan miles de veces aunque individualmente sean rápidas;
- qué query empeoró entre releases;
- cuál es p95/p99 por familia.

Se puede investigar por código y `EXPLAIN`, pero es un proceso más manual y menos fiable.

**Límite:** cualquier activación de extensión/configuración en producción requiere decisión expresa y revisión de coste/compatibilidad; esta auditoría no la ha realizado.

---

## PERF-F18 — Vercel muestra amplificación de requests durante actividad — MEDIO / EVIDENCIA PARCIAL

En la muestra de runtime reciente aparecen rutas con decenas o cientos de requests, especialmente Calidad · Series y Actividad. También se observaron ráfagas cada pocos segundos con `cache=MISS`.

Esto es coherente con los componentes de auto-refresh encontrados, pero una muestra de logs no identifica siempre qué pestaña/componente concreto originó cada request. Por eso se registra como evidencia de amplificación, no como causalidad exclusiva.

---

# 11. Otros costes y riesgos detectados

## PERF-F19 — Búsquedas sobre JSON/contexto en Actividad/Operaciones pueden hacerse caras con histórico — MEDIO

Las búsquedas humanas de trazas pueden usar `ILIKE` sobre campos textuales y representaciones de `context`/resultados. La retención detallada de 30 días contiene el crecimiento, lo cual es una protección importante, pero el volumen de `process_runs`/eventos ya es material y puede aumentar mucho con más automatizaciones.

La solución no debe ser indexar indiscriminadamente JSON completo. Primero hay que identificar los campos que realmente forman parte de la búsqueda funcional.

## PERF-F20 — OFFSET es suficiente hoy, pero no debe expandirse a históricos masivos — BAJO-MEDIO

La paginación por OFFSET es simple y adecuada en catálogos de decenas de miles y páginas normales. En históricos muy profundos o datasets 10x puede hacer que PostgreSQL recorrate/salte cada vez más filas. V5 no necesita migrar todas las pantallas a cursor pagination, pero las nuevas superficies de actividad/eventos masivos deberían evitar diseñarse alrededor de offsets profundos.

## PERF-F21 — Middleware añade coste por request, pero no es prioridad — BAJO

El middleware protege la aplicación y calcula un hash para validar acceso en las rutas dinámicas. Es trabajo por request, pero frente a consultas de cientos de ms o refrescos cada 2–3 s es claramente secundario. No debe debilitarse seguridad para ahorrar esta fracción de coste.

---

# 12. Ranking de cuellos de botella

## Prioridad A — medidos y/o con amplificación clara

1. **Personas:** agregación/ranking global ~1,26 s de DB en la muestra para mostrar 50 filas.
2. **Calidad · Series:** query base ~201 ms y clasificación/paginación posterior en Node; coste dominado por evidencia global de episodios.
3. **Polling de página completa:** refresh cada 2–3 s en algunos controles activos, multiplicando todos los costes del render.
4. **Detalle de Series:** al menos 10 consultas lógicas por render sobre varias estructuras/vistas derivadas.
5. **`series_quality_read_model`:** ~244k updates para ~956 filas y bloat ~6,7.

## Prioridad B — coste moderado hoy, crecimiento previsible

6. Catálogo dinámico: count + listado + búsqueda no indexable ordinariamente.
7. Actividad: refresco de estado vivo arrastra calendario/resúmenes de distinta cadencia.
8. Búsquedas substring globales en Personas/Títulos/Sagas/Operaciones.
9. Reescritura frecuente de estructuras Plex/operativas.
10. Sagas y otras listas con filtrado/paginación parcial en Node.

## Prioridad C — gobierno preventivo

11. Índices grandes de uso no demostrado.
12. Falta de telemetría SQL histórica.
13. Falta de presupuesto de complejidad/queries por superficie.
14. Estrategia de caché/invalidation no formalizada por tipo de dato.

---

# 13. Qué NO recomienda esta auditoría

Para evitar optimizaciones contraproducentes, esta auditoría **no** recomienda automáticamente:

- aumentar recursos de Railway;
- añadir Redis, Elasticsearch, Kafka o un segundo sistema de caché/broker;
- materializar todas las vistas;
- borrar índices por `idx_scan=0`;
- cachear páginas completas de Operaciones/Actividad;
- reducir heartbeats/leases sin revisar recuperación;
- reemplazar Neon por otra base de datos;
- eliminar observabilidad para ahorrar escrituras;
- precargar rutas dinámicas para “hacerlas parecer rápidas”.

Cualquiera de esas decisiones requeriría evidencia propia.

---

# 14. Guardrails para las propuestas V5 de rendimiento

Toda propuesta derivada de esta auditoría deberá cumplir:

1. **Correctitud antes que latencia.** No servir datos incorrectos o stale sin contrato explícito.
2. **Una fuente canónica.** Un cache/read model nunca se convierte en una segunda autoridad funcional.
3. **Invalidación explicable.** Si algo se cachea o prepara, debe conocerse qué lo invalida y cuál es su freshness máxima.
4. **No ocultar actividad.** Reducir polling no puede impedir ver progreso; debe sustituirse por una lectura de estado más barata o por refresh adaptativo.
5. **No degradar recuperación.** Leases, heartbeats e idempotencia no se recortan sólo por reducir writes.
6. **SQL antes que Node cuando el dataset es grande.** Filtrado, agregación, orden y paginación deben acercarse a PostgreSQL o a un read model preparado cuando eso reduzca transferencia/trabajo.
7. **Incremental cuando sea seguro.** Read models deben evitar reescribir datos idénticos si pueden detectar cambio real.
8. **Medir antes/después.** Cambios sobre hotspots deben tener plan/contador/contrato que demuestre que realmente reducen trabajo.
9. **Escala proporcional a lo mostrado.** Una página de 50 no debería necesitar recomputar cientos de miles de filas salvo que exista una razón funcional explícita.
10. **Sin nueva infraestructura por reflejo.** Primero explotar PostgreSQL, read models y arquitectura ya existente.

---

# 15. Conclusión de la auditoría

PikoFilm **no está actualmente limitado por CPU o memoria de los workers**. El problema de rendimiento más importante es de **amplificación de trabajo**:

- algunas pantallas dinámicas recalculan universos completos para mostrar una página pequeña;
- ciertas vistas hacen fanout de muchas consultas sobre la misma evidencia;
- el polling de página completa repite todo ese coste cada pocos segundos durante procesos activos;
- algunos read models se reconstruyen mediante updates masivos aunque el valor lógico no cambie;
- la caché selectiva existe y funciona en Inicio, pero todavía no hay un contrato transversal de freshness/invalidación;
- falta telemetría SQL histórica suficiente para ordenar automáticamente los costes acumulados.

La oportunidad central para V5 es que el coste del sistema sea **proporcional al cambio real y al dato que el usuario está consultando**, no al tamaño completo del catálogo ni a la frecuencia de refresco visual.

Con esta auditoría se considera completada la **Fase 1 del Punto 2 — Rendimiento**. El siguiente paso obligatorio es presentar las propuestas V5 de rendimiento, como mínimo 10, **una a una**, registrar cada decisión en Git, y sólo después realizar la ronda de al menos 5 innovaciones futuras también una a una.
