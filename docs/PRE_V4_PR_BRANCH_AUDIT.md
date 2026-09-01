# PikoFilm — Auditoría PRE-V4 de PRs y ramas

> Evidencia persistente para P1/P7. No implica cierre ni borrado automático.

## 1. PR abiertas observadas

Se observan 11 PR abiertas: #261, #258, #218, #217, #216, #215, #214, #213, #212, #211 y #99.

### Grupo A — PR de validación CI-only históricas

- #211 `Validate MDBList-only PikoScore batch`
- #212 `Validate lifecycle runtime performance optimization`
- #213 `Validate catalog series detail v3`
- #214 `Validate FA-free catalog series detail`
- #215 `Validate modern movie detail`
- #216 `Validate movie PikoQuality and saga detail`
- #217 `Validate sagas redesign`
- #218 `Validate sagas V2`

Sus descripciones declaran explícitamente finalidad de validación/CI y no de entrega funcional pendiente. Además, el `main` actual ha avanzado ampliamente desde esos baselines. #217 tiene un único commit/archivo de validación y #218 tres commits/tres archivos; la rama `validate-sagas-v2` está fuertemente divergida y muy por detrás de `main`.

**Clasificación provisional:** SUPERSEDED / HISTORICAL.

**Acción propuesta P7:** cerrar sin merge, dejando comentario de cierre indicando que el código funcional correspondiente ya evolucionó en `main` y que PRE-V4 consolida la validación en CI canónico. Después, sus ramas podrán entrar en el lote de limpieza de ramas históricas si no tienen otros consumidores.

### Grupo B — PR funcionales antiguas de Calidad Datos

#### #261 — `fix(data): acelerar Calidad Datos y corregir layout`

- head: `fix/data-quality-fast-layout`
- 5 commits, 4 archivos cambiados.
- El head está divergido respecto a `main`: la rama conserva 5 commits propios mientras `main` contiene cientos de commits posteriores.
- El objetivo era optimización SQL/paginación y corrección de layout.

**Clasificación:** INVESTIGAR / posible SUPERSEDED.

No cerrar todavía sin comparar los cuatro cambios funcionales con la implementación actual de `Calidad → Datos`, porque puede contener una optimización aún útil aunque el branch sea antiguo.

#### #258 — `feat(data): observabilidad completa y carga más legible`

- head: `feat/data-quality-observability-performance`
- 4 commits, 4 archivos cambiados.
- La rama está igualmente divergida y muy por detrás de `main`.
- Incluía logging completo de proveedores, optimización por CTE y reorganización visual.

**Clasificación:** INVESTIGAR / posible SUPERSEDED.

No cerrar todavía: hay que verificar que la optimización y la observabilidad actuales cubren o sustituyen esos cambios. El logging de bodies completos también debe revisarse desde el criterio PRE-V4 de seguridad/retención antes de rescatarlo.

### Grupo C — documentación histórica

#### #99 — `docs: documentar PA-001 Actualizar datos de una película`

- draft abierto.
- 25 commits / 23 archivos.
- parte de una arquitectura documental anterior (`Procesos Automaticos`, PA-001).

**Clasificación:** HISTORICAL / CONSOLIDAR.

No mergear directamente. Extraer únicamente decisiones todavía válidas hacia `PROCESS_CATALOG.md`/documentación PRE-V4 y cerrar como superseded cuando esa extracción esté completa.

## 2. Política propuesta de ramas PRE-V4

### Allowlist mínima durante la auditoría

No borrar:

- `main`
- `pre-v4-readiness`
- cualquier rama head de PR que permanezca abierta mientras se clasifica
- cualquier rama consumida por Railway/Vercel/otro runtime hasta migrar el consumidor
- ramas necesarias para una comparación de evidencia todavía no cerrada

### Ramas con consumidor externo conocido

`feat/pikoquality-technical-snapshot` todavía es la fuente configurada del worker Technical Snapshot de Railway. Aunque está 0 commits por delante y 240 por detrás de `main`, no debe borrarse hasta cambiar Railway a `main` y validar equivalencia.

### Patrón de limpieza futura

1. cerrar/retirar PR superseded;
2. migrar cualquier consumidor externo a `main`;
3. generar allowlist final;
4. borrar en lotes ramas históricas cuyo contenido esté totalmente contenido/superseded y sin consumidores;
5. conservar Git history; no reescribir historia.

## 3. Hallazgos que cambian P1

### GH-PR-001 — la mayoría de PR abiertas no son backlog real

8 de 11 PR abiertas son explícitamente PR de validación CI-only antiguas. No deberían sobrevivir al gate PRE-V4 como trabajo futuro.

### GH-PR-002 — #258/#261 requieren extracción, no merge ciego

Ambas ramas están muy por detrás de `main` y divergidas. El riesgo no es “perder la rama”, sino perder una idea útil de rendimiento/UX si se cierran antes de contrastar sus cuatro archivos con el estado actual.

### GH-PR-003 — #99 pertenece a una taxonomía documental retirada

El concepto `PA-001 / Procesos Automáticos` no debe convertirse de nuevo en fuente de verdad si el catálogo final adopta `PROC-*`. Sólo se rescatarán contenidos vigentes.

## 4. Neon: bloqueo de lectura confirmado a nivel de herramientas de esquema

Se intentó también la vía alternativa `describe_branch` y `get_database_tables`. Ambas acciones exponen `projectId`/`branchId` al cliente pero el backend valida `project_id`/`branch_id`, por lo que fallan antes de devolver el esquema.

**Conclusión:** NEON-001 no está limitado a `run_sql`; afecta también a las herramientas de inventario de esquema del conector. P3 destructivo sigue bloqueado desde ChatGPT hasta disponer de una interfaz compatible o de una vía externa explícitamente autorizada.

## 5. Estado de ejecución legacy

`package.json` todavía expone `worker:lifecycle` junto a `worker:batch-fast`, `worker:batch-api` y `worker:batch-plex`.

Por tanto, aunque el Lifecycle clásico sea legacy probable y no tenga servicio Railway observado, su retirada exige actualizar scripts/CI/configuración además de borrar workers. No se debe eliminar sólo el fichero del worker.

## 6. Primer lote candidato P2 — pendiente de aprobación explícita

### Lote A — alta confianza y sin infraestructura de producto esperada

1. `revalidate-mov001-tt8442644.yml`
2. `scripts/revalidate-mov001-once.mjs`
3. `ops/diagnose/tt8442644.*`
4. `ops/revalidate/tt8442644.*`
5. `tmp/validate-saga-availability-*`
6. `ci/sagas-v2-pr.txt`
7. `ci/sagas-v2-validation.txt`
8. `neon-observability-migration.yml` (one-shot sustituido por mecanismo genérico)

### Lote B — alta confianza pero con una verificación adicional

1. `drop-legacy-batch-job-steps.yml` — retirar tras confirmar estado real de la tabla en Neon.
2. `railway.api.toml` + `Dockerfile.api` — retirar después de confirmar una vez más que ningún servicio Railway usa esa configuración.
3. aliases `lib/db` y `lib/process-runtime` — retirar tras migrar/verificar importadores exactos.

### No incluir todavía

- Lifecycle clásico / `combined-worker`
- `pikoscore-core.mjs`
- `sagas-v2.js`
- `railway.batch-plex.toml` / Batch Plex
- `feat/pikoquality-technical-snapshot`
- `pikofilm-backup-temp`
- CSS versionado
- las PR #258/#261/#99

Todos siguen requiriendo una decisión o migración previa.

---

Estado: P1 sigue en curso. Próximo bloque: revisar en detalle los cambios de #258/#261 contra `main`, cerrar matriz de consumidores legacy y preparar la primera revisión conjunta de Lote A antes de cualquier borrado.