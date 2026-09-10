# PikoFilm — Checklist de cambio para IA

Estado: **obligatorio para cambios significativos**.

Esta lista convierte el contrato AI-first en una rutina concreta y evita que una nueva sesión dependa de memoria conversacional.

## 1. Reconstruir contexto

- [ ] Leer `AGENTS.md`.
- [ ] Leer `docs/AI_DEVELOPMENT_GUIDE.md`.
- [ ] Leer `docs/PROJECT_RULES.md`.
- [ ] Leer `docs/README.md`.
- [ ] Leer `docs/V4_FUNCTIONAL_SPEC.md`.
- [ ] Leer `docs/V4_ARCHITECTURE.md`.
- [ ] Leer `docs/V4_UX_SPEC.md` si el cambio afecta UI/flujo de usuario.
- [ ] Leer `docs/processes/PROCESS_CATALOG.md` si el cambio toca un proceso.
- [ ] Leer `docs/processes/BATCH_ARCHITECTURE.md` si toca Batch/workers/leases/retry/concurrencia.
- [ ] Leer `docs/operations/RUNBOOK.md` si toca operación/infraestructura/recuperación.
- [ ] Verificar código/infraestructura viva relevante.

## 2. Identificar fuentes de verdad

- [ ] Qué dato/estado es canónico.
- [ ] Qué tablas son read model o compatibilidad.
- [ ] Qué operación canónica es propietaria de la lógica.
- [ ] Qué executor ejecuta individual y Batch.
- [ ] Qué side effects y fuentes externas existen.
- [ ] Qué decisión humana/override debe protegerse.
- [ ] Qué observabilidad y correlación debe producirse.

## 3. Evitar divergencia

Si existe Batch:

- [ ] individual y Batch llaman al mismo core funcional;
- [ ] diferencias de guard/postprocesado son explícitas;
- [ ] Batch no crea observabilidad anidada;
- [ ] retries/rate limits/leases no cambian semántica funcional;
- [ ] el worker no copia la receta funcional;
- [ ] la lane no permite saltarse gobierno API.

## 4. Seguridad

- [ ] No inferir legacy por nombre.
- [ ] Auditar consumidores antes de borrar.
- [ ] UNKNOWN bloquea eliminación.
- [ ] Neon destructivo usa migración + smoke.
- [ ] No persistir secretos.
- [ ] No desplegar Vercel: el deployment de producción corresponde al usuario.
- [ ] No añadir polling Plex global automático.
- [ ] No añadir una fuente gobernada sin su gate/fail-closed.
- [ ] No crear resets administrativos genéricos.

## 5. Producto/UX

- [ ] El cambio respeta que PikoFilm es catálogo maestro y Plex sólo verdad física.
- [ ] No introduce semántica de consumo/visto/progreso por accidente.
- [ ] Trabajo automático no se presenta como atención humana.
- [ ] Actividad explica el resultado funcional.
- [ ] Operaciones conserva el diagnóstico técnico.
- [ ] En móvil se mantiene capacidad, no sólo apariencia.
- [ ] Acciones destructivas explican alcance y requieren confirmación proporcional.

## 6. Calidad técnica

- [ ] Añadir/actualizar contrato de regresión si aparece una nueva invariancia.
- [ ] Ejecutar CI/build aplicable antes de merge.
- [ ] Verificar `test:quality` cuando afecta contratos V4.
- [ ] Verificar navegación sin prefetch si afecta links/listados.
- [ ] Verificar lectura acotada si afecta Personas.
- [ ] No declarar validado algo que no esté desplegado.
- [ ] Tras deploy, preparar aceptación funcional proporcional para que la ejecute el usuario.

## 7. Documentación en el mismo cambio

Revisar impacto sobre:

- [ ] `docs/V4_FUNCTIONAL_SPEC.md`;
- [ ] `docs/V4_ARCHITECTURE.md`;
- [ ] `docs/V4_UX_SPEC.md`;
- [ ] `docs/processes/PROCESS_CATALOG.md`;
- [ ] `docs/processes/BATCH_ARCHITECTURE.md`;
- [ ] `docs/operations/RUNBOOK.md`;
- [ ] `docs/development/*` cuando cambie el método de desarrollo.

No crear un documento nuevo si sólo duplicaría una fuente de verdad existente. Los documentos históricos permanecen en Git, no en el árbol canónico actual.

## 8. Entrega

- [ ] PR/CI revisable.
- [ ] Merge a `main` cuando el bloque esté técnicamente preparado.
- [ ] Comunicar HEAD exacto preparado para deployment.
- [ ] El usuario hace deployment Vercel de producción.
- [ ] Preparar/realizar validaciones técnicas previas y guiar validación visual/funcional del usuario.
- [ ] Registrar deuda real como issue/roadmap, no dejarla sólo en conversación.
