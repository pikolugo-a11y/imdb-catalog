# PikoFilm — Plan canónico de implantación Lifecycle en 8 fases

**Recuperado y fijado:** 24/08/2026  
**Propósito:** conservar en el repositorio el plan de implantación que guía el trabajo de Lifecycle/Batch Engine/Autopilot para que no dependa del contexto de un chat.

> IMPORTANTE: este documento es el checklist de implantación. Los escalones 1/5/25/100/... son pruebas de capacidad dentro de la fase correspondiente; **no son fases nuevas del roadmap**.

## Fase 1 — Mapa canónico de procesos Lifecycle

Congelar la receta exacta de cada estado Lifecycle a partir de la implementación unitaria vigente: disparador/precondición, fuentes y orden, campos que puede modificar, condición de éxito, condición de pendiente, condición de revisión manual y siguiente estado.

Estados cubiertos: `IDENTITY_PENDING`, `IDENTITY_VALIDATION`, `IDENTITY_REVIEW_REQUIRED`, `DATA_INCOMPLETE`, `PIKOSCORE_PENDING`, `MOVIE_FILE_PENDING`, `MOVIE_FILE_REVIEW`, `SERIES_SYNC_PENDING`, `SERIES_REVIEW`, `TECH_PENDING`, `COMPLETE`, `EXCLUDED`.

**Estado:** COMPLETADA. Fuente detallada: `docs/LIFECYCLE_CANONICAL_PROCESSES.md`.

## Fase 2 — Lifecycle Orchestrator

Cambiar el modelo mental del batch: un job no representa una API/fuente, sino **un proceso Lifecycle para un título**. TMDb, Wikidata, OMDb, FilmAffinity, Plex, etc. son pasos internos con checkpoints. Al finalizar, Lifecycle se recalcula y decide el siguiente estado. Nunca se salta una fase ni se crea un pipeline paralelo al Lifecycle.

**Estado:** COMPLETADA en su núcleo y conectada a las recetas canónicas implementadas.

## Fase 3 — Observabilidad funcional y anti-bucle

Registrar por step: intento, fuente, hallazgo, cambio, before/after, motivo, duración y error. Registrar por job Lifecycle antes/después, campos modificados y resultado funcional.

Resultados canónicos: `CORREGIDO`, `ACTUALIZADO_SIN_AVANCE`, `SIN_CAMBIOS`, `NO_ENCONTRADO`, `INCOMPLETO`, `REVISION_MANUAL`, `ERROR`.

Persistir política anti-bucle/reintento: `attempt_count`, `last_attempt_at`, `last_outcome`, `next_retry_at`, `context_signature`, `manual_review`, `last_job_id`; los no encontrados/sin cambios no deben entrar indefinidamente en el siguiente lote.

**Estado:** COMPLETADA y probada durante los pilotos.

## Fase 4 — Conectar todas las etapas al worker canónico y validarlas unitariamente

Implementar cada receta en el worker Lifecycle usando la misma semántica que el unitario del frontal. Validar título a título antes de permitir masivos. Incluye las dos ramas del flujo: películas y series, y debe detenerse siempre en estados de revisión humana.

Validación E2E objetivo de película: `IDENTITY_PENDING → IDENTITY_VALIDATION → DATA_INCOMPLETE → PIKOSCORE_PENDING → MOVIE_FILE_PENDING → TECH_PENDING/COMPLETE` según presencia física y calidad.

Validación de series: `SERIES_SYNC_PENDING → SERIES_REVIEW/TECH_PENDING/COMPLETE`, con referencia oficial, temporadas, episodios, disponibilidad ES, dobles y extras correctamente clasificados.

**Estado:** MUY AVANZADA / validación unitaria principal completada. Se corrigieron durante esta fase, entre otros, FilmAffinity cross-runtime, archivos de película, PikoQuality, Series y episodios dobles de Friends.

## Fase 5 — Integración y revisión del frontal

Recorrer el frontal pantalla por pantalla para que la UI refleje el Lifecycle real y no conserve procesos masivos heredados ni estados paralelos. Cada cola debe listar correctamente sus títulos; las acciones manuales deben ser unitarias y comprensibles; los overrides deben ser explícitos y reversibles; las fichas deben permitir refrescar la entidad adecuada sin lanzar trabajo masivo desde Vercel.

Incluye como mínimo Calidad/colas, Identidad, Validación, Datos/PikoScore, películas/archivo/PikoQuality, Series/listado/ficha, estados de revisión, Admin/Batch y feedback de ejecución.

**Estado:** EN CURSO. Ya se han corregido Series → Todas, ficha de Friends, refresco desde ficha y overrides de disponibilidad; el recorrido del frontal no debe darse por terminado hasta completar todas las pantallas previstas.

## Fase 6 — Validación controlada en masa y límites reales de fuentes

Pasar de unitario a lotes crecientes sin cambiar la semántica: micro-lote y después escalones superiores. Medir captura exclusiva, idempotencia, leases, reintentos, transición Lifecycle, consumo, errores y comportamiento de cada fuente. Al acabar cada piloto: motor pausado y presupuestos normales restaurados.

Los escalones `5 → 25 → 100 → ...` pertenecen a **esta fase**, no constituyen un roadmap separado. Los límites deben seguir la política oficial de cada fuente. Para Wikidata/WDQS: concurrencia controlada, User-Agent identificable, timeout compatible con WDQS y respeto de `Retry-After` en 429; no inventar una frecuencia fija como sustituto de la política real.

**Estado:** EN CURSO. `IDENTITY_PENDING` ha superado lote 5 y lote 25 con la política Wikidata corregida. El siguiente escalón de capacidad es 100, pero no implica saltarse la Fase 5 ni declarar terminada toda la implantación.

## Fase 7 — Autopilot encadenado y tratamiento de excepciones

Activar el encadenamiento automático: `Lifecycle decide → worker ejecuta solo la siguiente acción segura → recalcula → continúa o se detiene`. Debe detenerse ante `*_REVIEW*`, `EXCLUDED`, error persistente, presupuesto agotado o breaker/cooldown de fuente. Probar reanudación, cancelación, cambio de contexto y que ningún estado de revisión sea autoaceptado.

Esta fase valida el flujo completo, no solo batches aislados por stage.

**Estado:** PENDIENTE de activación completa. La infraestructura existe, pero no debe abrirse Autopilot general hasta cerrar las validaciones anteriores.

## Fase 8 — Puesta en producción autónoma, frontal operativo y cierre de legado

Dejar Lifecycle como único camino productivo: ejecución autónoma segura en Railway, Neon como state plane, Vercel como control plane, GitHub Actions solo CI/mantenimientos acotados. Completar el frontal de operación/seguimiento, métricas, revisión manual, recuperación y controles de pausa/cancelación. Retirar o deshabilitar definitivamente cualquier camino batch antiguo que compita con Lifecycle y documentar operación y costes.

Criterio de cierre: una sola fuente de verdad de estado, una sola receta por etapa, automatización reanudable/idempotente, revisiones humanas protegidas, límites externos respetados y frontend coherente con el motor real.

**Estado:** PENDIENTE.

---

## Reglas de oro durante la implantación

1. No reinterpretar/rediseñar una fase funcional mientras se está validando otra salvo bug real que bloquee el plan.
2. No confundir escalado de lotes con fases del roadmap.
3. Primero unitario; después lote pequeño; aumentar solo con métricas estables.
4. Un estado `*_REVIEW*` nunca se autoacepta.
5. `EXCLUDED` nunca se procesa automáticamente.
6. Vercel es control plane y sus deployments de frontend son manuales por decisión del usuario.
7. Railway es execution plane; los workers pueden desplegarse operacionalmente cuando sea necesario y debe verificarse el commit exacto.
8. Al finalizar una prueba controlada: pausar motor y restaurar presupuestos normales.
9. Respetar límites oficiales de las fuentes, `Retry-After`, backoff y circuit breakers; no inventar ritmos como sustituto de su política.
10. Mantener Neon eficiente: evitar payloads grandes, lecturas masivas innecesarias y crecimiento histórico sin retención.

## Documentos relacionados

- `docs/LIFECYCLE_CANONICAL_PROCESSES.md` — recetas funcionales por estado.
- `docs/BATCH_AUTOPILOT_ARCHITECTURE.md` — arquitectura de cola, workers, límites, breakers y Autopilot.
- `docs/ROADMAP_MIGRATION.md` — limpieza de legado y M46.
- `docs/INFRASTRUCTURE_EFFICIENCY.md` — reglas de eficiencia/coste de infraestructura.

## Punto de reanudación — 24/08/2026

- Fases 1–3: cerradas.
- Fase 4: validación unitaria principal realizada; mantenerla abierta solo para etapas/casos aún no certificados.
- Fase 5: en curso; no olvidar terminar el recorrido del frontal.
- Fase 6: en curso; `IDENTITY_PENDING` superó 5 y 25. Próximo escalón técnico: 100 cuando corresponda dentro del plan.
- Fases 7–8: pendientes.

Ante pérdida de contexto, **leer este documento antes de continuar la implantación Lifecycle**.
