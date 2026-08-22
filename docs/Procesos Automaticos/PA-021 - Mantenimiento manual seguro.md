# PA-021 — Mantenimiento manual seguro

## 1. Identidad
- **ID:** PA-021
- **Workflow:** `manual-maintenance.yml`
- **Script:** `scripts/manual-check.mjs`
- **Tipo:** manual desde GitHub Actions, solo lectura

### Punto de entrada
- GitHub Actions → Manual maintenance.

## 2. Objetivo
Ejecutar comprobaciones acotadas de diagnóstico sin modificar datos.

## 3. Tareas
- `database-health`
- `series-sample`, con límite configurable 1-10 (default 5).

## 4. Controles
- Workflow_dispatch únicamente.
- Concurrency global, no cancela en curso.
- Timeout 5 min.
- Permisos contents: read.
- Tareas explícitamente bounded/read-only.

## 5. Salida
Logs GitHub Actions.

## 6. Admin
No crea pipeline run; visibilidad interna PikoFilm nula.

## 7. Evaluación
Herramienta de mantenimiento segura, no proceso funcional de usuario. Mantener separada de pipelines productivos.