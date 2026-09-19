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



---

## OBS-02 — Contrato canónico de incidencia activa y evidencia de resolución

**APROBADA.**

### Problema

La regla actual de Operaciones considera auto-resuelto un error cuando existe cualquier ejecución posterior con `technical_status='succeeded'` del mismo proceso y entidad.

La auditoría demostró que esa condición no siempre prueba que la causa original haya desaparecido: se observaron tres casos de `PROC-SER-005` cerrados únicamente por un success posterior con `functional_result=NULL`.

### Decisión

Una incidencia sólo deja de estar activa cuando existe **evidencia suficiente de que la condición original ya no requiere atención**.

Se reconocen cuatro vías canónicas de cierre:

1. **Recuperación demostrada**
   - una ejecución posterior compatible con la causa original termina con resultado funcional concluyente;
   - como regla general, `updated` o `no_change`;
   - un proceso puede declarar evidencia específica más adecuada cuando su contrato funcional lo requiera.

2. **Resolución manual explícita**
   - el usuario decide que la incidencia ya no requiere atención;
   - la resolución debe distinguir semánticamente estados como descartada, aceptada, no aplicable, obsoleta o equivalente;
   - una resolución manual no debe presentarse automáticamente como “reparada”.

3. **Terminalización conocida**
   - una condición clasificada por contratos como PROC-04 puede dejar de generar alarma repetitiva si ya está terminalizada de forma conocida;
   - la evidencia histórica permanece;
   - el estado vigente debe explicar por qué no seguirá reintentándose.

4. **Supersedida por nueva verdad**
   - un cambio de identidad, fingerprint, referencia externa, configuración o estado canónico puede invalidar la incidencia original;
   - el cierre debe conservar la evidencia de qué nueva verdad la volvió irrelevante.

### Procedencia de resolución

Toda resolución debe ser explicable mediante un contrato equivalente a:

- modo de resolución;
- razón normalizada;
- fecha/hora;
- evidencia o run que la justifica cuando exista;
- alcance de la resolución.

La implementación futura decidirá si esto requiere columnas, estructura JSON o una proyección derivada; la semántica es vinculante.

### Recurrencia

Si el mismo problema reaparece después de haber sido resuelto, se considera una **nueva recurrencia/incidencia**, sin borrar ni reactivar artificialmente el episodio histórico anterior.

### Relación con OBS-01

OBS-01 decide qué tipo de señal es cada hecho.

OBS-02 decide cuándo una señal técnica deja de requerir atención operativa.

Por tanto:

- una validación funcional nunca necesita “resolución de incidencia” porque no debió convertirse en fallo técnico;
- un fallo recuperado conserva historia pero puede cerrar atención con evidencia;
- un estado pendiente/bloqueado se gobierna funcionalmente, no mediante una falsa resolución técnica.

### Límites

- No autoriza migraciones.
- No reescribe retroactivamente las 432 filas históricas auditadas.
- No cambia todavía la UI de Operaciones.
- No altera reglas funcionales de Series, PikoQuality, Lifecycle ni Batch.
- No obliga a añadir columnas concretas antes de diseñar el modelo final.

### Invariante

> Una incidencia no se resuelve porque haya ocurrido algo después; se resuelve porque existe evidencia de que la condición original ya no requiere atención.
