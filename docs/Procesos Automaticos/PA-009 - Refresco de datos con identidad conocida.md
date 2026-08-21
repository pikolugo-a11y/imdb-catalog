# PA-009 — Refresco de datos con identidad conocida

## 1. Identidad
- **ID:** PA-009
- **Backend:** `refreshKnownIdentity`
- **pipeline job:** `identity_data_refresh`
- **Tipo:** manual, 1 título

### Puntos de entrada
- Calidad → Identidad → **Refrescar datos**.
- Calidad → Identidad → reintento de título con identidad completa.
- Validación de Identidad → tras una revalidación individual que resulte `valid`.
- Validación de Identidad → tras corregir IDs y resultar `valid`.

## 2. Objetivo
Actualizar los datos de un título cuando IMDb, TMDb y FilmAffinity IDs ya son conocidos y se consideran completos.

## 3. Flujo
1. Valida IMDb ID y existencia.
2. Exige TMDb ID y FA ID.
3. Crea run `identity_data_refresh` con IDs conocidos.
4. Marca `identity_refresh_state=running`.
5. Intenta refrescar rating IMDb (timeout 12 s, fallo tolerado).
6. Ejecuta `enrichTitle` conservando IDs conocidos.
7. Marca `refreshed` y fecha.
8. Cierra success y audita.
9. En fallo marca estado/error en `source_status`, cierra failed y audita.

## 4. Volumen
1 título.

## 5. Fuentes
IMDb ratings, TMDb, FilmAffinity y enriquecimiento asociado.

## 6. Controles
- Identidad completa obligatoria.
- IMDb rating tolerante a fallo.
- Estado persistente running/refreshed/failed.
- pipeline_run y auditoría.
- Sin retry automático.

## 7. Salida visual
Botón muestra **Refrescando…** y mensaje final. En Validación el resultado se integra en el mensaje de revalidación.

## 8. Admin
Alta: job `identity_data_refresh` con IDs y fuentes.

## 9. Recuperación
Relanzable por título; último error queda persistido.

## 10. Evaluación
Muy trazable y acotado; comparte gran parte del motor con PA-001 pero con precondición de identidad completa y estado específico.

## 11. Pendientes
1. Valorar unificar visualmente PA-001/PA-009 manteniendo semánticas distintas.
2. Retry automático para errores transitorios de fuentes.