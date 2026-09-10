# PikoFilm V5 — Roadmap canónico de decisiones

Estado: **EN CONSTRUCCIÓN**.

Fuente de candidatos y evidencias: `docs/PRE_V5_DEEP_AUDIT.md`.

Este documento es la fuente canónica de decisiones para PikoFilm V5. El inventario PRE‑V5 permanece como fotografía de auditoría; aquí se registra, una por una, cada decisión del usuario, sus condiciones, prioridad final y alcance. Sólo las mejoras **APROBADAS** forman parte del roadmap de implantación V5.

## Reglas de decisión

- Estados permitidos: **APROBADA**, **RECHAZADA**, **POSPUESTA**.
- Cada decisión se persiste en Git antes de presentar la siguiente mejora.
- Las condiciones o matices del usuario forman parte obligatoria de la decisión.
- Al terminar la revisión, las aprobadas se reordenarán por dependencias, riesgo y prioridad para formar el plan de implantación; el orden de decisión no obliga al orden de desarrollo.
- Regla transversal V5: todo automatismo o proceso relevante aprobado deberá dejar **resultado funcional en Actividad** y **trazabilidad técnica en Operaciones**, salvo excepción expresamente aprobada.
- La sincronización Plex global continúa siendo manual salvo decisión explícita posterior.

---

## Decisiones

### Mejora 1 · V5-C002 — Garantizar que el Activity Planner automático realmente se ejecuta

**Estado:** APROBADA  
**Prioridad definitiva:** P0 si se confirma que actualmente está bloqueado; P1 si funciona y el trabajo queda como hardening preventivo.  
**Categoría:** Fiabilidad · Automatización · Observabilidad

**Problema detectado**

Vercel declara `/api/cron/activity-planner` cada hora y la propia ruta valida `CRON_SECRET`, pero el middleware privado sólo exceptúa explícitamente otro cron (`/api/cron/dashboard-snapshot`). Existe por tanto riesgo de que la llamada horaria sea interceptada antes de llegar a la ruta del planificador.

**Alcance aprobado**

1. Comprobar de forma concluyente en producción si `/api/cron/activity-planner` atraviesa el middleware y llega a ejecutar su handler.
2. Si está bloqueado, corregir el acceso de forma estrictamente limitada al cron autenticado; nunca abrir la aplicación ni rebajar la protección privada.
3. Añadir contrato automatizado que cruce `vercel.json`, middleware y autenticación de las rutas cron para impedir que vuelva a existir un cron declarado pero inalcanzable.
4. Verificar ejecución real, no sólo que la ruta devuelve un código HTTP aceptable.
5. Mantener idempotencia y protecciones existentes del planificador.

**Condición añadida por el usuario**

Para aprovechar las superficies V4 ya construidas, **cada ejecución del planificador debe quedar registrada en Actividad y Operaciones**:

- **Actividad:** debe explicar en lenguaje funcional que la planificación automática se revisó y cuál fue el resultado: sin cambios, trabajos creados/lanzados/aplazados, incidencias, etc.
- **Operaciones:** debe conservar la ejecución técnica correlacionada (`run_id`), origen cron/sistema, duración, estado, eventos, errores, métricas y detalle necesario para diagnóstico.
- Ambas vistas deben referirse al mismo hecho canónico/correlación; no se crearán dos fuentes de verdad paralelas.

**Resultado esperado para el usuario**

Cuando PikoFilm diga que revisa automáticamente la planificación cada hora, existirá una garantía verificable de que realmente ocurre y será posible comprobar qué hizo desde Actividad y diagnosticar cómo se ejecutó desde Operaciones.

**Decisión del usuario:** aprobada con la condición obligatoria de observabilidad en Actividad + Operaciones.

### Mejora 2 · V5-C001 — Retirar por completo el polling legado de Lifecycle

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Defecto · Eficiencia · Limpieza legacy

**Problema detectado**

Producción ha registrado miles de solicitudes diarias a `/api/lifecycle-activity` y el componente legado `LifecycleActivity` mantiene un polling cada 4 segundos, aunque V4 sustituyó esa experiencia por la superficie canónica de Actividad.

**Alcance aprobado**

1. Identificar de forma concluyente todos los consumidores actuales de `LifecycleActivity` y `/api/lifecycle-activity` antes de eliminar nada.
2. Confirmar que ninguna capacidad vigente de V4 depende de ese polling.
3. Retirar el componente legado, su polling y el endpoint cuando el consumer sweep demuestre que son innecesarios.
4. Añadir protección automatizada para impedir que el endpoint o un polling equivalente reaparezcan por accidente.
5. Verificar tras implantación, con métricas/logs de producción, que las llamadas residuales desaparecen o quedan reducidas únicamente a algún consumidor explícitamente justificado.
6. No sustituir el polling antiguo por otro mecanismo periódico equivalente si no existe una necesidad funcional real.

**Observabilidad y regla transversal**

La eliminación de ruido legacy no debe crear nueva actividad artificial. Las tareas técnicas de migración, verificación o cualquier incidencia relevante durante la retirada deben quedar trazadas en **Operaciones**; si provocan un efecto funcional visible para el usuario, también deben quedar reflejadas en **Actividad**, compartiendo la correlación canónica correspondiente.

**Resultado esperado para el usuario**

PikoFilm conservará la misma funcionalidad V4, pero dejará de ejecutar miles de comprobaciones innecesarias. Esto reduce tráfico, consumo de Vercel/Neon y ruido operativo, además de retirar una pieza antigua que podría confundir futuras evoluciones.

**Decisión del usuario:** aprobada.

### Mejora 3 · V5-C003 — Sustituir el acceso privado actual por un mecanismo más robusto

**Estado:** RECHAZADA  
**Prioridad definitiva:** No entra en V5.  
**Categoría:** Seguridad

**Propuesta evaluada**

Sustituir el acceso actual basado en enlace/token y cookie privada de larga duración por una sesión más robusta, con credencial fuera del código, caducidad más corta y revocación más sencilla.

**Motivo de rechazo del usuario**

El acceso actual no está causando problemas, resulta cómodo en el uso real y, tras los cambios realizados, ha conseguido detener los ataques que motivaron su endurecimiento. El usuario no quiere introducir ahora complejidad adicional en una parte que considera resuelta y estable.

**Consecuencia para V5**

- Se mantiene el mecanismo de acceso privado actual.
- No se añade un sistema de usuarios, sesiones nuevas ni cambio de autenticación como parte de V5.
- Sólo se reabrirá esta decisión si aparece evidencia nueva de vulnerabilidad, ataques, filtración o inconveniente real de uso.

**Decisión del usuario:** rechazada de momento por estabilidad y buen funcionamiento del acceso vigente.

### Mejora 4 · V5-C004 — Permitir rotar o revocar el acceso privado desde Operaciones

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Mantenimiento · Seguridad

**Problema detectado**

El mecanismo de acceso privado actual funciona bien y se mantiene, pero la credencial válida está ligada al código del `middleware`. Si algún día se necesita cambiarla o invalidarla, hoy la vía natural implica modificar código y desplegar.

**Alcance aprobado**

1. Mantener el mismo modelo de acceso privado y la misma experiencia diaria que ya funciona; esta mejora no sustituye la autenticación actual ni introduce usuarios.
2. Desacoplar la credencial o versión de acceso del código para que pueda rotarse o revocarse de forma segura sin modificar la aplicación.
3. Exponer la operación desde **Operaciones → Mantenimiento**, siguiendo el contrato V4 de mantenimiento seguro: explicar antes qué va a cambiar, qué no cambia y qué efecto tendrá sobre accesos existentes.
4. La acción deberá exigir confirmación proporcional al impacto y no deberá mostrar ni registrar secretos en claro.
5. Cuando técnicamente sea posible, ofrecer revocación global de accesos previos/rotación controlada sin necesidad de redeploy de código.
6. Si la plataforma de hosting impide una rotación totalmente desde UI sin intervención externa, Operaciones deberá mostrar el flujo exacto y seguro disponible, sin fingir una capacidad que el backend no tenga.

**Condición añadida por el usuario**

La gestión debe hacerse **desde Operaciones como mantenimiento**, porque es el lugar canónico de PikoFilm para este tipo de intervención técnica.

**Observabilidad obligatoria**

- **Operaciones:** cada rotación/revocación debe quedar auditada como intervención técnica, con resultado, actor/origen, momento y estado final, pero nunca con la clave o secreto en claro.
- **Actividad:** sólo debe reflejarse si la operación tiene una consecuencia funcional relevante para el uso de PikoFilm; no se generará ruido por simples consultas de estado.

**Resultado esperado para el usuario**

El acceso privado seguirá funcionando como ahora, pero si alguna vez se necesita cambiar o revocar la credencial podrá gestionarse de forma controlada desde Operaciones, sin convertir una tarea de mantenimiento en un cambio de código.

**Decisión del usuario:** aprobada con gestión obligatoria desde Operaciones → Mantenimiento.

### Mejora 5 · V5-C005 — Evitar que el código nuevo llegue antes que la base de datos

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Arquitectura · Despliegues · Fiabilidad

**Problema detectado**

El historial de producción ha mostrado versiones de PikoFilm que empezaron a utilizar tablas o columnas nuevas antes de que Neon estuviera completamente preparado. Aunque código y migración fueran correctos por separado, durante esa ventana la aplicación podía fallar.

**Alcance aprobado**

1. Establecer un flujo seguro **migración compatible → verificación de esquema → despliegue de código dependiente**.
2. Aplicar patrón expand/contract cuando una evolución no pueda hacerse de forma atómica, permitiendo que versión anterior y nueva convivan durante la transición.
3. Añadir un chequeo automatizado que determine si Neon contiene las tablas, columnas, funciones e índices críticos que necesita la versión que va a desplegarse.
4. Impedir o marcar claramente como no segura una implantación cuando el esquema requerido no esté disponible.
5. Evitar migraciones destructivas prematuras; cualquier retirada se hará únicamente tras comprobar que ningún consumidor vivo depende ya de la estructura anterior.
6. Integrar este control con la futura versión explícita de esquema/healthcheck cuando se implanten los candidatos relacionados del roadmap.

**Observabilidad obligatoria**

- **Operaciones:** las comprobaciones de schema readiness y las migraciones relevantes deberán quedar trazadas técnicamente con resultado, versión/fingerprint esperado, estado encontrado y fallo concreto si lo hubiera.
- **Actividad:** deberá registrarse únicamente cuando la migración o el cambio produzca un efecto funcional relevante para PikoFilm; las comprobaciones puramente técnicas no deben generar ruido innecesario.

**Resultado esperado para el usuario**

Tras un deploy no debería existir un intervalo en el que PikoFilm falle simplemente porque el código llegó unos minutos antes que la estructura de base de datos que necesita.

**Decisión del usuario:** aprobada.

### Mejora 6 · V5-C006 — Impedir lanzamientos duplicados de un mismo Batch

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** UX · Batch · Fiabilidad · Idempotencia

**Problema detectado**

El historial de producción contiene al menos una colisión al intentar crear un Batch cuando ya existía otro activo del mismo proceso. La base de datos hizo bien en bloquear el duplicado, pero el usuario no debería llegar a provocar ese caso desde la interfaz ni recibir un error técnico por ello.

**Diseño aprobado por el usuario**

La defensa principal debe ser visual y preventiva: **si ya existe un Batch equivalente en curso, todos los botones o acciones capaces de lanzar otro deben quedar deshabilitados**. La interfaz debe indicar de forma clara que el proceso ya está en ejecución y ofrecer acceso al Batch activo.

**Alcance aprobado**

1. Detectar el Batch activo equivalente antes de mostrar una acción de lanzamiento.
2. Deshabilitar el botón mientras exista un Batch incompatible/equivalente activo, con estado comprensible como “En curso” o “Ya hay un proceso activo”.
3. Permitir abrir directamente el Batch activo desde ese estado cuando sea útil.
4. Actualizar el estado del control cuando el Batch termine, falle, se cancele o deje de bloquear un nuevo lanzamiento.
5. Aplicar el mismo criterio en todas las superficies desde las que pueda lanzarse el mismo trabajo; no sólo en una pantalla concreta.
6. Mantener también la protección de backend como segunda barrera: si dos peticiones llegan por carrera, pestañas distintas, automatización o cliente obsoleto, el servidor debe tratar la colisión de forma idempotente, reutilizando/devolviendo el Batch activo en vez de responder con un 500 o crear duplicados.
7. Mantener la restricción/índice de base de datos como última garantía de integridad; la mejora no elimina esa protección.

**Observabilidad obligatoria**

- Si se intenta lanzar una operación que ya está en curso y el backend reutiliza el Batch existente, **no debe registrarse falsamente como un Batch nuevo**.
- **Actividad:** debe reflejar el trabajo funcional real una sola vez; una mera visualización de botón deshabilitado no genera ruido.
- **Operaciones:** debe permitir diagnosticar la reutilización/denegación idempotente cuando haya existido una solicitud real al backend, correlacionándola con el Batch activo.

**Resultado esperado para el usuario**

Mientras un proceso ya esté ejecutándose, PikoFilm no permitirá iniciarlo otra vez desde la interfaz. Incluso en casos que la interfaz no pueda prevenir —dos pestañas, dos solicitudes simultáneas o automatismos— el backend seguirá protegido y no convertirá una duplicidad en un error técnico.

**Decisión del usuario:** aprobada con deshabilitación preventiva obligatoria de botones durante la ejecución, manteniendo la idempotencia de backend como red de seguridad.
