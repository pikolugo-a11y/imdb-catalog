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
