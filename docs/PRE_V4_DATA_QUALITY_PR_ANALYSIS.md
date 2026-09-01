# PRE-V4 — Análisis funcional de PR #258 y #261 (Calidad → Datos)

## Objetivo

Resolver si las dos PR funcionales antiguas de Calidad → Datos contienen trabajo que ya esté absorbido por `main` o si hay ideas que deben rescatarse antes de cerrar las ramas.

No se propone merge directo: ambas ramas están muy por detrás de la arquitectura actual.

## Estado actual de `lib/data-quality.js`

La implementación vigente sigue construyendo el universo completo de Calidad → Datos en una consulta y después hace en Node/Vercel:

- `map(assessDataQuality)` de todas las filas;
- filtros de estado/completitud/stuck;
- ordenación;
- paginación con `slice`.

Aunque la UI muestra páginas de 25 elementos, la función `getDataQualityPage()` carga primero todo el universo filtrado por q/type/Plex y sólo después pagina en memoria.

Además el SELECT actual mantiene varias subconsultas correlacionadas por título para géneros, créditos, Plex y agregación de `title_ratings`.

**Conclusión:** el problema de rendimiento que motivó #258/#261 no está completamente absorbido en el código actual.

## PR #261 — `fix/data-quality-fast-layout`

### Qué aporta

#261 sustituye el patrón anterior por una vista SQL con CTEs/agregados y mueve a PostgreSQL:

- cálculo de flags de géneros/créditos/Plex;
- resumen agregado;
- clasificación operacional principal;
- filtros;
- ordenación;
- `LIMIT/OFFSET`;
- retorno de únicamente la página pedida más el resumen.

Arquitectónicamente es la respuesta más directa al problema actual: evita enviar todo el universo a Node/Vercel para luego descartar casi todas las filas.

También intenta corregir el layout de Calidad → Datos.

### Por qué no se puede mergear tal cual

La rama fue construida sobre una generación anterior de las reglas de Datos. Desde entonces el `main` actual añadió, entre otras cosas:

- `missingBlocking` y reglas especiales de runtime para series;
- decisiones manuales `accepted_incomplete` y `fixed_five`;
- tratamiento explícito de ratings sin `fetched_at` como caducados;
- PikoScore V3 y estados más recientes;
- page size actual distinto;
- otras modificaciones funcionales posteriores.

Por tanto portar el fichero de #261 directamente podría reintroducir reglas antiguas aunque mejore el rendimiento.

### Decisión PRE-V4

Clasificación: `USEFUL DESIGN / SUPERSEDED IMPLEMENTATION`.

Acción recomendada:

1. **no mergear #261**;
2. conservar su idea como requisito técnico: *Calidad → Datos debe filtrar/paginar/agregar en SQL y no cargar el universo completo en Vercel*;
3. reimplementar esa arquitectura sobre las reglas canónicas actuales;
4. una vez portada y probada, cerrar #261 como superseded por la implementación PRE-V4/V4.

Hasta que esa extracción exista, la PR no debe cerrarse porque contiene una mejora real todavía ausente.

## PR #258 — `feat/data-quality-observability-performance`

### Parte de rendimiento

#258 reemplaza subconsultas correlacionadas por CTEs de:

- ratings;
- créditos;
- géneros;
- Plex.

Esto reduce trabajo SQL repetido, pero **continúa cargando el universo completo** y filtrándolo/paginándolo en Node. En ese aspecto #261 es una evolución más completa del mismo objetivo.

Clasificación del rendimiento #258: `SUPERSEDED BY #261 DESIGN`.

No es necesario conservar ambas implementaciones.

### Parte de observabilidad

#258 proponía guardar request/response HTTP completos de proveedores en `admin_events`, sanitizando keys/tokens y sin truncar el body.

El código vigente es deliberadamente más conservador: `loggedJsonFetch()` registra errores de transporte/HTTP, pero no persiste cada body exitoso completo.

Restaurar el comportamiento de #258 sin una política explícita tendría costes/riesgos:

- crecimiento de Neon y transferencia;
- retención indefinida de payloads grandes;
- posibilidad de que proveedores incorporen campos sensibles o inesperados;
- duplicación de información que ya se persiste en modelos canónicos;
- ruido operacional difícil de explotar.

Por ello la ausencia actual del logging completo **no se interpreta como regresión automática**.

Clasificación de observabilidad #258: `REQUIREMENT TO REASSESS`, no `CODE TO MERGE`.

Si V4 necesita trazabilidad de proveedor, diseñar una política bounded: metadatos, status, duración, hash/sample controlado y payload completo sólo bajo diagnóstico explícito/TTL si fuese necesario.

### Parte visual

La reorganización visual de #258 es de una versión antigua de Calidad → Datos. El frontend actual debe auditarse en P8 y no debe recuperarse CSS antiguo sin comparación visual.

## Resolución entre #258 y #261

- #261 contiene la idea técnica que todavía merece rescate: **paginación/filtro/resumen en PostgreSQL**.
- #258 ya no necesita preservarse como implementación de rendimiento porque #261 mejora ese enfoque.
- la observabilidad de #258 se convierte en requisito de diseño, no en código a rescatar.
- ningún CSS de ambas ramas debe mergearse automáticamente.

## Propuesta de estado de PR

- #261 → `KEEP OPEN TEMPORARILY / EXTRACT PERFORMANCE DESIGN`.
- #258 → `READY TO CLOSE AFTER RECORDING OBSERVABILITY REQUIREMENT`, porque su mejora SQL queda superada por el diseño de #261 y el logging completo no debe recuperarse ciegamente.

No se ha cerrado ninguna PR en este bloque.

## Deuda nueva: DATA-PERF-001

**Calidad → Datos sigue cargando y evaluando en Node/Vercel el universo completo antes de paginar.**

Antes del gate final V4 debe decidirse una de dos opciones:

- portar la arquitectura SQL-paginada de #261 a las reglas actuales; o
- justificar con medidas reales que el universo actual es suficientemente pequeño y establecer un umbral/plan de escalado.

La opción preferida por arquitectura PRE-V4 es la primera: reducir transferencia Neon → Vercel y computar filtros/agregados donde viven los datos.

**Estado:** análisis funcional #258/#261 cerrado; queda implementación/canonización de DATA-PERF-001 antes de cerrar #261.
