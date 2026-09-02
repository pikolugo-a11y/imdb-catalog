# PikoFilm — Checklist de cambio para IA

Estado: **obligatorio para cambios significativos**.

Esta lista convierte el contrato AI-first en una rutina concreta y evita que una nueva sesión dependa de memoria conversacional.

## 1. Reconstruir contexto

- [ ] Leer `AGENTS.md`.
- [ ] Leer `docs/AI_DEVELOPMENT_GUIDE.md`.
- [ ] Leer `docs/PROJECT_RULES.md`.
- [ ] Leer `docs/README.md`.
- [ ] Si PRE-V4 sigue activo, leer `docs/PRE_V4_READINESS_PLAN.md`.
- [ ] Leer `docs/processes/PROCESS_CATALOG.md` y `BATCH_ARCHITECTURE.md` si el cambio toca procesos.
- [ ] Verificar código/infraestructura viva relevante.

## 2. Identificar fuentes de verdad

- [ ] Qué dato/estado es canónico.
- [ ] Qué tablas son read model o compatibilidad.
- [ ] Qué operación canónica es propietaria de la lógica.
- [ ] Qué executor ejecuta individual y Batch.
- [ ] Qué side effects y fuentes externas existen.

## 3. Evitar divergencia

Si existe Batch:
- [ ] individual y Batch llaman al mismo core funcional;
- [ ] diferencias de guard/postprocesado son explícitas;
- [ ] Batch no crea observabilidad anidada;
- [ ] retries/rate limits/leases no cambian semántica funcional.

## 4. Seguridad

- [ ] No inferir legacy por nombre.
- [ ] Auditar consumidores antes de borrar.
- [ ] UNKNOWN bloquea eliminación.
- [ ] Neon destructivo usa migración + smoke.
- [ ] No persistir secretos.
- [ ] No desplegar Vercel: el deployment de producción corresponde al usuario.

## 5. Calidad

- [ ] Añadir/actualizar contrato de regresión si aparece una nueva invariancia.
- [ ] Ejecutar CI/build aplicable antes de merge.
- [ ] No declarar validado algo que no esté desplegado.
- [ ] Tras deploy, preparar aceptación funcional proporcional para que la ejecute el usuario.

## 6. Documentación en el mismo cambio

Revisar impacto sobre:
- [ ] `docs/processes/PROCESS_CATALOG.md`;
- [ ] `docs/processes/BATCH_ARCHITECTURE.md`;
- [ ] `docs/architecture/*`;
- [ ] `docs/product/*`;
- [ ] `docs/operations/*`;
- [ ] `docs/development/*`;
- [ ] `docs/PRE_V4_READINESS_PLAN.md` / roadmap cuando proceda.

No crear un documento nuevo si sólo duplicaría una fuente de verdad existente.

## 7. Entrega

- [ ] PR/CI revisable.
- [ ] Merge a `main` cuando el bloque esté técnicamente preparado.
- [ ] Comunicar HEAD exacto preparado para deployment.
- [ ] Registrar deuda real como issue/roadmap, no dejarla sólo en conversación.
