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

## DB-05 — Esquema versionado, ledger de migraciones y detección de drift

**Estado: APROBADA**

### Decisión

V5 mantendrá Git como historia oficial del esquema, pero Neon deberá poder demostrar qué migraciones están realmente aplicadas. Para ello se introducirá un ledger mínimo de migraciones (por ejemplo `schema_migrations`) y el workflow branch-first comparará el estado esperado en Git con el estado aplicado en Neon.

La mejora es **puramente técnica**: no cambia ninguna funcionalidad de PikoFilm, no altera la UX ni el comportamiento del producto y no debe introducir coste material apreciable. El ledger tendrá un volumen mínimo y sólo participa en CI/migraciones, no en las consultas normales de la aplicación.

### Invariantes

- `db/migrations/` será el único directorio válido para nuevas migraciones.
- El directorio histórico `/migrations` se auditará y se cerrará como fuente válida de cambios nuevos; sus SQL no se reejecutarán automáticamente por el mero hecho de existir.
- Cada migración aplicada se registra con identificador/nombre, checksum, fecha de aplicación y, cuando sea útil, commit/origen de ejecución.
- Una migración ya aplicada es **inmutable**. Si se necesita cambiar el esquema después, se crea una migración nueva.
- El checksum permite detectar que un archivo histórico fue modificado después de aplicarse.
- Antes de aplicar cambios, CI/deploy comparará migraciones de Git con el ledger de Neon.
- Una migración presente en Git pero no aplicada se considera pendiente.
- Una migración aplicada cuyo checksum no coincide con Git se considera **drift crítico**.
- Una migración registrada en Neon que no existe en Git se considera drift y debe investigarse antes de continuar.
- Tras merge, producción debe aplicar en orden todas las migraciones pendientes válidas, no sólo las que casualmente aparezcan en el diff de ese commit.

### Workflow branch-first

Se conserva el enfoque actual porque es correcto: PR → rama Neon efímera → aplicar migraciones → smoke tests → merge → producción. DB-05 añade verificación y memoria persistente del estado, no sustituye esa arquitectura.

El workflow actual sólo observa `db/migrations/*.sql` modificados/añadidos en el diff del commit. V5 evolucionará ese mecanismo para resolver el conjunto pendiente usando el ledger, manteniendo el test en rama efímera antes de producción.

### Bootstrap seguro del ledger

La introducción del ledger no asumirá que todos los SQL históricos del repositorio deban volver a ejecutarse.

1. inventariar migraciones históricas en `db/migrations/` y los dos SQL legacy de `/migrations`;
2. contrastar objetos/columnas/constraints actuales en Neon para establecer el baseline real;
3. registrar como baseline las migraciones demostrablemente ya aplicadas, con checksum actual y anotación de bootstrap cuando corresponda;
4. investigar cualquier discrepancia antes de marcarla aplicada;
5. a partir del baseline, toda migración nueva pasa por el ledger normal.

### Impacto funcional y coste

- **Impacto funcional para el usuario: ninguno.** Catálogo, Series, Personas, Calidad, Plex y el frontend deben comportarse igual.
- **Coste de Neon: despreciable/no material** frente al resto del sistema. Se añade una tabla diminuta con decenas o cientos de filas y consultas ligeras únicamente durante migraciones/CI.
- No añade un worker permanente, polling continuo ni procesos recurrentes de usuario.
- No se usa como histórico operativo purgable a 30 días: representa el estado estructural vigente de la base y por tanto queda protegido por DB-01.

### Relación con cambios grandes V5

DB-05 será especialmente importante para DB-02 (nuevo modelo de filmografía y transición histórica), DB-04 (retirada del modelo legacy de géneros) y cualquier materialización/normalización posterior. Antes de retirar una estructura antigua debe poder demostrarse exactamente qué versión de esquema tiene producción.

### Tests/gates mínimos

- migración nueva pendiente → se detecta y aplica en orden;
- segunda ejecución de la misma migración → no se reaplica;
- archivo histórico modificado tras aplicación → fallo por checksum/drift;
- migración del ledger ausente en Git → fallo de drift;
- fallo de producción deja la migración pendiente y una ejecución posterior la vuelve a detectar;
- rama efímera reproduce las pendientes antes del merge/aplicación;
- ninguna migración nueva puede añadirse en `/migrations` fuera del directorio canónico;
- bootstrap histórico no reejecuta SQL destructivo o antiguo automáticamente.

### Resultado esperado

PikoFilm podrá responder de forma determinista a: **qué migraciones existen, cuáles están aplicadas, con qué contenido y si Git y Neon están alineados**. Es una mejora de seguridad del desarrollo/despliegue, invisible para el usuario final y sin coste operativo relevante.

## DB-06 — Ownership, canonicalidad y rebuildabilidad explícita

**Estado: APROBADA**

### Decisión

V5 exigirá que cada tabla, vista, proyección o conjunto de datos materialmente relevante tenga un contrato explícito que indique **quién manda, quién puede escribir, de dónde procede, si es reconstruible, cómo se reconstruye y qué política de retención/limpieza le aplica**.

El objetivo no es crear burocracia ni una segunda fuente de verdad documental, sino impedir que un proceso automático, una purga o un full rebuild trate del mismo modo datos canónicos, decisiones manuales, snapshots externos, proyecciones reconstruibles e históricos operativos.

### Clases mínimas

Cada objeto relevante se clasificará al menos en una de estas categorías:

- **Canónico de PikoFilm:** verdad funcional propiedad del producto.
- **Decisión manual canónica:** decisión del usuario o corrección humana que no puede ser sustituida por una API ni por un rebuild.
- **Snapshot de fuente externa:** foto importada desde Plex/TMDb/IMDb/u otra fuente; la fuente externa conserva la autoridad última sobre ese dato.
- **Proyección/read model derivado:** representación reconstruible desde fuentes canónicas y/o snapshots.
- **Estado operativo vigente:** estado necesario para ejecutar/coordinar procesos actuales.
- **Histórico operativo/auditoría:** evidencia temporal con retención explícita.
- **Legacy/transición:** objeto sin autoridad futura, conservado sólo mientras termina una migración.

### Contrato mínimo por objeto

Para cada objeto material se documentará:

- clase;
- dominio/owner funcional;
- fuente de verdad;
- escritores autorizados;
- consumidores principales;
- reconstruible: sí/no;
- procedimiento de rebuild o recuperación;
- retención;
- si puede purgarse automáticamente;
- dependencias manuales que deban preservarse;
- condición de retirada si es legacy/transicional.

### Invariante reforzada de decisiones manuales

**Todo dato manual o decisión funcional del usuario se considera explícitamente no sustituible por una reconstrucción automática salvo que exista una regla de negocio aprobada que diga lo contrario.**

Ejemplos:

- `series_episode_overrides` es decisión manual canónica y no debe desaparecer en un full rebuild.
- exclusiones/correcciones manuales del catálogo, si las hay, deben recibir la misma protección.
- una reconstrucción de Series, Personas o Catálogo nunca puede sobrescribir silenciosamente una decisión manual válida.

### Ejemplos de clasificación esperada

- `movies`: canónico de catálogo PikoFilm.
- `movie_genres_canonical` + `genres`: canónico gobernado de géneros según DB-04.
- `series_episode_overrides`: decisión manual canónica, no reconstruible desde APIs.
- `series_quality_read_model`: proyección derivada reconstruible, con full rebuild seguro.
- `catalog_read_model`: derivado/read model; si se materializa en el futuro, seguirá siendo reconstruible y no se convertirá por ello en fuente primaria.
- `plex_items`, `plex_media`, `plex_files`, `plex_streams`: snapshot importado de Plex; Plex es fuente externa.
- `person_filmography` actual y su sustituto V5: proyección derivada/reconstruible desde fuentes externas bajo las reglas DB-02.
- `process_runs`/eventos históricos: estado operativo/histórico según columna/uso, sujeto a DB-01.
- `movie_genres`: legacy/transición, sin autoridad funcional y con retirada prevista por DB-04.

### Relación con otras decisiones

- **DB-01:** el contrato de ownership determina qué puede purgarse y qué foto vigente debe sobrevivir.
- **DB-02:** filmografía de Personas queda explícitamente clasificada como derivada/reconstruible; las reglas de producto siguen siendo canónicas.
- **DB-03:** sólo se aplica reconciliación/idempotencia respetando la autoridad del objeto; una proyección puede reconstruirse, una decisión manual no.
- **DB-04:** el modelo canónico de géneros queda declarado como autoridad y el legacy como transicional.
- **DB-05:** las migraciones podrán saber qué estructuras son fuentes, proyecciones o legacy antes de alterarlas o retirarlas.

### Implementación

La implementación V5 deberá producir un registro canónico versionado en Git —por ejemplo un documento/manifest de datos— y usarlo como referencia de diseño, migraciones, housekeeping y recovery.

No es obligatorio almacenar este registro como tabla adicional en Neon si no aporta valor operativo. La prioridad es que el contrato sea verificable, versionado y cercano al código/migraciones.

Cuando un nuevo objeto persistente relevante se añada, deberá declarar su categoría y rebuildabilidad como parte de su cambio.

### Gates y protección

- ningún full rebuild de un dominio puede borrar datos clasificados como manuales/canónicos de otro nivel;
- las purgas automáticas sólo podrán tocar objetos cuya política de retención lo permita;
- retirar una tabla legacy requiere demostrar que no conserva autoridad ni consumidores necesarios;
- una proyección reconstruible debe tener procedimiento de rebuild probado antes de depender de su purga/recreación;
- tests de recuperación deben verificar que los overrides/decisiones manuales sobreviven;
- cualquier cambio que reclasifique una tabla de canónica a derivada o viceversa es una decisión explícita de arquitectura/datos, no un detalle local de implementación.

### Impacto funcional y coste

DB-06 es una mejora de seguridad y mantenibilidad. No debe alterar la experiencia del usuario ni añadir procesos permanentes. Su coste operativo es esencialmente nulo; el valor está en evitar pérdidas de información, rebuilds peligrosos y limpiezas incorrectas.

### Resultado esperado

PikoFilm podrá responder para cualquier dato importante: **quién es su dueño, cuál es su verdad, quién puede cambiarlo, si se puede regenerar, cómo se recupera y si es seguro purgarlo**. En particular, ninguna optimización o reconstrucción podrá borrar una decisión manual del usuario por confundirla con dato derivado.

## DB-07 — Gobierno de índices basado en evidencia

**Estado: APROBADA**

### Decisión

V5 gobernará los índices por **evidencia de uso, coste y necesidad real**, no por intuición ni por una lectura aislada de `idx_scan`.

Un índice con cero o pocos scans es sólo un candidato a revisión. No se eliminará sin comprobar consumidores, consultas reales, planes de ejecución, solapamientos, constraints y comportamiento en una rama Neon.

### Evidencia observada

Medición de Neon del 2026-09-19:

- 186 índices en la base auditada;
- 42 índices no únicos aparecen con menos de 50 scans registrados;
- `idx_plex_technical_state_technical_fingerprint`: ~12 MB, 0 scans;
- `process_run_events_type_time_idx`: ~11 MB, 0 scans;
- `process_runs_correlation_key_idx`: ~2,6 MB, 0 scans;
- `plex_items_updated_idx`: ~2,2 MB, 0 scans;
- `admin_events_created_idx`: ~1,8 MB, 2 scans;
- `plex_items_parent_idx`: ~1,5 MB, 3 scans;
- `plex_items_active_idx`: ~1,1 MB, 0 scans;
- `title_ratings_status_idx`: ~1 MB, 1 scan;
- `movie_countries_country_idx`: ~912 KB, 0 scans.

La estadística `pg_stat_database.stats_reset` no aporta una ventana fechada útil en esta foto, por lo que los contadores no pueden interpretarse como “cero uso en los últimos X días”.

### Regla de decisión

Para retirar un índice material:

1. confirmar que no respalda una constraint/UNIQUE ni una necesidad estructural;
2. localizar lectores/queries potenciales en código, SQL, workers y scripts;
3. revisar si existe otro índice equivalente o más útil que lo cubra;
4. capturar `EXPLAIN`/`EXPLAIN ANALYZE` de las consultas representativas;
5. probar el cambio en rama Neon;
6. comparar planes, tiempos y comportamiento antes/después;
7. retirar sólo si el ahorro/coste evitado compensa y no existe regresión funcional o de rendimiento;
8. volver a medir tras el cambio.

Nunca se aplicará la regla `idx_scan = 0 => DROP INDEX`.

### Priorización

La revisión priorizará:

- índices grandes;
- índices sobre tablas con alto churn/escritura;
- índices duplicados o materialmente solapados;
- índices cuyo mantenimiento penalice procesos vivos;
- oportunidades claras de añadir un índice cuando una query importante haga scans caros y exista evidencia de mejora.

No se invertirá esfuerzo desproporcionado en microahorros de índices de 8/16/32 KB salvo que formen parte de una limpieza estructural mayor.

### Legacy

Los índices pertenecientes a tablas cuya retirada completa ya esté aprobada —por ejemplo `movie_genres` bajo DB-04— no se optimizarán individualmente salvo necesidad temporal. Desaparecerán con su tabla una vez completada la transición segura.

### Salvaguarda reforzada de Series

Series mantiene criterio especialmente conservador:

- no se retira un índice de referencia oficial, diagnósticos, disponibilidad, overrides o Calidad sólo porque registre pocos scans;
- deben reproducirse los recorridos reales y comprobarse planes;
- si existe duda razonable de degradar conciliación, calidad, frescura o recuperación, el índice se conserva;
- el ahorro de unos MB nunca tiene prioridad sobre el correcto funcionamiento del dominio más vivo del sistema.

### Impacto funcional y coste

DB-07 no cambia funcionalidades ni UX. Busca reducir almacenamiento, I/O, WAL y mantenimiento de índices inútiles, y también añadir índices sólo cuando una necesidad real lo justifique.

Los cambios futuros serán migraciones controladas branch-first. La aprobación de DB-07 no autoriza ahora ningún `DROP INDEX` ni `CREATE INDEX` en producción.

### Resultado esperado

PikoFilm tendrá los índices que necesita, no simplemente todos los que alguna vez se crearon. Cada índice material deberá justificar su coste con una consulta, constraint o necesidad operativa demostrable, manteniendo siempre prioridad sobre corrección y rendimiento real.


## DB-08 — Retención selectiva de raw payloads y evidencia técnica

**Estado: APROBADA**

### Decisión

V5 distingue entre **verdad procesada útil**, **evidencia funcional necesaria** y **payload bruto reconstruible**. PikoFilm conservará de forma estable los datos que necesita para funcionar, explicar decisiones o proteger estado vigente, pero no archivará indefinidamente cada respuesta completa de APIs externas cuando la información útil ya haya sido extraída y sea reconstruible.

La regla no es “borrar JSON”: cada JSON/JSONB se clasifica según su valor funcional y el contrato DB-06.

### Evidencia observada

Medición de Neon del 2026-09-19:

- existen 29 columnas JSON/JSONB en el esquema público;
- `title_ratings.raw_payload`: 146.300 filas con payload, ~115 bytes de media, ~16 MB de contenido bruto aproximado;
- `piko_quality.components`: 71.207 filas, ~459 bytes de media, ~31 MB aproximados;
- `admin_events.payload`: 64.582 filas, ~28,2 MB aproximados;
- `identity_validation.validation_details`: 20.868 filas, ~8,7 MB aproximados;
- `movies.source_status`: 20.976 filas, ~7,3 MB aproximados;
- `catalog_candidates.source_snapshot`: 13.295 payloads poblados, ~5,9 MB aproximados.

Estas cifras corresponden al peso aproximado de las columnas y no equivalen directamente al almacenamiento recuperable final ni a coste facturado.

### Clasificación

1. **Estado funcional actual → conservar.**
   Ejemplo: `movies.source_status` cuando gobierna frescura, perfil o comportamiento vigente.

2. **Explicación/evidencia vigente → conservar.**
   Ejemplos: `piko_quality.components` cuando explica el PikoQuality actual; `identity_validation.validation_details` cuando forma parte de una validación vigente.

3. **Payload externo reconstruible → retención limitada.**
   Cuando IMDb/TMDb/u otra fuente ya se transformó en campos estructurados suficientes, el raw completo no se conserva indefinidamente. Retención inicial de referencia: 30 días, salvo necesidad funcional documentada distinta.

4. **Payload histórico/operativo → DB-01.**
   Logs, eventos y evidencia operativa siguen la política general de 30 días salvo excepción aprobada.

### Casos concretos

#### `title_ratings.raw_payload`

`title_ratings` ya conserva de forma estructurada fuente, rating, escala, rating normalizado, votos, proveedor, tiempos, estado y errores. El raw completo es por tanto candidato fuerte a TTL cuando se demuestre que ningún consumidor depende de campos no estructurados.

No se eliminará hasta:

- inventariar lectores;
- extraer cualquier dato funcional aún oculto en el JSON;
- probar paridad;
- ajustar escritores para no recrear almacenamiento innecesario.

#### `piko_quality.components`

Se conserva. Aunque ocupe ~31 MB, representa explicabilidad funcional del resultado técnico y no se considera basura por ser JSON.

#### `catalog_candidates.source_snapshot`

Se conserva mientras el candidato esté activo o la evidencia sea necesaria para explicar su evaluación. Tras quedar procesado/resuelto, puede expirar el snapshot bruto después de la ventana aprobada, manteniendo el estado estructurado necesario.

### Invariantes

- Ninguna decisión manual se elimina mediante esta política.
- Ningún dato requerido por frontend, cálculo, Calidad, recovery o explicación vigente puede desaparecer sin sustituto estructurado equivalente.
- Antes de retirar un payload se buscan todos sus consumidores reales.
- Si un campo útil vive sólo dentro del raw, primero se modela/persiste explícitamente y se valida.
- La limpieza de histórico será progresiva/batcheada; no se ejecutarán updates/deletes masivos ciegos sobre producción.
- Tan importante como limpiar lo antiguo es modificar escritores para no volver a guardar raw innecesario.
- Una fuente reconstruible puede recuperar nueva evidencia futura si vuelve a necesitarse.
- DB-08 se combina con DB-01 y DB-06: la retención depende de la clase y autoridad del dato.

### Implementación futura

1. inventario completo de JSON/JSONB y consumidores;
2. clasificación con DB-06;
3. identificación de campos funcionales ocultos;
4. normalización de esos campos cuando proceda;
5. tests de paridad;
6. TTL/limpieza sólo sobre evidencia reconstruible;
7. modificación de writers para guardar provenance mínima en lugar de payload completo cuando sea suficiente;
8. limpieza progresiva de histórico;
9. medición real del espacio recuperado y del crecimiento posterior.

### Impacto funcional

La implementación sólo se considera correcta si la experiencia y los cálculos funcionales permanecen iguales. La meta es reducir almacenamiento duplicado/reconstruible, no sacrificar trazabilidad útil.

La aprobación de DB-08 **no autoriza ahora ninguna limpieza ni mutación de Neon Production**.

### Resultado esperado

PikoFilm conservará de forma duradera la verdad procesada, el estado actual y la evidencia que realmente necesita, pero dejará de funcionar como archivo permanente de cada respuesta completa de cada API cuando esa respuesta sea prescindible y reconstruible.


## DB-09 — Guardrails de almacenamiento y crecimiento por dominio

**Estado: APROBADA**

### Decisión

V5 vigilará el crecimiento de Neon por base, tabla y cardinalidad para detectar anomalías antes de que se conviertan en coste, bloat o presión operativa. El objetivo es **avisar y diagnosticar**, no imponer techos artificiales ni ejecutar limpiezas destructivas automáticamente.

La regla central es: **PikoFilm puede crecer, pero no debe crecer de forma inexplicable**.

### Evidencia observada

Medición del 2026-09-19:

- tamaño total de `neondb`: ~877 MB;
- `person_filmography`: ~170 MB de heap;
- `piko_quality`: ~46 MB;
- `process_run_events`: ~38 MB;
- `title_ratings`: ~35 MB;
- `admin_events`: ~34 MB;
- `plex_items`: ~34 MB;
- `process_runs`: ~30 MB;
- `plex_technical_state`: ~24 MB;
- `movie_credits`: ~24 MB;
- `series_reference_episodes`: ~21 MB;
- `series_diagnostics`: ~16 MB.

El total observado durante la auditoría era ~869 MB; el cambio reciente no se considera por sí mismo anómalo.

### Qué se medirá

Como mínimo:

- tamaño total de la base;
- tamaño por tabla;
- número de filas por tabla;
- evolución diaria;
- variación semanal;
- relación entre crecimiento y actividad/proceso cuando pueda atribuirse.

Para dominios de alta cardinalidad —especialmente Personas— se vigilarán **filas y tamaño**, no sólo MB.

### Frecuencia y retención

La vigilancia debe ser ligera:

- una foto diaria es suficiente como base;
- detalle diario: 30 días;
- tendencia más larga, si aporta valor, mediante agregado mensual pequeño;
- no se almacenará telemetría por minuto ni otro histórico desproporcionado.

Con el orden de magnitud actual de tablas, esta observabilidad tiene coste despreciable frente al resto de Neon.

### Detección de anomalías

Los umbrales no se fijan como límites rígidos universales. Se combinarán crecimiento relativo y absoluto para evitar ruido.

Punto de partida orientativo:

- alerta de tabla si aumenta >25 % y además >10 MB en una semana;
- alerta adicional por salto de cardinalidad anómalo;
- para la base completa, comparación con su tendencia real y no sólo contra un número fijo de GB.

Los valores definitivos se calibrarán con datos reales tras la implementación de DB-02/DB-08, porque esas decisiones cambiarán el baseline físico.

### Integración con Actividad/Operaciones

La señal debe ser comprensible para el usuario, por ejemplo:

- tamaño actual y tendencia;
- tabla/dominio que más crece;
- magnitud del cambio;
- proceso o ventana temporal correlacionada cuando pueda determinarse;
- estado normal/aviso/anómalo.

La observabilidad debe explicar **qué pasó y cuál fue el resultado**, coherente con el contrato de Actividad V4/V5.

### Guardrails: qué NO hacen

DB-09 no autoriza ni ejecutará automáticamente:

- borrado de tablas;
- purga de datos canónicos;
- eliminación de índices;
- `VACUUM FULL`;
- bloqueo de inserts;
- detener sincronización Plex;
- impedir incorporaciones de catálogo;
- detener conciliación o refresco de Series;
- modificar decisiones manuales;
- limpiezas destructivas de históricos.

Ante crecimiento anómalo: detectar → avisar → atribuir → investigar → corregir la causa según las reglas del dominio.

### Protección reforzada de Series

Series nunca quedará bloqueada por un presupuesto de almacenamiento. La sincronización, referencia oficial, conciliación, cobertura y decisiones manuales siguen teniendo prioridad funcional.

Un crecimiento anómalo en Series genera diagnóstico, no bloqueo automático.

### Relación con otras decisiones

- DB-01 define qué histórico puede purgarse;
- DB-02 reducirá y normalizará Personas, por lo que su nuevo baseline se recalibrará;
- DB-03 reduce write amplification;
- DB-06 indica qué puede y no puede limpiarse;
- DB-07 gobierna índices;
- DB-08 reduce payload reconstruible.

DB-09 observa si esas políticas funcionan en el tiempo y detecta regresiones.

### Impacto funcional y coste

No cambia la funcionalidad del producto. Añade observabilidad ligera y preventiva, con coste de almacenamiento/consulta no material frente al sistema actual.

### Resultado esperado

PikoFilm podrá detectar pronto que una tabla, dominio o proceso está creciendo a un ritmo inesperado y explicar dónde ocurre, antes de que el usuario lo descubra por degradación o coste. La reacción será siempre diagnóstica y controlada, nunca destructiva por defecto.


## DB-10 — Constraints selectivas para invariantes canónicos

**Estado: APROBADA**

### Decisión

V5 usará constraints de PostgreSQL para proteger únicamente **invariantes estructurales estables y universales**. La base debe impedir estados imposibles, pero no debe intentar codificar en SQL toda la lógica funcional evolutiva de PikoFilm.

No se añadirán FOREIGN KEY, CHECK, UNIQUE o NOT NULL por intuición. Cada constraint nueva exige evidencia de que la regla no admite excepciones legítimas.

### Evidencia observada

La revisión viva confirma que el esquema actual ya está razonablemente protegido y no presenta corrupción masiva en los dominios auditados:

- `title_ratings` sin película canónica: 0;
- `movie_credits` sin película: 0;
- `movie_credits` sin persona: 0;
- `person_filmography` sin persona: 0;
- `plex_catalog_status` sin película: 0;
- `series_reference_episodes` sin `series_reference` padre: 0;
- `series_diagnostics` sin serie de referencia: 0.

También existen ya relaciones útiles como:

- `movie_credits.imdb_id -> movies.imdb_id`;
- `movie_credits.tmdb_person_id -> people.tmdb_person_id`;
- `movie_genres_canonical -> movies + genres`;
- `title_ratings.imdb_id -> movies.imdb_id`;
- Plex media/technical state ligados a `plex_items`;
- availability de episodios ligada a referencia oficial;
- múltiples CHECK de estados cerrados.

### Contraejemplo que obliga a ser selectivos

La revisión detectó **2.933 filas de `plex_streams` sin correspondencia exacta en `plex_files`** bajo la clave aparentemente natural `rating_key + media_index + part_index`.

Esto demuestra que no se puede asumir automáticamente que “todo stream debe tener file” y crear una FK. Esa situación debe entenderse primero: puede ser semántica válida de Plex, deuda histórica o inconsistencia real.

DB-10 prohíbe corregir o borrar esas filas sólo para hacer encajar una constraint.

### Protección especial de Series

Series conserva excepciones funcionales legítimas.

En particular, `series_episode_overrides` puede contener decisiones como `special`, `not_needed` o combinados que no correspondan 1:1 con un episodio oficial. Por ello no se añadirá una FK obligatoria a `series_reference_episodes` mientras esa relación no sea universal.

Las reglas de margen de 7 días, disponibilidad, conciliación Plex↔TMDb, dobles/triples/múltiples y demás lógica viva seguirán en código/tests, no en CHECK SQL complejos.

### Tipos de constraint aceptados

Se usarán de forma selectiva:

- **FOREIGN KEY:** cuando una referencia sin padre sea siempre inválida;
- **UNIQUE:** cuando funcionalmente sólo pueda existir una identidad/relación;
- **CHECK:** para dominios cerrados y reglas simples/estables;
- **NOT NULL:** para datos verdaderamente obligatorios.

No se duplicará lógica compleja de negocio en SQL.

### Nuevo modelo de Personas DB-02

El sustituto V5 de `person_filmography` deberá nacer estructuralmente protegido:

- créditos ligados a una persona canónica existente;
- relaciones ligadas a una obra de filmografía existente;
- identidad de obra sin duplicados incompatibles;
- `imdb_id` obligatorio para cualquier obra aceptada, coherente con DB-02;
- reglas estructurales estables protegidas en DB;
- clasificación cinematográfica y elegibilidad de persona siguen siendo lógica de negocio probada en código.

### Procedimiento obligatorio antes de añadir una constraint

1. demostrar que la regla es funcionalmente universal;
2. auditar los datos actuales y contar violaciones;
3. investigar cualquier violación antes de modificarla;
4. diseñar la semántica de delete/update adecuada;
5. probar la migración en rama Neon;
6. ejecutar tests funcionales y de migración;
7. activar sólo si no invalida excepciones reales;
8. medir impacto de escritura cuando la FK/constraint afecte tablas vivas.

Una migración no puede “sanear” datos destructivamente sólo para conseguir que una constraint valide.

### Coste e impacto funcional

Las constraints simples tienen coste razonable y aportan protección frente a corrupción, pero no se multiplicarán sin necesidad. La integridad estructural tiene prioridad; el modelado debe seguir siendo flexible donde el negocio sea evolutivo.

La aprobación de DB-10 no autoriza ahora nuevas constraints ni cambios de datos en Neon Production.

### Resultado esperado

La base de datos impedirá las relaciones y valores que sean realmente imposibles, mientras PikoFilm mantiene en código las reglas funcionales complejas y cambiantes. Se obtiene integridad sin convertir PostgreSQL en una segunda implementación rígida del producto.


## DB-11 — Inventario y retirada controlada de objetos legacy o vacíos

**Estado: APROBADA**

### Decisión

V5 clasificará explícitamente cada tabla/objeto persistente como **ACTIVO**, **TRANSICIÓN**, **LEGACY CONFIRMADO** o **GESTIONADO EXTERNAMENTE**, y retirará únicamente aquellos objetos cuya falta de responsabilidad real pueda demostrarse.

La regla central es: **un objeto no permanece porque sea antiguo ni desaparece porque esté vacío; permanece sólo mientras tenga una responsabilidad real.**

### Evidencia observada

En la foto viva de Neon del 2026-09-19 existen varias tablas públicas con 0 filas, entre ellas:

- `acquisition_status`: 0 filas pero ~1,63 M index scans;
- `series_episode_availability`: 0 filas pero ~149k index scans;
- `batch_api_source_leases`: 0 filas pero >43k seq scans;
- `acquisition_priority_snapshots`: 0 filas;
- `plex_review_tasks`: 0 filas;
- `saga_universes`, `saga_universe_titles`, `saga_universe_collections`: 0 filas.

Esto demuestra que **vacío no significa inútil**. Algunas tablas representan estado temporal y pueden estar normalmente vacías mientras siguen siendo funcionalmente activas.

Además, las tablas vacías del esquema `neon_auth` son gestionadas externamente y no se tocarán por estar vacías.

### Clasificación

- **ACTIVO:** utilizado por código, workers, queries, recovery o funcionalidad vigente, aunque actualmente tenga 0 filas.
- **TRANSICIÓN:** objeto conservado mientras se migran consumidores/writers a un modelo nuevo; ejemplo: `movie_genres` bajo DB-04.
- **LEGACY CONFIRMADO:** no tiene readers, writers, dependencias, función de recovery ni responsabilidad futura aprobada.
- **GESTIONADO EXTERNAMENTE:** pertenece a Neon/Auth u otra infraestructura externa y queda fuera de limpieza local salvo procedimiento específico del proveedor.

### Protocolo antes de retirar

Para declarar un objeto LEGACY CONFIRMADO y eliminarlo deben comprobarse, como mínimo:

1. readers en código/SQL/frontend;
2. writers en workers, Batch, scripts y procesos manuales;
3. views, FKs, triggers, funciones y dependencias SQL;
4. uso en recovery, bootstrap o mantenimiento;
5. funcionalidad futura ya aprobada;
6. actividad real/estadísticas cuando aporten contexto;
7. pruebas de la aplicación sin ese objeto.

La transición será:

1. declarar `DEPRECATED/TRANSICIÓN` en el inventario DB-06;
2. eliminar writers;
3. eliminar readers;
4. añadir gate CI contra referencias nuevas;
5. probar la aplicación completa;
6. probar `DROP` en rama Neon;
7. ejecutar smoke/tests;
8. sólo entonces retirar mediante migración controlada.

### Casos específicos

- `acquisition_status`, `batch_api_source_leases` y `series_episode_availability` no son candidatos a borrado por el mero hecho de estar vacíos; tienen actividad/semántica vigente que debe preservarse.
- `saga_universe_*` y `plex_review_tasks` son candidatos a auditoría, no a borrado automático.
- `movie_genres` es transición aprobada: se retirará cuando DB-04 haya migrado todos los consumidores.
- el modelo histórico `person_filmography` podrá retirarse sólo después de desplegar, validar y autorizar expresamente la transición DB-02.
- objetos de `neon_auth` no forman parte de la limpieza de esquema de PikoFilm.

### No mantener un museo de tablas

La prudencia no implica conservar indefinidamente objetos sin función. Si la auditoría demuestra:

- 0 readers;
- 0 writers;
- 0 dependencias;
- 0 recovery;
- 0 funcionalidad vigente/futura aprobada;

el objeto debe retirarse y Git/migraciones conservan la historia.

### Protección reforzada de Series

Ninguna estructura de Series se elimina por vacío, poco uso o ahorro pequeño. Sólo se retira cuando existe sustituto probado y paridad funcional completa.

### Coste e impacto funcional

La retirada de tablas diminutas aporta sobre todo reducción de deuda y ambigüedad, no ahorro económico relevante. En objetos legacy grandes, como el modelo antiguo de Personas o géneros, sí puede existir ahorro material adicional.

La aprobación de DB-11 no autoriza ahora ningún `DROP TABLE`, `DROP VIEW` ni mutación destructiva de Neon Production.

### Resultado esperado

El esquema de producción dejará de acumular estructuras sin responsabilidad real, pero sin borrar estados temporales, objetos externos o piezas vivas sólo porque estén vacías. Cada retirada será demostrable, reversible durante la transición y probada antes de producción.
