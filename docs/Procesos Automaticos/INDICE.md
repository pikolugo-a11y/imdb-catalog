# Índice maestro — Procesos Automáticos PikoFilm

Inventario revisado sobre la aplicación, acciones server, workers y workflows de GitHub Actions.

| ID | Proceso | Entrada principal | Ejecución | Admin |
|---|---|---|---|---|
| PA-001 | Actualizar datos de un título | Ficha película/serie; también Mi Biblioteca al añadir con IMDb | 1 título, web | Alta |
| PA-002 | Discovery de Novedades IMDb | Novedades → Buscar novedades | GitHub, datasets completos | Alta |
| PA-003 | Resolver candidato IMDb manual | Novedades → Añadir/Reintentar/Restaurar | GitHub, 1 IMDb | Media (auditoría, sin pipeline propio) |
| PA-004 | Incorporar candidato de Novedades al catálogo | Novedades → ＋ Añadir | 1 candidato, web | Alta |
| PA-005 | Sincronización Plex | Mi Biblioteca → Actualizar Plex | Bibliotecas Plex completas | Alta |
| PA-006 | Análisis de calidad de películas | Calidad/Películas → Actualizar | Universo películas | Alta |
| PA-007 | Actualización completa de series | Calidad/Series → Actualizar todas | GitHub, universo series | Muy alta |
| PA-008 | Reevaluación completa de identidad | Calidad/Identidad → Reanalizar/Actualizar todo | GitHub, por bloques | Muy alta |
| PA-009 | Refresco de datos con identidad conocida | Calidad/Identidad y post-validación | 1 título | Alta |
| PA-010 | Validación cruzada de identidad | Calidad/Validación → Actualizar | GitHub, reanudable | Muy alta |
| PA-011 | Recálculo de validación cacheada | Validación → Recalcular cacheadas | GitHub, cache-only | Alta |
| PA-012 | Reparación de calidad de datos | Calidad/Datos → Reparar ficha | 1 título, varias fuentes | Media |
| PA-013 | Reintento de fuente de datos | Calidad/Datos → fuente concreta | 1 título/1 fuente | Media |
| PA-014 | PikoQuality fase A | Calidad/PikoQuality | lotes 5.000 | Alta |
| PA-015 | PikoQuality fase B | Calidad/PikoQuality | lotes 120; retry 80; concurrencia 12 | Alta |
| PA-016 | PikoQuality agregados | Calidad/PikoQuality | reconstrucción global | Alta |
| PA-017 | Refresco de sagas | Sagas → refrescar | hasta 120; concurrencia 6 | Alta |
| PA-018 | Actualización masiva ratings IMDb | GitHub Actions | dataset completo; batch 500 | Baja |
| PA-019 | Piloto PikoQuality B persistente | Admin/PikoQuality Probe | muestra diagnóstica | Alta |
| PA-020 | Piloto PikoQuality B solo lectura | Calidad/PikoQuality Pilot | hasta 16 | Ninguna |
| PA-021 | Mantenimiento manual seguro | GitHub Actions | checks acotados | Ninguna |
| PA-022 | Prueba experimental de enriquecimiento | GitHub Actions | 1 título | Baja |

## Automatismos auxiliares que no reciben PA independiente

- **Auto-refresh visual de Calidad:** mientras Series/Identidad/Validación están `running`, la pantalla ejecuta `router.refresh()` cada **5 segundos**. Es observabilidad, no proceso de datos.
- **Disponibilidad manual de temporada:** Sí emitida / No disponible modifica un override; es una acción manual, no un proceso automático.
- **Exclusión/restauración/adquisición:** acciones CRUD/manuales, no PA.
- **Selección manual de FA ambiguo / reset búsqueda FA:** acciones manuales que preparan posteriores procesos de identidad, no procesos automáticos independientes.
- **Guardar criterios de Novedades / Calidad:** configuración, no ejecuta discovery/análisis automáticamente.
- **CI:** workflow automático al abrir/actualizar PR hacia main/develop; se considera automatización de ingeniería, no proceso funcional de PikoFilm.

## Hallazgo global de programación automática

Actualmente los workflows funcionales revisados (`imdb-discovery`, `imdb-manual-candidate`, `imdb-ratings-refresh`, `series-full-refresh`, `identity-full-refresh`, `identity-validation-refresh`, `identity-validation-recalculate`, `manual-maintenance`, `catalog-enrichment-test`) se disparan mediante `workflow_dispatch`; no hay `schedule/cron` funcional. `vercel.json` tampoco define crons. Por tanto, salvo CI de desarrollo y auto-refresh visual, los procesos funcionales son manuales/bajo demanda aunque algunos tengan cooldown o se ejecuten asíncronamente.

## Áreas/pantallas recorridas

- Inicio/Dashboard.
- Catálogo: principal, ficha película, ficha serie/miniserie, excluidas.
- Novedades: principal y Criterios IMDb.
- Mi Biblioteca/Plex.
- Calidad: centro, Datos, Películas, Series, detalle de serie, Identidad, Ambiguos, Validación de Identidad, PikoQuality, piloto PikoQuality.
- Sagas y detalle de saga.
- Personas/fichas enlazadas: lectura, sin PA específico detectado.
- Admin y Admin/PikoQuality Probe.
- Workflows y workers no expuestos directamente en navegación.

## Principales patrones de mejora detectados

1. Introducir estados homogéneos `partial` / `success_with_errors` / `cancelled`.
2. Llevar a `pipeline_runs` PA-003, PA-012, PA-013 y PA-018 para observabilidad homogénea.
3. Decidir qué procesos deben ser realmente programados y con qué frecuencia; hoy no existe cron funcional.
4. Homogeneizar retry/backoff, timeouts y recuperación por fuente.
5. Mostrar progreso/resultados fuente por fuente en procesos largos.
6. Revisar duplicidades/legacy: PA-019 vs PA-020 y PA-022 frente al enriquecimiento productivo.
7. Mantener la regla documental de añadir nuevos puntos de entrada al PA existente cuando reutilicen el mismo proceso.