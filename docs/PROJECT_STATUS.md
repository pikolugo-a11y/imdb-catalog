# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 20/08/2026 (Europe/Madrid)  
**Fase:** evolución UX V3 — portada de Calidad rediseñada; añadidos controles de actualización, última ejecución y trazabilidad Admin  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar trabajo funcional antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Hito Mi Biblioteca
`/plex` funciona como bandeja de entrada de elementos activos presentes en Plex y todavía ausentes del catálogo. La vista visual fue validada por el usuario el 20/08.

Incluye:
- tabla compacta;
- filtros Todos / Películas / Series, búsqueda y año;
- acción directa **Añadir al catálogo**;
- sin IMDb → **Resolver identidad**;
- sin ficha intermedia;
- última sincronización + **Actualizar Plex**;
- `added_at` rotulado **Añadido a Plex**;
- estado normal redundante eliminado;
- resumen superior compacto;
- estado vacío `Todo al día`.

## Alta parcial desde Plex
Caso de regresión: `tt5901280` / The River. Con identidad IMDb/Plex mínima fiable, TMDb no bloquea el alta: se conserva catalogado parcialmente, desaparece de Mi Biblioteca y queda pendiente en Calidad → Identidad. El proceso y el audit quedan trazados en Admin.

## Hito Calidad — portada V3
La portada `/calidad` deja de ser un simple menú y pasa a ser un centro de control operativo con:
- total de elementos que requieren atención;
- Películas, Series e Identidad separadas como áreas accionables;
- PikoQuality diferenciado como motor técnico;
- desglose de incidencias usando datos ya persistidos, sin crear motores paralelos;
- botones **Actualizar** directamente en Películas, Series e Identidad;
- fecha de última actualización por área;
- resumen de la última ejecución tras finalizar;
- revalidación de portada y páginas de detalle al terminar.

### Trazabilidad Admin revisada
Los tres procesos ya usan `pipeline_runs` canónico:
- Películas → `movie_quality_analysis`;
- Series → `series_v2_refresh`;
- Identidad → `identity_scan`.

Además, los nuevos disparadores desde la portada escriben `admin_events` tanto en éxito como en fallo (`refresh` / `refresh_failed`) con contadores o error estructurado. Por tanto, cada ejecución lanzada desde Calidad queda visible/auditable en Admin.

## Pendiente de aceptación
1. Deployment manual del HEAD actual de `main`.
2. Revisar visualmente `/calidad` con datos reales.
3. Ejecutar **Actualizar Películas** desde la portada y comprobar:
   - estado pending mientras corre;
   - mensaje final;
   - fecha/resumen de última actualización;
   - registro en Admin.
4. Repetir con **Series** e **Identidad**.
5. Confirmar que los contadores de la portada cambian tras una ejecución cuando el proceso añade/resuelve incidencias.

## Próximo paso exacto
Desplegar manualmente el HEAD actual de `main` y validar primero las tres actualizaciones desde la nueva portada de Calidad.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits de `main`.
