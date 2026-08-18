# PikoFilm V2 — Baterías de pruebas de aceptación

Estas pruebas validan las issues #24–#31 antes y después del pase a producción. Para cada caso anota **OK / KO / comentario** y, si falla, captura de pantalla y hora aproximada para localizar el run en Admin.

## Batería A — Biblioteca / Plex (#24)
1. Abrir **Biblioteca**. Debe abrir por defecto `No están en catálogo`.
2. Confirmar que todos los elementos visibles existen realmente en Plex.
3. Cambiar a `En catálogo`: todos deben existir en Plex y en PikoFilm.
4. Cambiar a `Todos`: debe ser la unión de las dos vistas anteriores.
5. Probar `Todo / Películas / Series` y comprobar que son botones visibles, no combo.
6. Buscar un título conocido y filtrar por año.
7. En un título `No está en catálogo` con IMDb, pulsar `Añadir al catálogo`.
8. Tras completarse, volver a Biblioteca: el título debe seguir existiendo pero pasar a `En catálogo`.
9. En un título sin IMDb, debe ofrecer `Resolver identidad`, no desaparecer ni fallar.
10. Lanzar `Actualizar Plex`; verificar en **Admin** un run con total, altas, cambios, bajas, errores y duración.

## Batería B — Calidad de películas V2 (#25)
1. Entrar en **Calidad → Películas** y ejecutar `Analizar / Reanalizar calidad`.
2. Verificar que Admin crea un run `movie_quality_analysis` y que finaliza con volúmenes.
3. Revisar que aparecen incidencias diferenciadas: duración, filename, duplicado y calidad.
4. Abrir varios casos de duración: deben mostrar duración Plex, catálogo, diferencia absoluta y %.
5. Confirmar que no se marcan masivamente películas normales como baja calidad.
6. Revisar un duplicado: debe mostrar duración y recomendación; si las duraciones difieren mucho no debe recomendar borrado automático.
7. Marcar una incidencia como `Excepción / Correcta`; reanalizar y comprobar que no vuelve mientras el fingerprint no cambie.
8. Marcar otra como `Esperando sincronización`; tras cambiar el archivo y sincronizar Plex, reanalizar y comprobar que se resuelve o vuelve a pendiente si persiste.
9. Buscar por título y filtrar por tipo/estado con controles visibles cuando haya pocas opciones.
10. Verificar en Admin el resumen por tipo, procesados, incidencias y errores.

## Batería C — Series V2 (#27)
1. Entrar en **Calidad → Series**. La vista principal debe mostrar solo faltantes accionables.
2. Confirmar que episodios con disponibilidad `UNKNOWN` no aparecen como faltantes principales.
3. Abrir una serie y revisar resumen por temporada.
4. Una temporada `ES_NOT_YET` no debe generar episodios faltantes accionables.
5. Una temporada `ES_AVAILABLE` debe considerar faltantes solo los episodios ausentes de Plex.
6. Una temporada `ES_PARTIAL` debe respetar fechas emitidas; episodios futuros no deben aparecer como faltantes.
7. Probar excepción manual `Disponible en España` y `No disponible todavía`.
8. Pulsar `Actualizar / Reanalizar series` y comprobar que no reconstruye innecesariamente todo si nada cambió.
9. Comprobar que la ficha muestra presentes, faltantes ES y desconocidos con claridad.
10. Revisar Admin: series, temporadas, episodios presentes, faltantes accionables, desconocidos, errores y duración.

## Batería D — Sagas V2 (#28)
1. Abrir **Sagas**: debe abrir por defecto `Incompletas`.
2. Probar `Me falta solo 1`; todas las sagas listadas deben tener exactamente una película ausente.
3. Probar `Completas`, `No empezadas` y `Todas`.
4. Verificar progreso `X/Y`, porcentaje y número faltante en tarjetas.
5. Ordenar por `Más fácil de completar`, porcentaje, score y nombre.
6. Abrir una saga: cada miembro debe estar marcado como `En Plex`, `En catálogo · falta` o `Fuera del catálogo`.
7. Una película añadida a Plex debe aumentar cobertura tras sync sin necesitar refrescar TMDb.
8. Ejecutar `Actualizar sagas`; comprobar que se refrescan colecciones y miembros.
9. Verificar que las sagas complejas/editoriales siguen separadas de colecciones TMDb automáticas cuando proceda.
10. Revisar Admin: colecciones revisadas, miembros, cambios, errores y duración.

## Batería E — UX global + exclusiones (#29)
1. Desde una ficha, pulsar `Excluir`: **no debe aparecer 404**.
2. Debe regresar al contexto/listado anterior y mostrar feedback de exclusión.
3. Pulsar `Deshacer` si aparece y comprobar recuperación inmediata.
4. Entrar en `Excluidas`; localizar la película y pulsar `Restaurar`.
5. Confirmar que vuelve al catálogo.
6. Revisar Catálogo, Biblioteca, Calidad, Series, Sagas y Dashboard: opciones de 2–4 valores deben usar botones/chips/tabs, no selects.
7. Entrar en una ficha desde una búsqueda filtrada y volver: filtros y contexto deben conservarse razonablemente.
8. Revisar móvil: sin overflow horizontal, botones táctiles suficientes y acciones principales claras.
9. Revisar estados vacíos, mensajes de éxito/error y cargas.
10. Confirmar que exclusión/restauración aparecen en auditoría Admin.

## Batería F — Dashboard V2 (#30)
1. Abrir Inicio: los KPIs no deben estar a cero salvo que el dato real sea cero.
2. Comparar `Catálogo`, `En Plex`, `Faltan`, `En proceso`, `Excluidas` con sus vistas respectivas.
3. Comprobar porcentaje de cobertura Plex.
4. Revisar gráficos por década, resolución, codec, género y país.
5. Cambiar periodo `7 / 30 / 90 / 365 días` mediante botones visibles.
6. Verificar que los KPIs accionables navegan al filtro correcto.
7. Revisar `Necesita atención`: identidad, calidad, series, sagas, Plex fuera de catálogo y procesos fallidos.
8. Tras una sync Plex o análisis de calidad, recargar Inicio y comprobar que cambia la foto actual.
9. Tras existir varios snapshots, comprobar evolución temporal y tendencia.
10. Revisar que el Dashboard carga rápido y no bloquea la navegación.

## Batería G — Identidad IMDb / TMDb / FilmAffinity (#31)
1. Entrar en **Calidad → Identidad**.
2. Verificar contadores `Falta IMDb`, `Falta TMDb`, `Falta FA`, `Dudosas`.
3. Filtrar por Películas/Series mediante botones visibles.
4. Elegir un título con ID faltante y pulsar `Reintentar / Actualizar`.
5. Si se resuelve, debe desaparecer de la incidencia correspondiente.
6. En uno que no se resuelva, editar manualmente IMDb/TMDb/FA y guardar.
7. Abrir una ficha de película y comprobar bloque `Identificadores` editable.
8. Cambiar un TMDb o FA de prueba por el correcto, guardar y actualizar; verificar metadatos resultantes.
9. Los IDs manuales confirmados no deben ser reemplazados silenciosamente en el siguiente refresh.
10. Revisar Admin/auditoría: valor modificado, origen manual, reintento y resultado.

## Batería H — Admin / observabilidad (#26)
1. Abrir **Admin** y comprobar que muestra procesos recientes ordenados.
2. Un run completado debe mostrar inicio, fin, duración, procesados, altas/actualizados/omitidos, errores y estado.
3. Expandir un run y comprobar `summary` legible y etapa final.
4. Provocar únicamente si es seguro un fallo controlado (por ejemplo un ID inválido en una acción que lo valide) y comprobar que queda error comprensible; no realizar cambios destructivos.
5. Lanzar sucesivamente: sync Plex, reanálisis calidad, refresh series, refresh sagas y reanálisis identidad. Todos deben dejar run.
6. Comprobar eventos de auditoría de exclusión/restauración y edición de IDs.
7. Filtrar Admin por estado/tipo de trabajo.
8. Verificar que no quedan nuevos runs eternamente en `running` tras completar o fallar.
9. Comprobar que un fallo parcial informa del volumen completado y la etapa donde falló.
10. Confirmar que la información basta para diagnosticar un fallo sin entrar directamente en Neon.

## Batería I — Regresión general
1. Catálogo sigue buscando y filtrando correctamente.
2. Fichas de películas siguen cargando portada, notas, créditos y estado Plex.
3. `En proceso` sigue funcionando y puede revertirse.
4. Plex sync sigue tardando un tiempo razonable similar al comportamiento previo.
5. `Añadir al catálogo` sigue ejecutando IMDb + FilmAffinity + TMDb.
6. No aparecen errores 404 inesperados al mutar estados.
7. Navegación principal funciona en desktop y móvil.
8. No hay errores visibles de hidratación/JS.
9. Ningún proceso nuevo borra inventario Plex ni catálogo base.
10. Tras cada proceso importante, Admin refleja exactamente qué ocurrió.

## Formato recomendado para devolver resultados
Puedes responder por bloques, por ejemplo:

`A1 OK · A2 OK · A3 KO: ...`

O simplemente enviarme capturas/comentarios mientras pruebas; yo los convertiré en incidencias concretas y priorizadas.
