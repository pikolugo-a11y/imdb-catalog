# PikoFilm — Observabilidad

Estado: **canónico**.

## Fuente de verdad

La observabilidad de procesos se centraliza en:
- `process_runs`;
- `process_run_events`;
- `process_run_errors`.

Un estado funcional de dominio o una tabla de control de worker no sustituye esta frontera.

## Qué representa un run

Un `process_run` representa una ejecución funcional identificable. Debe permitir responder:
- qué PROC se ejecutó;
- sobre qué entidad o ámbito;
- quién/qué lo disparó;
- dónde se ejecutó;
- cuándo empezó/terminó;
- resultado técnico y funcional;
- métricas y progreso;
- correlación/idempotencia;
- errores y eventos relevantes.

## Individual y Batch

Individual crea una única frontera observada alrededor de la operación canónica.

Batch crea:
1. un run padre para el lote;
2. estado operativo en tablas Batch;
3. un child `process_run` por intento/item;
4. ejecución del mismo core funcional dentro de ese child.

No debe crearse un segundo `process_run` anidado desde el core. PER-001 es el contrato de referencia para esta regla.

## Eventos y errores

Los eventos describen pasos relevantes y progreso sin convertir cada detalle interno en ruido. Los errores deben conservar fuente, contexto y retryability cuando proceda.

Las llamadas externas deben ser trazables mediante el contexto del run y las métricas de fuentes/API governance.

## Modelos especializados

- PQ-001 utiliza un único `process_run` canónico y actualiza progreso por chunks; no crea `pipeline_runs` por chunk.
- PQ-002 conserva control persistente especializado, pero la identidad funcional del proceso sigue siendo PROC-PQ-002.
- GitHub Actions Discovery debe conservar el `run_id` originado desde el control plane.

## Lo que no es observabilidad canónica

- `batch_run_control` / `batch_run_items`: estado de orquestación.
- `person_refresh_state`: estado funcional de Personas.
- `piko_quality`: resultado funcional PikoQuality.
- `series_quality_runs`: compatibilidad temporal de Series.
- `pipeline_runs`: compatibilidad histórica pendiente de gate de retirada.

## Regla AI-first

Antes de introducir una nueva tabla `*_runs`, log paralelo o estado de ejecución, una IA debe demostrar por qué `process_runs` + eventos/errores no cubren la necesidad. La opción por defecto es ampliar la observabilidad común, no crear una segunda arquitectura.
