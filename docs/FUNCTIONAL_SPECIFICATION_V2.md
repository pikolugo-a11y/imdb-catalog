# PikoFilm V2 — Documento funcional

**Estado:** V2 estable + Novedades V1, aceptación en curso; #42 ampliada para ejecución desde frontal · 19/08/2026  
**Propósito:** especificación funcional viva. Debe actualizarse antes de cada deployment con cambios funcionales relevantes.

## 1. Visión y objetivo
PikoFilm es un sistema personal de gobierno de catálogo audiovisual. Separa catálogo editorial, inventario físico Plex, candidatos de Novedades, exclusiones reversibles, calidad/identidad y datos derivados de Series/Sagas. Cada pantalla debe responder a una pregunta concreta sin destruir información ni mezclar universos.

## 2. Conceptos funcionales
### Catálogo
Universo editorial seleccionado. Un título puede estar completamente enriquecido o tener fuentes/datos pendientes. Puede estar `En Plex`, `Falta` o `En proceso`.

### Plex
Inventario físico real. Biblioteca representa exclusivamente elementos activos presentes en Plex.

### Novedades
Staging temporal de candidatos todavía no incorporados. IMDb decide elegibilidad automática por rating/votos; el usuario decide incorporar, excluir o retirar.

### Identidad
IMDb es el identificador central del pipeline. TMDb, FilmAffinity y TVDb cuando proceda enriquecen/cruzan identidad. Correcciones manuales confirmadas tienen prioridad.

### Exclusión
Excluir no borra. `catalog_exclusions` aparta un título de vistas operativas y permite restaurarlo. **Excluidas debe ser claramente descubrible**: acceso visible desde Catálogo y desde Novedades, no un enlace escondido.

## 3. Dashboard
Centro de control con KPIs de catálogo/Plex, faltantes, en proceso, calidad/identidad, episodios, sagas, procesos y evolución temporal. Los KPIs operativos ignoran excluidos y series Plex inactivas cuando corresponda.

## 4. Catálogo
Búsqueda/filtros por tipo, estado, género, año y otros criterios; grid/lista y acciones rápidas. La cabecera debe ofrecer un acceso visible **Ver excluidas**. La exclusión es reversible y no debe provocar 404.

## 5. Biblioteca / Plex
Solo elementos activos presentes en Plex. `Actualizar Plex` refresca altas/cambios/bajas y cruces. En Series, un cambio de identidad invalida referencias derivadas antiguas para que el análisis posterior reconstruya la correcta. Una serie borrada deja de participar inmediatamente en Calidad/KPIs aunque se conserve histórico.

## 6. Calidad — Películas
Analiza duración, filename, duplicados y calidad técnica relativa. SD/720p no son malas por definición. No elimina archivos automáticamente. Excepciones y espera de sincronización son reversibles.

## 7. Calidad — Identidad / Faltan datos
Detecta IMDb/TMDb/FilmAffinity ausentes o incoherentes y permite reintento/edición manual. Un título catalogado con enriquecimiento parcial debe aparecer aquí (o en el mecanismo canónico equivalente) indicando qué falta y permitiendo completar posteriormente la misma fila.

## 8. Calidad — Series
TMDb aporta referencia oficial y disponibilidad España. La vista principal usa faltantes accionables; desconocidos no se confunden con faltantes. Shows Plex inactivos y excluidos no participan. `Actualizar Series` mantiene trazabilidad y margen suficiente de ejecución.

## 9. Sagas
Clasifica incompletas/completas/no iniciadas, muestra cobertura y miembros. Colecciones TMDb son base automática y universos PikoFilm permiten agrupaciones editoriales. Excluidos no contaminan cobertura.

## 10. Personas
Navegación por reparto/personas y filmografía relacionada cuando existen créditos.

## 11. Administración
`pipeline_runs` registra procesos, estado, tiempos, contadores, errores y resumen estructurado. Todo proceso operativo relevante debe ser auditable.

## 12. Enriquecimiento individual
Existe un único pipeline canónico de enriquecimiento. **Catalogación y enriquecimiento son separables.** Si existe identidad mínima fiable, la ausencia temporal de TMDb, FilmAffinity, carátula, rating secundario u otra fuente complementaria no provoca rollback: se guardan los datos disponibles, el título queda catalogado y Calidad muestra lo pendiente. Solo identidad insuficiente, duplicidad o riesgo de integridad bloquean el alta.

### IMDb on-demand
Un alta desde Plex con IMDb válido puede intentar rating/votos desde `title.ratings.tsv.gz` en streaming. Si no está aún disponible, el resto del enriquecimiento continúa. Regresión: `First Lady` (`tt15787006`, TMDb `158808`).

## 13. Reglas transversales
1. Plex = presencia física; Catálogo = selección editorial.
2. IMDb = punto de entrada de Novedades.
3. Exclusión reversible, nunca borrado como representación de estado.
4. Excluidos no participan en operaciones donde no correspondan.
5. IDs manuales confirmados no se sobrescriben silenciosamente.
6. Sincronizaciones rápidas separadas de análisis externos pesados.
7. Trazabilidad obligatoria.
8. Procesamiento incremental/streaming/SQL agregado cuando sea viable.
9. Ningún diagnóstico elimina archivos automáticamente.
10. Documentación funcional, técnica y bitácora se mantienen vivas.
11. Fuente secundaria ausente no bloquea alta con identidad mínima fiable.
12. Deployments de producción los realiza manualmente el usuario; pruebas funcionales/visuales también las realiza el usuario.

## 14. Novedades V1
### 14.1 Fuente y criterios
Sin scraping IMDb. Discovery por `title.ratings.tsv.gz` + `title.basics.tsv.gz` en streaming. Umbrales configurables persistidos:
- películas generales 6,0 / 10.000 votos;
- series/miniseries generales 7,0 / 5.000;
- películas españolas 6,0 / 7.500;
- series españolas 6,5 / 4.000.

### 14.2 España e India
Rescate España resuelve país solo para la zona que no cumple regla general pero puede cumplir regla española. Coproducción con España cuenta. India (`Q668`/`IN`) permanece inicialmente excluida mediante configuración reversible.

### 14.3 Cruces y estados
Automático visible = cumple regla activa + no catalogado + no excluido + no país globalmente excluido. Si deja de cumplir pasa a no elegible sin borrar histórico. Manuales permanecen hasta incorporar, excluir o retirar.

### 14.4 Alta manual
Se puede introducir cualquier `tt...`. Ya catalogado no duplica. Excluido exige restauración explícita. Retirar un manual no lo convierte en exclusión.

### 14.5 Excluir / restaurar
Excluir desde Novedades reutiliza `catalog_exclusions`. Desaparece inmediatamente y no reaparece hasta restauración. Novedades muestra acceso visible **Excluidas** con contador; Catálogo también ofrece acceso prominente.

### 14.6 Añadir al catálogo — contrato #43
`Añadir` reutiliza el pipeline canónico. Con identidad mínima IMDb fiable, el título entra en Catálogo aunque TMDb/FA/otra fuente secundaria falle; se marca enriquecimiento parcial, desaparece de Novedades y queda diagnosticado en Calidad/Faltan datos. Solo identidad mínima insuficiente o integridad insegura conserva el candidato reintentable sin catalogar. Regresión: `tt38268282`.

### 14.7 Ejecución discovery — contrato #42
**Solo manual y siempre iniciada por una acción explícita del usuario.** No existe cron diario, `schedule` ni polling cada 5 minutos. El workflow usa únicamente `workflow_dispatch`. El worker impone un máximo de **una ejecución exitosa cada 7 días** y rechaza intentos prematuros antes de procesar datasets.

La web no crea solicitudes `pending`. `Buscar novedades ahora` se ejecuta desde el propio frontal de PikoFilm: una Server Action autenticada solicita a GitHub Actions una única ejecución del workflow y vuelve inmediatamente a la UI. La credencial necesaria vive solo como secreto de producción en Vercel y nunca se expone en navegador, repositorio, documentación o logs.

Cuando existe cooldown, el botón permanece bloqueado y muestra la próxima fecha permitida. Para aceptación técnica puede habilitarse una **excepción controlada de una sola ejecución**: se consume atómicamente al solicitar el workflow, se envía como `force_once=true`, queda trazada y, tras una ejecución exitosa, la regla semanal vuelve a gobernar automáticamente desde esa nueva fecha. Si GitHub rechaza el dispatch, la excepción se devuelve para no consumirla por un fallo técnico.

### 14.8 UX compacta — contrato #41
Novedades es una herramienta operativa densa, no una sucesión de tarjetas enormes:
- cabecera compacta;
- acciones visibles: Criterios, Excluidas, Buscar novedades;
- KPIs en una fila compacta: propuestas, películas, series, último discovery;
- alta IMDb manual + tipo + búsqueda + orden en toolbar compacta;
- tabla/listado con título, año, tipo, IMDb, votos, país, motivo y fecha;
- acciones directas por fila: **Ver, IMDb, Añadir, Excluir**; `Retirar` adicional para manuales;
- ficha de candidato `/novedades/[imdbId]`;
- paginación 24/48/96;
- responsive móvil sin perder acciones.

### 14.9 Rendimiento
Render normal lee Neon, no enriquece masivamente. Worker filtra ratings antes de basics, resuelve país selectivamente y escribe por lotes.

## 15. Flujos principales
**Plex nuevo:** Actualizar Plex → fuera de catálogo → Añadir → identidad mínima → enriquecimiento best-effort → Catálogo → Calidad si parcial.

**Novedad automática:** usuario pulsa Buscar novedades → dispatch único GitHub Actions → guard semanal/override único si procede → reglas/país → Novedades → decisión → Catálogo parcial/completo o Exclusión.

**Novedad manual:** introducir IMDb → validar catálogo/exclusión → Novedades → Añadir/Excluir/Retirar.

**Serie mal asociada:** corregir Plex → Actualizar Plex → invalidar referencia → Actualizar Series → reconstruir.

**Exclusión:** excluir → desaparecer de operaciones → conservar registro → restaurar explícitamente.

## 16. Regresiones obligatorias
- Castle: identidad Plex corregida no deja referencia antigua activa.
- Love is in the Air: inactiva no aparece en Calidad/KPIs.
- First Lady: rating/votos IMDb on-demand sin perder TMDb.
- Novedades: catalogados/excluidos no reaparecen.
- India excluida mientras esté configurada.
- Rescate España solo con participación española confirmada.
- Manual excluido exige restauración explícita.
- Discovery sin cron/polling y cooldown semanal.
- Discovery manual se puede lanzar desde el frontal con secreto server-side; la excepción de aceptación solo puede consumirse una vez.
- `tt38268282`: TMDb ausente no bloquea catalogación; queda incompleto en Calidad.
- Excluidas: acceso visible desde Catálogo y Novedades.

## 17. Aceptación
Código no equivale a aceptación. Las issues #29/#38/#41/#42/#43 permanecen abiertas hasta deployment manual y PASS explícito del usuario. Las pruebas funcionales/visuales se realizan siempre por el usuario desde producción.
