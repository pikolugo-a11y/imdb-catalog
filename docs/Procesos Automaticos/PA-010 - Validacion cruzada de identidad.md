# PA-010 — Validación cruzada de identidad

## 1. Identidad
- **ID:** PA-010
- **pipeline job:** `identity_validation`
- **Workflow:** `identity-validation-refresh.yml`
- **Worker:** `identity-validation-refresh.mjs`
- **Tipo:** manual, asíncrono, reanudable por fases

### Puntos de entrada
- Calidad → Validación de Identidad → iniciar sesión.
- Calidad → centro de control → **↻ Actualizar validación**.

## 2. Objetivo
Comprobar que IMDb, TMDb y FilmAffinity representan realmente el mismo título mediante evidencia de título original/año y algoritmo de validación.

## 3. Alcance
Títulos no excluidos con IMDb válido, TMDb+FA presentes y validación ausente/pendiente/insuficiente o IDs modificados.

## 4. Flujo
1. Detecta sesión activa reciente (<6 h) y evita duplicarla.
2. Cuenta pendientes y crea `identity_validation` queued.
3. Si no hay pendientes, cierra success.
4. Dispatch workflow con `run_id`.
5. Prepara Node, Python y parser FilmAffinity.
6. Ejecuta sesión reanudable por fases.
7. Usa evidencia cacheada cuando existe y repesca la faltante.
8. Actualiza progreso/contadores en pipeline run.
9. Clasifica valid/ doubtful / invalid / insufficient/pending según algoritmo.
10. Permite cancelación al final del lote actual.

## 5. Volumen
Todo el universo pendiente calculado al inicio. Workflow timeout 15 min. Concurrency global `pikofilm-identity-validation`.

## 6. Fuentes
IMDb, TMDb, FilmAffinity, caché `identity_validation`, Neon.

## 7. Controles
- No duplica run activo.
- Sesión reanudable por fases.
- Caché para minimizar llamadas externas.
- Cancelación cooperativa.
- Mismo grupo de concurrencia que recálculo cacheado.
- Sin ejecución cron.

## 8. Salida visual
Calidad muestra procesados/total, porcentaje y contadores valid/doubtful/invalid/errores; auto-refresh cada 5 s mientras está activa.

## 9. Admin
Muy alta mediante `identity_validation`, summary y auditoría.

## 10. Recuperación
Diseñada como sesión reanudable; datos/evidencia quedan cacheados. Cancelación y relanzamiento disponibles.

## 11. Evaluación
Uno de los procesos mejor preparados para trabajo largo: caché, fases, progreso y concurrencia controlada.

## 12. Pendientes
1. Estado cancelled explícito.
2. Retry selectivo de evidencias fallidas.
3. Mostrar por título qué fuente/evidencia falta.