# PikoFilm V5 — Decisiones 05: Observabilidad y errores

Fecha: 2026-09-19  
Estado: **FASE 2 ACTIVA**  
Auditoría base: `docs/V5_AUDIT_05_OBSERVABILITY_ERRORS.md`

## OBS-01 — Taxonomía canónica de señal

**APROBADA.**

PikoFilm V5 distinguirá de forma explícita y transversal cuatro conceptos que hoy pueden mezclarse:

1. **Fallo técnico**  
   Algo que debía funcionar y no funcionó: timeout, SQL roto, proveedor caído, excepción inesperada, incompatibilidad de worker, fallo de red u otro defecto técnico real. Es el caso que puede generar `process_run_errors`, incidencia operativa y log de nivel error en la plataforma.

2. **Validación o rechazo funcional**  
   El sistema funciona correctamente pero la operación solicitada no procede por una precondición funcional. No debe registrarse como fallo técnico ni contaminar Vercel/Railway con un error de plataforma. Cuando aplique, el run puede terminar técnicamente correcto con un resultado funcional como `invalid`, acompañado de un evento funcional específico y un mensaje claro al usuario.

3. **Estado funcional pendiente o bloqueado**  
   La ejecución técnica puede haber sido correcta y, aun así, el dominio seguir pendiente de datos, revisión humana o una condición externa. `succeeded + pending` y `succeeded + blocked` son estados válidos y no equivalen automáticamente a una avería técnica.

4. **Incidencia activa**  
   Es una conclusión operativa: existe una condición técnica actual que todavía requiere atención. No es sinónimo de fila en `process_run_errors`, de `error_count > 0` ni de run `failed/partial`.

Invariantes aprobadas:

- sólo un fallo técnico real genera un error técnico canónico;
- una validación funcional esperable no genera `process_run_errors` ni debe aparecer como runtime error de plataforma;
- el histórico técnico se conserva aunque la condición deje de requerir atención;
- un error recuperado dentro de una ejecución puede conservar evidencia sin convertir automáticamente el run o el sistema en incidencia activa;
- Actividad expresa consecuencias/resultados funcionales; Operaciones expresa fallo técnico, recuperación y atención operativa;
- los logs externos deben seguir la misma clasificación para que Vercel/Railway no traten precondiciones de negocio como fallos de infraestructura;
- no se crea una segunda plataforma de tracing ni una tabla paralela para aplicar esta taxonomía;
- esta decisión no autoriza todavía migraciones, reescritura retroactiva de los 432 errores auditados ni cambios en producción.

Ejemplo vinculante observado:

> “No existe una decisión de capítulo combinado que deshacer” debe modelarse como rechazo funcional de una acción no aplicable, no como fallo técnico de Vercel/PikoFilm.

