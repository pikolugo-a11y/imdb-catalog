# PA-005 — Sincronización Plex

## 1. Identidad
- **ID:** PA-005
- **Backend:** `syncPlex` → `syncPlexFast`
- **pipeline job:** `plex_fast_sync`
- **Tipo:** manual bajo demanda

### Puntos de entrada
- Mi Biblioteca (`/plex`) → **Actualizar Plex**.

## 2. Objetivo
Sincronizar las bibliotecas de películas y series de Plex con Neon, detectar altas/cambios/bajas, actualizar IDs externos, media y ficheros, reconciliar referencias de series y reconstruir estado Catálogo↔Plex.

## 3. Flujo
1. Crea run `plex_fast_sync`, stage `connect`.
2. Valida `PLEX_TOKEN`.
3. Descubre servidor Plex mediante URL configurada o `plex.tv/api/resources`.
4. Obtiene secciones y conserva movie/show.
5. Procesa cada sección secuencialmente.
6. Solicita hasta 20.000 elementos por sección con GUIDs y Media.
7. Compara con `plex_items` y clasifica new/changed/unchanged.
8. UPSERT masivo de elementos base; marca como inactivos los desaparecidos.
9. Persiste nombres/ficheros disponibles.
10. Solo para elementos nuevos/cambiados consulta detalle Plex en chunks de 8 concurrentes.
11. Reconstruye IDs externos, `plex_media` y `plex_files` de esos elementos.
12. Cada sección deja un `plex_sync_runs` propio.
13. Reconcilia referencias de series desde Plex.
14. Reconstruye `plex_catalog_status`.
15. Captura snapshot Dashboard (fallo tolerado).
16. Cierra run y refresca UI.

## 4. Volumen y lotes
- Hasta 20.000 elementos solicitados por sección.
- Secciones procesadas secuencialmente.
- Detalles de cambiados: chunks de 8 en paralelo.
- Volumen global: suma de todas las bibliotecas movie/show.

## 5. Fuentes
Plex Server/Plex.tv y Neon.

## 6. Controles
- `PLEX_TOKEN` obligatorio.
- Timeout HTTP detalle/listados: 120 s.
- Fallback de conexión Plex: remota HTTPS → remota → relay → primera.
- Por sección existe run `plex_sync_runs` success/error.
- Si una sección falla, el proceso global falla.
- Snapshot Dashboard no es fatal.
- No existe retry automático.

## 7. Escrituras
`plex_items`, `plex_external_ids`, `plex_media`, `plex_files`, `plex_sync_runs`, `plex_catalog_status`, referencias de series y snapshot Dashboard.

## 8. Salida visual
Botón pasa a **Actualizando Plex…**. Resultado: total, altas, cambios, bajas y posibles referencias de series pendientes de reconstruir.

## 9. Admin
Alta: `pipeline_runs(plex_fast_sync)` con total/new/changed/missing y cambios de identidad de series; además `plex_sync_runs` por sección.

## 10. Recuperación
La sincronización es idempotente por UPSERT y puede relanzarse. No hay checkpoint global; las secciones completadas antes de un fallo pueden quedar persistidas.

## 11. Evaluación
- Cobertura: alta.
- Trazabilidad: alta.
- Escalabilidad: razonable, con límite explícito 20.000/sección.
- Recuperación: media.
- Progreso visual: básico.

## 12. Pendientes
1. Mostrar progreso por sección.
2. Revisar límite 20.000.
3. Valorar retry de sección fallida.
4. Valorar automatización periódica real.