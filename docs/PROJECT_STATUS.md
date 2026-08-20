# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 20/08/2026 (Europe/Madrid)  
**Fase:** evolución UX V3 — portada general de Calidad cerrada; Calidad → Películas V3 implementada y pendiente de aceptación  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar trabajo funcional antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Hitos ya validados
- Mi Biblioteca `/plex`: bandeja Plex → Catálogo validada.
- Alta parcial desde Plex: TMDb no bloquea con identidad mínima fiable; regresión `tt5901280`.
- Portada general `/calidad`: Centro de Control V3 validado.
- Actualización completa de Series: eliminado límite funcional de 120; worker completo por GitHub Actions con progreso y trazabilidad.

## Hito actual — Calidad → Películas V3
Se ha rediseñado `/calidad/peliculas` según boceto aprobado y se ha corregido el motor antes de presentar los diagnósticos.

### Cambios funcionales
1. **Duración** conserva criterio conservador absoluto + relativo, pero ambos umbrales son configurables.
2. **Filename** deja de exigir simultáneamente título y año incorrectos. Calcula similitud normalizada de tokens contra títulos Plex/español/original/catálogo; puede alertar aunque el archivo no contenga año. Año incompatible incrementa riesgo.
3. **Calidad** deja de usar un segundo algoritmo de bitrate/resolución. Las alertas técnicas consumen el `score` ya persistido por PikoQuality. El umbral mínimo aceptable es configurable.
4. **Duplicados** se presenta como **Varias versiones**. Mantiene comparación de duraciones para distinguir duplicado probable de posible montaje distinto; PikoQuality se utiliza como señal preferente para recomendar la mejor versión cuando existe.
5. **Excepciones obsoletas** pasan a `resolved` cuando la anomalía ya no se detecta, manteniendo historial en `movie_quality_actions`.
6. No se borra ningún archivo automáticamente.

### Criterios configurables
Persistidos en `app_settings.movie_quality_v3` y editables dentro de la propia pantalla:
- diferencia mínima duración (minutos), default 10;
- diferencia mínima duración (%), default 15;
- similitud mínima filename, default 55%;
- PikoQuality mínimo aceptable, default 60;
- umbral versiones casi idénticas, default 2%;
- umbral de posible montaje distinto, default 10%.

Los cambios se aplican en el siguiente **Actualizar**, no retroactivamente. Cada cambio queda auditado en Admin (`admin_events`, action `update_criteria`).

### UX V3
- cabecera con última actualización y botón Actualizar;
- películas únicas que requieren atención y bloque de prioridad alta/crítica;
- KPIs por Duración / Varias versiones / Calidad / Nombre;
- estados Pendientes / Esperando Plex / Excepciones / Todas;
- filtros por detector, búsqueda y riesgo alto/crítico;
- criterios editables en bloque plegable;
- tarjetas en lenguaje humano sin JSON visible;
- PikoQuality visible en diagnóstico técnico;
- acciones **Es correcta** y **Ya la corregí**;
- paginación de 10 resultados.

### Trazabilidad
- análisis: `pipeline_runs.job_type='movie_quality_analysis'`;
- acciones manuales: `movie_quality_actions` + `admin_events` existentes;
- cambios de criterios: `admin_events`;
- criterios usados quedan también copiados en el summary de la ejecución.

Especificación dedicada: `docs/QUALITY_MOVIES_V3.md`.

## Pendiente de aceptación
1. Deployment manual del HEAD actual de `main`.
2. Abrir `/calidad/peliculas` y validar fidelidad visual al boceto.
3. Guardar un cambio inocuo de criterio y verificar registro en Admin.
4. Ejecutar **Actualizar** y comprobar que el summary refleja los criterios activos.
5. Validar al menos un caso de duración, filename, varias versiones y calidad/PikoQuality.
6. Confirmar que una excepción que deje de detectarse pasa a resuelta tras reanálisis.
7. Confirmar que **Es correcta** mantiene excepción si la fingerprint y anomalía siguen iguales.

## Próximo paso exacto
Desplegar manualmente `main` y validar Calidad → Películas V3 con datos reales antes de cerrar la subpantalla.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. `docs/QUALITY_MOVIES_V3.md`.
6. Issues abiertas y últimos commits de `main`.
