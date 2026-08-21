# PA-017 — Refresco de sagas

## 1. Identidad
- **ID:** PA-017
- **pipeline job:** `saga_refresh`
- **Backend:** `refreshSagas`
- **Tipo:** manual, síncrono

### Punto de entrada
- Sagas → acción de refresco de colecciones (y cualquier otro botón que invoque `refreshSagasAction`).

## 2. Objetivo
Actualizar desde TMDb las colecciones/sagas conocidas, sus miembros y estado de completitud respecto a Plex.

## 3. Alcance y volumen
- Selecciona colecciones ausentes o no refrescadas en 30 días.
- Límite por defecto: **120 colecciones**.
- Concurrencia TMDb: **6**.

## 4. Flujo
1. Crea run `saga_refresh`.
2. Selecciona hasta 120 collection IDs.
3. Consulta `/collection/{id}?language=es-ES` con pool 6.
4. UPSERT `saga_collections`.
5. Ordena miembros por fecha.
6. Borra y reconstruye miembros de cada colección en transacción por colección.
7. Vincula miembro a IMDb cuando el TMDb ID existe en Catálogo.
8. Calcula sagas incompletas, a una película de completar y completas.
9. Cierra run con errores parciales contabilizados.

## 5. Fuentes
TMDb + Catálogo/Plex persistidos.

## 6. Controles
- TMDb token obligatorio.
- Errores por colección aislados por pool; no tumban el resto.
- Transacción para reconstruir miembros de cada colección.
- Antigüedad 30 días evita refresco innecesario.
- Sin retry/backoff TMDb explícito.

## 7. Salida visual
Resumen: colecciones refrescadas y miembros.

## 8. Admin
Alta: `saga_refresh` con added/updated/errors y estadísticas de completitud.

## 9. Recuperación
Relanzable; colección individual se reconstruye transaccionalmente.

## 10. Evaluación
Buena granularidad y control de volumen; faltan retries de TMDb y detalle visual de colecciones fallidas.