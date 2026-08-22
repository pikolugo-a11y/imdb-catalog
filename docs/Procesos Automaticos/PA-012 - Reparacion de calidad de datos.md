# PA-012 — Reparación de calidad de datos

## 1. Identidad
- **ID:** PA-012
- **Backend:** `repairDataQualityTitle`
- **Tipo:** manual, 1 título

### Punto de entrada
- Calidad → Datos → **Reparar ficha**.

## 2. Objetivo
Rellenar huecos de una ficha validada consultando fuentes de recuperación y recalculando PikoScore cuando procede.

## 3. Precondición crítica
La ficha debe haber pasado Validación de Identidad con estado `valid`; en otro caso la reparación queda bloqueada.

## 4. Fuentes
IMDb ratings, OMDb, TMDb y FilmAffinity. Cada fuente recupera únicamente campos ausentes; no pretende sobrescribir datos ya presentes.

## 5. Datos recuperables
Duración, país, títulos, año, ratings/votos, sinopsis, idioma, estreno, géneros, póster externo, director y reparto, según disponibilidad de cada fuente.

## 6. Controles
- IMDb ID válido.
- Validación de identidad obligatoria.
- TMDb requiere TMDb ID.
- FilmAffinity requiere FA ID.
- OMDb requiere API key.
- Auditoría por recuperación de fuente y campos cambiados.
- Recalcula PikoScore con fuentes disponibles.

## 7. Volumen
1 título; múltiples fuentes secuenciales según huecos/estrategia del reparador.

## 8. Salida visual
Devuelve cobertura antes/después y número de campos recuperados.

## 9. Admin
Trazabilidad principalmente por `admin_events`; no tiene un `pipeline_runs` propio homogéneo.

## 10. Recuperación
Puede relanzarse; al usar `COALESCE`/solo huecos es esencialmente incremental.

## 11. Evaluación
Buena protección contra identidades incorrectas y enfoque conservador. Observabilidad inferior a procesos con pipeline run.

## 12. Pendientes
1. Añadir `pipeline_runs` propio.
2. Mostrar resultado fuente por fuente.
3. Timeouts/retries homogéneos para todas las fuentes.