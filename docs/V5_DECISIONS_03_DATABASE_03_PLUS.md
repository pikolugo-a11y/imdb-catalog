# PikoFilm V5 — Decisiones Punto 3 · Base de datos y modelo de datos (DB-03+)

Fecha: 2026-09-18

Continuación del documento canónico `docs/V5_DECISIONS_03_DATABASE.md`. Se abre este fichero para continuar las decisiones del Punto 3 sin reescribir el documento extenso ya persistido. Las decisiones anteriores DB-01 y DB-02 siguen vigentes en el documento principal.

## DB-03 — Escrituras idempotentes y reconciliación por delta

**Estado: APROBADA**

### Decisión

V5 adopta como contrato de modelo de datos el principio: **comprobar no equivale a cambiar**.

Para read models, proyecciones, caches persistidas y estados derivados, una ejecución que recalcule exactamente la misma foto funcional no debe provocar una reescritura de la fila sólo porque el proceso volvió a ejecutarse. Cuando el contenido funcional no cambia, la persistencia debe evitar `UPDATE`, `DELETE + INSERT` u otras escrituras equivalentes que no aporten una nueva verdad.

Cuando cambie realmente la foto funcional, sí debe persistirse el cambio inmediatamente.

### Evidencia que motiva la decisión

La auditoría observó, entre otros casos:

- `series_quality_read_model`: ~971 filas vivas pero ~761.000 `UPDATE` acumulados;
- `series_diagnostics`: ~62.000 filas vivas pero ~1,38 M `INSERT` y ~1,32 M `DELETE` acumulados;
- `plex_technical_state`: ~65.000 filas y más de 574.000 `UPDATE`;
- `plex_items`: ~75.000 filas y más de 400.000 `UPDATE`.

Estas cifras no implican por sí mismas corrupción, pero muestran write amplification material. DB-03 convierte PERF-08 en un contrato formal del modelo de datos y no en una optimización opcional de cada módulo.

### Semántica temporal

Debe separarse, cuando sea necesario, al menos conceptualmente:

- **contenido cambiado**: cuándo cambió realmente la foto funcional;
- **contenido comprobado**: cuándo se volvió a verificar la fuente aunque el resultado fuese idéntico.

No se debe forzar la reescritura de una fila grande sólo para cambiar un timestamp de comprobación. Si una superficie necesita frescura operativa, ésta debe vivir en un estado ligero apropiado (`refresh_state`, `process_runs`, heartbeat u otra representación equivalente) sin falsear la semántica de `updated_at`/`changed_at` del contenido funcional.

### Reconciliación por delta

En modelos donde hoy se reconstruye una colección completa, V5 debe preferir reconciliación por delta cuando se pueda demostrar equivalencia funcional:

- fila idéntica → no escribir;
- fila nueva → `INSERT`;
- fila cuyo contenido funcional cambió → `UPDATE`;
- fila que realmente dejó de pertenecer a la foto vigente → `DELETE`.

No se debe sustituir un `DELETE + INSERT` masivo por una lógica incremental si no puede demostrarse que la foto final y todas sus reglas de consistencia son equivalentes.

### Salvaguarda reforzada para Series

**Series es el dominio más vivo del sistema y la optimización nunca tiene prioridad sobre su corrección funcional, frescura o capacidad de recuperación.** Esta condición fue añadida expresamente por el usuario al aprobar DB-03 y es vinculante.

Por tanto, en Series:

1. La primera obligación es preservar exactamente el comportamiento funcional que ya funciona: conciliación Plex↔TMDb, identidad temporada/episodio, capítulos dobles/triples/múltiples, exclusiones manuales, disponibilidad España, margen de 7 días desde estreno, cobertura, faltantes exigibles y cualquier otra regla vigente.
2. No se modificará ninguna de esas reglas para ahorrar `INSERT`, `UPDATE` o `DELETE`.
3. Una optimización de persistencia sólo se acepta después de demostrar **paridad funcional** de la foto final frente al comportamiento actual.
4. Los tests deben comparar no sólo conteos globales sino episodios/temporadas/series y casos de borde reales.
5. Las decisiones manuales tienen prioridad y no pueden perderse ni ser sobrescritas por una reconciliación incremental.
6. La optimización debe tener rollback claro. Si una estrategia incremental introduce divergencia, se volverá al mecanismo seguro anterior antes que mantener un ahorro de escrituras.
7. Puede mantenerse una reconstrucción completa en un subflujo de Series si es la opción más segura para garantizar consistencia; DB-03 no obliga a optimizar a costa de robustez.
8. Debe existir capacidad de **full rebuild / reconcile seguro** como mecanismo de recuperación y auditoría, incluso si el funcionamiento ordinario usa deltas.

### Aplicación esperada

DB-03 aplica especialmente a:

- `series_quality_read_model`;
- `series_diagnostics`, con la salvaguarda reforzada anterior;
- futuras proyecciones/materializaciones del catálogo;
- nuevas proyecciones de Personas derivadas de DB-02;
- estados técnicos de Plex cuando el contenido funcional no cambie;
- otros read models/caches reconstruibles V5.

No autoriza cambiar ciegamente tablas canónicas. Cada tabla debe respetar su semántica y su contrato de autoridad antes de aplicar idempotencia.

### Implementación y tests obligatorios

Cuando se implemente DB-03:

- definir el conjunto exacto de columnas que constituyen el contenido funcional de cada proyección;
- ignorar timestamps puramente operativos al decidir si el contenido cambió;
- usar comparación explícita, `IS DISTINCT FROM`, fingerprint estable u otro mecanismo determinista según convenga;
- comprobar idempotencia: ejecutar dos veces con la misma entrada debe dejar la misma foto y la segunda ejecución debe producir cero o el mínimo estrictamente necesario de escrituras funcionales;
- comprobar cambio real: una modificación de fuente debe reflejarse inmediatamente;
- medir escrituras antes/después y bloat/dead tuples a lo largo de un ciclo representativo;
- para Series, ejecutar tests de paridad exhaustivos sobre la salida antes de adoptar el nuevo mecanismo;
- conservar un full rebuild/reconcile seguro y probado para recuperación;
- no convertir `updated_at` en una señal falsa de cambio cuando sólo se realizó una comprobación.

### Resultado esperado

PikoFilm podrá comprobar una entidad muchas veces sin reescribirla si su foto no cambia. El ahorro de I/O, WAL, dead tuples, autovacuum e invalidaciones es un beneficio secundario; la prioridad es mantener una semántica correcta y una base preparada para mayor automatización.

En Series, DB-03 se considera cumplida únicamente si se obtiene esa eficiencia **sin degradar en absoluto lo que hoy funciona**.

## DB-04 — Géneros canónicos únicos en castellano

**Estado: APROBADA**

### Invariante de producto

El usuario fija como regla inequívoca que **el modelo canónico de géneros es la única verdad funcional válida de PikoFilm**. El trabajo de normalización ya realizado para construir `genres` + `movie_genres_canonical` no es un complemento del modelo legacy: es el modelo que debe utilizarse siempre.

Por tanto:

- `genres` + `movie_genres_canonical` son la única fuente canónica de géneros;
- los nombres de género de producto son los **géneros aprobados en castellano**;
- `movie_genres` es legacy y no tiene autoridad funcional;
- una fuente externa puede seguir entregando valores crudos, pero esos valores **nunca pueden alimentar directamente** filtros, fichas, read models o lógica de producto sin pasar por el mapeo canónico;
- `source_value` puede conservarse como trazabilidad del valor original de la fuente, pero no como género visible/canónico.

### Evidencia observada

En Neon conviven actualmente:

- `movie_genres`: modelo textual legacy;
- `movie_genres_canonical` + `genres`: modelo normalizado.

Medición del 2026-09-18:

- `movie_genres`: 50.415 relaciones;
- `movie_genres_canonical`: 52.102 relaciones;
- coincidencias por género normalizado: 32.322;
- relaciones sólo legacy: 18.093;
- relaciones sólo canónicas: 19.780.

La divergencia es principalmente semántica/normalizadora, no de cobertura de títulos: se observaron 20.886 títulos con ambos modelos, sólo 3 títulos exclusivamente legacy y éstos únicamente con valor `N/A`.

Ejemplos reales de por qué el modelo canónico es el correcto:

- `Action & Adventure` → `Acción` + `Aventura`;
- `Sci-Fi & Fantasy` → `Ciencia ficción` + `Fantasía`;
- `War & Politics` → `Bélica` + `Política`;
- `Kids` → `Infantil`;
- `Crime` → `Crimen`.

### Problema actual

`catalog_read_model` todavía agrega `genres` desde `movie_genres`, mientras que Catálogo V4 filtra y devuelve preferentemente `movie_genres_canonical` + `genres`, con fallback al legacy. Esto permite que dos superficies o dos partes de la misma superficie razonen sobre universos distintos.

DB-04 elimina esa ambigüedad: **no habrá fallback funcional al legacy una vez finalizada la migración**.

### Implementación transversal obligatoria

La futura implementación de DB-04 debe incluir, como mínimo:

1. **Inventario completo de lectores y escritores** de `movie_genres`, `movie_genres_canonical` y `genres` en código, SQL, workers, Batch, importadores, read models y scripts.
2. **Escritores:** cualquier proceso que reciba géneros externos deberá normalizar/mapear al vocabulario aprobado y escribir el modelo canónico. Si temporalmente necesita conservar el valor bruto, será sólo evidencia/trazabilidad (`source_value`) y no fuente funcional.
3. **Lectores:** Catálogo, ficha, Novedades, Personas, Calidad, filtros, búsquedas, read models y cualquier consumidor futuro deberán leer exclusivamente el modelo canónico.
4. **`catalog_read_model`:** debe dejar de agregar `movie_genres` y construirse a partir de `movie_genres_canonical` + `genres`, o de la futura proyección materializada que preserve exactamente esa verdad canónica.
5. **Fallbacks:** retirar fallbacks automáticos al legacy cuando la cobertura canónica esté validada; una ausencia de género canónico debe tratarse como dato pendiente/calidad, no resolverse silenciosamente con el modelo antiguo.
6. **Backfill/paridad:** contrastar títulos actuales y asegurar que los 3 títulos exclusivamente legacy con `N/A` no representan pérdida funcional; no copiar `N/A` como género canónico.
7. **Retirada:** sólo después de migrar todos los consumidores y escritores, retirar `movie_genres` mediante migración branch-first y validación. No mantener triggers o doble escritura permanente.
8. **CI/gate:** añadir una protección que impida reintroducir referencias funcionales a `movie_genres` una vez retirado. Una referencia nueva al modelo legacy debe hacer fallar el gate salvo una excepción de migración explícita y temporal.
9. **UX:** todos los géneros visibles deben presentarse en castellano y pertenecer al vocabulario aprobado. No volver a mostrar etiquetas crudas como `Action & Adventure`, `War & Politics`, `Kids`, etc.
10. **Observabilidad/calidad:** si una fuente entrega un género sin mapeo aprobado, registrarlo como incidencia agregada de normalización y no crear un nuevo género ad hoc automáticamente.

### Gobierno del vocabulario

El catálogo de `genres` es un vocabulario gobernado, no una tabla abierta que cada fuente pueda ampliar libremente.

- añadir/renombrar/fusionar un género canónico es una decisión explícita de producto/datos;
- las fuentes externas se mapean hacia ese vocabulario;
- no se crean nuevos géneros canónicos sólo porque una API devuelva una etiqueta desconocida;
- los alias y valores crudos pueden conservarse como mapeo/evidencia, pero no como nueva verdad de producto.

### Transición segura

DB-04 no autoriza un `DROP movie_genres` inmediato. La secuencia será:

1. inventariar consumidores y escritores;
2. migrar escritores al canónico;
3. migrar lectores/read models;
4. ejecutar tests de paridad y cobertura;
5. eliminar fallbacks legacy;
6. validar producción;
7. retirar físicamente `movie_genres` mediante migración controlada cuando ya no tenga consumidores.

### Tests mínimos

- `Action & Adventure` produce exactamente `Acción` + `Aventura`;
- `Sci-Fi & Fantasy` produce `Ciencia ficción` + `Fantasía`;
- `War & Politics` produce `Bélica` + `Política`;
- un valor externo desconocido no crea género canónico nuevo por sí solo;
- filtros y listado usan exactamente el mismo conjunto canónico;
- ficha, Catálogo y cualquier read model presentan los mismos géneros para un mismo título;
- ningún consumer funcional depende de `movie_genres` antes de retirarlo;
- tras retirar legacy, CI impide reintroducir su uso.

### Resultado esperado

Una película tendrá **una única lista oficial de géneros dentro de PikoFilm**, siempre en castellano y dentro del conjunto aprobado. Los valores automáticos de las fuentes son entradas para normalización, no una segunda verdad.