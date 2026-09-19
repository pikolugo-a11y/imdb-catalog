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


---

## OBS-03 — Causa efectiva agregada para parents, hijos e items

**APROBADA.**

### Problema

La auditoría detectó ejecuciones Batch/system con `technical_status='failed'` o `partial` y `error_count=0` en el parent.

Eso puede ser correcto: la causa real puede vivir en child runs, `batch_run_items` o errores asociados a esos hijos.

El problema aparece cuando la UI interpreta “sin error directo en el parent” como “sin causa registrada”.

### Decisión

Toda ejecución compuesta debe poder exponer una **causa efectiva agregada** derivada de su jerarquía real, sin copiar errores de hijos al parent.

La proyección debe poder distinguir:

- fallo directo del parent;
- fallos de child runs;
- items fallidos;
- items terminalizados;
- items pendientes de retry;
- trabajo funcional pendiente;
- combinaciones de las anteriores.

### Semántica

Ejemplo:

`PROC-SER-004` parent:
- 500 items;
- 497 correctos;
- 3 con incidencia;
- `error_count=0` directo.

Actividad puede resumir:

> Se completaron 497 de 500; 3 quedaron con incidencia.

Operaciones puede explicar:

> El estado parcial proviene de 3 hijos/items, no de un fallo directo del parent.

Y permitir navegar a las causas concretas.

### No duplicación

La agregación no debe insertar copias de `process_run_errors` en el parent.

La verdad permanece donde ocurrió el fallo.

La causa efectiva es una proyección determinista sobre:

`parent → children → items → errors`.

Un mismo hecho no se cuenta varias veces por estar representado en distintas capas de la jerarquía.

### Compatibilidad con PROC-05

PROC-05 define la semántica canónica de estado técnico, resultado funcional y continuidad.

OBS-03 añade la explicación causal de cómo una ejecución compuesta llegó a ese estado.

### Límites

- No autoriza migraciones.
- No copia errores históricos.
- No cambia todavía la UI.
- No modifica la semántica funcional de Batch, Series ni planner.
- La implementación futura puede ser una query/proyección/read model; no se obliga ahora a persistir una tabla nueva.

### Invariante

> Un parent compuesto no necesita tener un error propio para explicar un fallo; debe resumir de forma determinista las causas reales de sus hijos e items sin duplicarlas.


---

## OBS-04 — Contrato canónico de eventos, warnings y errores

**APROBADA.**

### Problema

La auditoría encontró 652 eventos con `event_type='error'` frente a 432 filas en `process_run_errors`, además de 83 runs con eventos de error pero sin error canónico asociado.

Eso demuestra que hoy “error” tiene más de una semántica operativa.

### Decisión

V5 separará tres niveles de señal:

1. **Evento normal**
   - describe hechos de ejecución: `step_started`, `step_completed`, `functional_change`, `manual_decision`, etc.;
   - no implica degradación ni fallo.

2. **Warning / degradación**
   - expresa una condición anómala pero tolerada: fallback, lentitud, dato incompleto permitido, retry programado o degradación equivalente;
   - no crea automáticamente una incidencia activa;
   - puede agregarse estadísticamente para detectar recurrencia.

3. **Error técnico canónico**
   - la fuente de verdad es `process_run_errors`;
   - representa un fallo técnico real según OBS-01;
   - si además se refleja en el timeline de eventos, debe quedar relacionado con el mismo error canónico y no contarse como un fallo adicional.

### Fuente de verdad y métricas

- Los contadores de “errores técnicos” se basarán en `process_run_errors`, no en la suma de events + errors.
- Los warnings tendrán métricas separadas.
- Los eventos cuentan historia, no sirven como contador alternativo de fallos.
- Un mismo error técnico no puede contarse dos veces por existir como fila y como evento asociado.

### Errores recuperados

Un fallo técnico intermedio puede registrar:

- la fila canónica de error;
- eventos de fallback/retry/recuperación;
- un run final `succeeded`.

En ese caso la evidencia histórica se conserva, pero OBS-02 decide si la incidencia sigue activa o queda recuperada.

### Compatibilidad

- No se borran ni reescriben los 652 eventos históricos observados.
- No se modifica todavía el esquema.
- No se obliga a eliminar los event types actuales hasta diseñar compatibilidad/migración.
- No se degrada el detalle técnico disponible para diagnóstico.

### Invariante

> Los eventos cuentan la historia; los warnings señalan degradación; `process_run_errors` representa fallos técnicos reales. Nunca se usan los tres como contadores equivalentes.


---

## OBS-05 — Estado operativo vigente separado del historial

**APROBADA.**

### Problema

El histórico de errores explica qué ocurrió, pero no siempre representa correctamente el estado actual.

La auditoría confirmó ambos sentidos del problema:

- puede existir un error histórico aunque el sistema ya esté sano;
- puede haberse descartado una incidencia histórica mientras el estado actual del dominio siga degradado.

PikoQuality ya demuestra esta separación: los `process_run_errors` pueden estar resueltos/descartados y, aun así, `plex_technical_state` puede conservar errores físicos vigentes.

### Decisión

Cada dominio con estado operativo relevante debe exponer una **fuente vigente de salud/deuda** que permita responder:

> ¿Hay algo que requiere atención ahora?

El histórico de runs/events/errors responde:

> ¿Qué ocurrió?

No se usará el histórico por sí solo para afirmar que una condición sigue activa.

### Fuentes de estado vigente

Cada dominio conserva su verdad actual donde corresponda. Ejemplos:

- PikoQuality → estado técnico vigente de captura;
- Batch → runs activos + control/items;
- APIs → breaker, `blocked_until`, cuotas/leases;
- planner → salud del planner + planes vigentes;
- Series y otros dominios → estados/read models funcionales correspondientes.

No se obliga a centralizar toda esa verdad en una nueva tabla.

### Proyección común hacia Operaciones

Operaciones podrá consumir una abstracción equivalente a:

- dominio;
- estado;
- si requiere atención;
- razón;
- desde cuándo;
- evidencia relevante.

La implementación puede ser calculada bajo demanda o mediante agregados baratos.

### Relación con OBS-02

OBS-02 gobierna la vida de una incidencia concreta.

OBS-05 gobierna la pregunta superior:

> Aunque no exista una incidencia técnica abierta, ¿hay deuda o degradación actual conocida?

Por tanto, descartar una incidencia no puede “hacer desaparecer” un estado físico/funcional que siga degradado.

### Relación con Actividad

Actividad puede mostrar que una ejecución pasada terminó con incidencia mientras Operaciones muestra que hoy todo está sano.

No existe contradicción:

- Actividad describe historia y resultado de ejecuciones;
- Operaciones prioriza el estado actual y la atención presente.

### Coste y guardrails

- No se crea un nuevo worker sólo para health checks.
- No se introduce polling continuo de todos los dominios.
- Se reutilizan estados, heartbeats, breakers, planes y read models ya existentes.
- La salud puede calcularse al consultar o mediante agregados de bajo coste.
- El histórico técnico sigue disponible para diagnóstico.

### Invariante

> El historial responde “qué ocurrió”; el estado operativo vigente responde “qué está mal ahora”. Nunca se usa el histórico por sí solo para afirmar que un problema sigue activo.
