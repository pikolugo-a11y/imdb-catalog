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
