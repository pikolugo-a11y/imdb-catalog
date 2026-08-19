# PikoFilm V3 — Plan de implementación y baseline V2

Fecha de congelación inicial: 2026-08-19
Baseline GitHub revisado: `main` en `c14b8ee62d001d5144b385849b1d85f26d189a90`.

## Regla de trabajo V3

1. GitHub es la fuente de verdad.
2. Se implementa por paquetes con dependencias explícitas.
3. Las pantallas se hacen **siempre de una en una**.
4. Antes de modificar una pantalla se inventarían sus capacidades V2 reales en código y documentación.
5. V3 puede ampliar o reorganizar esas capacidades, pero **no puede eliminar ninguna funcionalidad V2 sin decisión explícita del usuario**.
6. Todas las pantallas reutilizan el shell/componentes comunes de #70 para conservar una estética coherente.
7. Flujo de validación por pantalla:
   - diseño/implementación;
   - aviso de commit/HEAD listo;
   - deployment manual a producción por el usuario;
   - batería de pruebas preparada por ChatGPT, incluyendo regresión V2 y requisitos V3;
   - usuario comunica resultados;
   - PASS y cierre, o corrección/rediseño y nueva validación;
   - solo entonces se empieza la siguiente pantalla.
8. No se despliegan varias pantallas V3 para validarlas juntas.
9. Procesos y migraciones deben respetar las reglas operativas permanentes del proyecto y quedar trazables cuando corresponda.

## Paquetes de implementación

### Paquete 0 — Baseline y cierre V2
- Congelar inventario funcional de las rutas actuales.
- Resolver los pendientes operativos previos que condicionen V3, especialmente #42 y su relación con #38.
- Este documento es el contrato de no regresión para las pantallas.

### Paquete 1 — Cimientos canónicos de datos
- #49 Países canónicos.
- #50 Géneros canónicos.
- Migraciones/backfills seguros, idempotentes y trazables.
- Sin rediseño masivo de pantallas.

### Paquete 2 — Shell y sistema común V3
- #70 Shell global.
- Navegación desktop/móvil, header, layout, componentes y estados comunes.
- Debe poder convivir temporalmente con pantallas aún V2.

### Paquete 3 en adelante — Una pantalla por ciclo
Orden inicial recomendado, revisable por dependencias reales:
1. Catálogo #55 (+ #29 y partes aplicables de #51).
2. Excluidas #59.
3. Ficha de película #52.
4. Ficha de serie #56.
5. Mi biblioteca / Plex #60.
6. Calidad portada #61.
7. Calidad películas #62 (+ #44).
8. Calidad series #63.
9. Calidad metadatos e identidad #64 (+ #46).
10. Sagas índice #54.
11. Saga ficha #54, validada como pantalla independiente.
12. Personas listado #65 (+ #45).
13. Persona ficha #66.
14. Novedades #57 (+ #38/#42).
15. Criterios IMDb #58.
16. Admin #67.
17. Backup/restauración #68 (+ #53).
18. Dashboard #47, deliberadamente tarde por sus numerosas dependencias.

La búsqueda global #48/#69 se integrará con el shell y se activará cuando las entidades de destino necesarias estén estabilizadas; no debe obligar a rehacer cada pantalla.

## Baseline funcional V2 por ruta

Este inventario es mínimo obligatorio. Antes de implementar cada pantalla se vuelve a revisar su código HEAD para detectar cambios posteriores a esta congelación.

### `/` — Dashboard
- KPIs navegables: catálogo, películas/series, Plex, faltantes, en proceso, Plex fuera de catálogo, calidad, identidad, episodios faltantes, sagas incompletas y procesos fallidos.
- Bloque `Necesita atención` con navegación a las áreas operativas.
- Evolución con periodos 7/30/90/365 días y empty state si no hay histórico suficiente.
- Distribuciones Plex por resolución y codec.
- Distribuciones por género y país.
- Cobertura por décadas.
- Última sincronización Plex.

### `/catalogo` — Catálogo
- Consulta de películas y series.
- Grid de carátulas y vista lista.
- Búsqueda textual.
- Tipo: Todo/Películas/Series.
- Estado: Todos/Faltan/En proceso/En Plex.
- Filtro de género.
- Filtro de año.
- Limpiar filtros.
- KPIs de resultados, En Plex, En proceso y Faltan.
- Navegación a ficha conservando contexto mediante `from`.
- Acción rápida `En proceso` para títulos no presentes en Plex.
- Exclusión reversible.
- Tras excluir, feedback y `Deshacer` sin provocar 404.
- Acceso visible a Excluidas.

### `/catalogo/excluidas` — Excluidas
- Listado de títulos excluidos.
- Restauración al catálogo operativo.
- Mantener la exclusión como reversible; nunca tratarla como borrado físico del título.
- Debe seguir siendo compatible con el flujo seguro de #29.

### `/catalogo/[imdbId]` — Ficha de título
- Mantener todos los metadatos, estados, relaciones, navegación y acciones actualmente disponibles en la ficha antes de aplicar #52/#56.
- Mantener retorno al contexto de origen.
- Mantener exclusión/restauración y acciones operativas existentes sin 404.
- El inventario detallado se vuelve a extraer del código inmediatamente antes de implementar esta pantalla.

### `/plex` — Mi biblioteca
- Fuente de inventario físico Plex.
- KPIs películas, series, en catálogo y por incorporar.
- Modos: No están en catálogo / En catálogo / Todos.
- Tipo: Todo/Películas/Series.
- Búsqueda.
- Año.
- Paginación.
- Sincronización Plex manual.
- Estado catálogo/exclusión y PikoScore cuando existe.
- Navegación a ficha para catalogados.
- Restauración para catalogados excluidos.
- `Añadir al catálogo` para Plex no catalogado con IMDb resuelto.
- `Resolver identidad` cuando falta IMDb.
- Última sincronización visible.

### `/calidad`
- Portada/entrada a las áreas de calidad existentes.
- Debe conservar todos los accesos actuales al migrar a #61.

### `/calidad/peliculas`
- Controles e incidencias de calidad de películas existentes.
- Acciones actuales de diagnóstico/corrección.
- El inventario detallado se congela de nuevo antes de #62.

### `/calidad/series`
- Análisis específico de series, no tratado como películas.
- Cobertura/estado por serie y navegación al detalle.
- El inventario detallado se congela de nuevo antes de #63.

### `/calidad/series/[ratingKey]`
- Detalle estructural de la serie/temporadas/episodios y sus incidencias actuales.
- No perder ninguna capacidad de diagnóstico o reconciliación.

### `/calidad/identidad`
- Diagnóstico y reconciliación de identidad existente.
- Resolver títulos Plex sin identidad suficiente.
- Protección de IDs/correcciones manuales existente.
- No duplicar este motor en V3.

### `/sagas` y ficha de saga
- Consulta de sagas, cobertura y estados existentes.
- Navegación a títulos.
- Mantener la semántica actual de completas/incompletas/no iniciadas y cualquier búsqueda/orden vigente.
- Índice y ficha se validarán como pantallas separadas aunque #54 las agrupe funcionalmente.

### `/personas` y ficha de persona
- Navegación/consulta de personas y filmografía ya disponible.
- Presencia/faltantes respecto a la BBDD cuando exista.
- No introducir explotación específica de directores fuera del alcance acordado en #71.

### `/novedades`
- Propuestas IMDb persistidas.
- Estados y motivos de candidatura.
- Añadir/ampliar datos reutilizando pipeline canónico.
- Excluir reutilizando exclusiones canónicas.
- Alta manual por IMDb.
- Acceso a criterios.
- Discovery manual; no prometer automatismo inexistente.
- Respetar límite semanal de #42.

### `/novedades/criterios`
- Consulta/edición de criterios IMDb persistidos.
- Reglas generales/españolas y países excluidos según #38.
- Acciones compatibles con la política operativa #42.

### `/admin`
- Consola de procesos y trazabilidad existente.
- Estados/últimas ejecuciones/errores y operaciones actuales.
- Debe absorber las nuevas operaciones V3 sin perder las V2.

## Plantilla obligatoria de validación por pantalla

Antes del deploy de cada pantalla se generará una matriz con:

| ID | Tipo | Prueba | Resultado esperado |
|---|---|---|---|
| V2-* | Regresión | Funcionalidad existente | Se comporta igual o mejor que V2 |
| V3-* | Nueva | Requisito de issue V3 | Cumple contrato V3 |
| UX-* | Visual | Coherencia #70/mockup | Sin desviaciones no aprobadas |
| MOB-* | Responsive | Móvil | Sin overflow/pérdida funcional |
| ERR-* | Robustez | empty/error/mutación | Estado seguro y comprensible |

Una pantalla solo obtiene PASS cuando pasan regresión V2 + requisitos V3 + móvil + robustez y el usuario aprueba visualmente el resultado.
