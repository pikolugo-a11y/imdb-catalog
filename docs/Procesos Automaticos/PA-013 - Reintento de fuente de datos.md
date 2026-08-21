# PA-013 — Reintento de fuente de datos

## 1. Identidad
- **ID:** PA-013
- **Backend:** `retryDataQualitySource`
- **Tipo:** manual, 1 título + 1 fuente

### Punto de entrada
- Calidad → Datos → acción de reintento sobre una fuente concreta.

## 2. Objetivo
Consultar únicamente una fuente seleccionada para intentar completar huecos de una ficha sin ejecutar toda la reparación.

## 3. Fuentes seleccionables
IMDb, OMDb, TMDb o FilmAffinity según implementación del reparador.

## 4. Flujo
1. Valida IMDb ID.
2. Carga estado actual de calidad.
3. Exige identidad validada.
4. Ejecuta recuperador de la fuente solicitada.
5. Solo completa huecos compatibles.
6. Audita fuente y campos recuperados.
7. Refresca ficha/calidad.

## 5. Volumen
1 título, 1 fuente.

## 6. Controles
Precondiciones específicas de credenciales/IDs; no sobrescribe de forma general campos existentes; error se devuelve visualmente.

## 7. Salida visual
Indica número y nombres de campos recuperados, o que la fuente no pudo completar huecos nuevos.

## 8. Admin
Auditoría disponible; sin `pipeline_runs` propio.

## 9. Recuperación
Es en sí mismo el mecanismo de retry manual por fuente.

## 10. Evaluación
Muy útil para recuperación selectiva; falta homogeneidad de observabilidad y retry/backoff automático.

## 11. Pendientes
1. `pipeline_runs` opcional por fuente.
2. Registrar latencia/HTTP/causa exacta por fuente.
3. Retry automático solo para errores transitorios.