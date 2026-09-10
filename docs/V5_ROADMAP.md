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
- Regla de oro visual V5: **PikoFilm debe percibirse como una sola aplicación coherente, no como páginas independientes con criterios visuales propios**. Los patrones globales de color, tipografía, espaciado, radios, bordes, sombras, estados y componentes deben centralizarse y reutilizarse.
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

### Mejora 7 · V5-C007 — Chequeo integral de salud de PikoFilm desde Operaciones

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Salud · Fiabilidad · Diagnóstico

**Problema detectado**

Hoy para saber si PikoFilm está correctamente montado hay que comprobar piezas distintas por separado: esquema de Neon, funciones SQL, workers de Railway, automatismos de Vercel, Batch, fuentes externas y otros componentes críticos. La información existe, pero está dispersa y obliga a investigar manualmente.

**Alcance aprobado**

1. Incorporar en **Operaciones** una comprobación integral y de sólo lectura que responda de forma comprensible si la plataforma está correctamente montada y operativa.
2. Verificar como mínimo el esquema y versión/fingerprint esperado de Neon, tablas/columnas/funciones críticas, estado y frescura de workers, ejecución reciente de crons esperados, estado básico de Batch y disponibilidad/configuración esencial de componentes de infraestructura que puedan comprobarse de forma segura.
3. Presentar un resultado resumido por excepción: si todo está correcto, mostrarlo de forma compacta; si existe una anomalía, destacar exactamente qué componente necesita atención y por qué.
4. Distinguir claramente entre **fallo confirmado**, **estado degradado**, **sin evidencia reciente** y **correcto**, evitando declarar sano aquello que no se ha podido comprobar.
5. Cada chequeo individual debe tener criterio explícito de éxito y mensaje entendible; no convertir el panel en una lista de métricas técnicas sin interpretación.
6. Integrarlo con la futura comprobación de compatibilidad código↔esquema aprobada en la Mejora 5 y reutilizar fuentes canónicas existentes en vez de crear estados paralelos.
7. La comprobación no debe modificar configuración, reiniciar workers, ejecutar migraciones ni reparar automáticamente nada. Cualquier acción correctiva debe ser otra operación explícita y segura de Operaciones.

**Observabilidad y ruido**

- La consulta manual de salud es una operación de diagnóstico **de sólo lectura** y no debe llenar Actividad con entradas sin utilidad funcional.
- **Operaciones** debe mostrar cuándo se hizo la comprobación, qué se pudo verificar y qué resultado obtuvo.
- Si se detecta una anomalía con consecuencia funcional real, ésta podrá alimentar el estado de salud/incidencias de Operaciones y reflejarse en Actividad únicamente cuando corresponda por su impacto funcional.

**Resultado esperado para el usuario**

Desde una sola pantalla se podrá responder “PikoFilm está bien” o, si no lo está, obtener una explicación concreta como “Activity Planner no se ejecuta desde hace 3 horas”, “worker API sin heartbeat” o “el esquema de Neon no coincide con la versión esperada”, sin tener que abrir Neon, Railway y Vercel uno por uno.

**Decisión del usuario:** aprobada.

### Mejora 8 · V5-C008 — Validar automáticamente que todos los crons son alcanzables y seguros

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** CI · Automatización · Fiabilidad · Seguridad

**Problema detectado**

Un cron puede estar correctamente declarado en `vercel.json` y, aun así, quedar bloqueado por el middleware o aceptar una autenticación incorrecta. Esto permitiría que un automatismo pareciera configurado aunque en la práctica no pudiera ejecutarse de forma segura.

**Alcance aprobado**

1. Crear un contrato automático que descubra todos los crons declarados y verifique su correspondencia con una ruta real.
2. Comprobar que cada cron puede atravesar correctamente las capas de routing/middleware necesarias sin abrir superficies privadas al tráfico normal.
3. Comprobar que cada ruta cron exige la autenticación prevista y rechaza solicitudes no autorizadas.
4. Hacer que la protección cubra los crons actuales y cualquier cron futuro añadido a PikoFilm, evitando listas manuales fáciles de olvidar.
5. Integrar estas verificaciones en CI como gate de cambios que afecten a crons, middleware o autenticación.
6. Complementar el contrato estático con evidencia operativa de ejecución/frescura cuando exista, especialmente en el chequeo de salud de Operaciones aprobado en la Mejora 7.
7. Reutilizar la misma arquitectura de seguridad para evitar excepciones ad hoc divergentes entre cron y cron.

**Observabilidad**

Los tests de CI no deben generar entradas funcionales en Actividad. Las ejecuciones reales de los crons seguirán la regla transversal: **Actividad** para el resultado funcional relevante y **Operaciones** para la trazabilidad técnica. Los fallos de alcanzabilidad o autenticación detectados en producción deberán aparecer como anomalías operativas.

**Resultado esperado para el usuario**

Cuando PikoFilm declare que una tarea se ejecuta automáticamente cada hora, día o con cualquier otra frecuencia, habrá una protección automática que impida desplegar una configuración en la que esa tarea esté declarada pero sea inaccesible o insegura.

**Decisión del usuario:** aprobada.

### Mejora 9 · V5-C009 — Añadir cabeceras de seguridad modernas

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Seguridad · Navegador · Hardening

**Problema detectado**

La configuración actual no define de forma explícita una política completa de cabeceras de seguridad del navegador. Esto deja margen para endurecer cómo PikoFilm permite cargar scripts, imágenes, conexiones y otras capacidades web sin cambiar el modelo de acceso privado vigente.

**Alcance aprobado**

1. Añadir una política de seguridad explícita y compatible con el funcionamiento real de PikoFilm, incluyendo al menos Content Security Policy cuando sea viable, Referrer-Policy y Permissions-Policy, además de otras cabeceras recomendables que tengan sentido en el entorno actual.
2. Construir la política a partir de los recursos y orígenes realmente utilizados por PikoFilm; no aplicar una configuración genérica que pueda romper imágenes, APIs, fuentes o flujos válidos.
3. Implantar primero en modo de observación/report-only o con pruebas equivalentes cuando el riesgo de bloqueo accidental lo justifique, endureciendo después de validar compatibilidad.
4. Mantener intacto el mecanismo de acceso privado aprobado; esta mejora es complementaria y no reabre la Mejora 3 rechazada.
5. Añadir pruebas de CI que detecten regresiones básicas de cabeceras y permitan evolucionar la política de forma controlada.
6. No habilitar permisos o excepciones más amplios de lo necesario para resolver incompatibilidades puntuales.

**Observabilidad**

Los cambios de configuración de seguridad deberán quedar trazados técnicamente en Operaciones cuando formen parte de una intervención o despliegue relevante. Los bloqueos detectados que afecten funcionalmente a PikoFilm deberán ser diagnosticables desde Operaciones. Actividad sólo reflejará consecuencias funcionales reales, no cada cabecera servida por el navegador.

**Resultado esperado para el usuario**

PikoFilm seguirá utilizándose exactamente igual, pero el navegador tendrá reglas más estrictas sobre qué puede ejecutar o cargar la aplicación, reduciendo superficie de ataque sin sacrificar recursos legítimos.

**Decisión del usuario:** aprobada.

### Mejora 10 · V5-C010 — Auditar mejor las acciones administrativas sensibles

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Seguridad · Observabilidad · Auditoría

**Problema detectado**

PikoFilm ya conserva trazabilidad técnica de muchas ejecuciones, pero las acciones administrativas sensibles pueden quedar poco diferenciadas de otros eventos técnicos. A futuro necesitamos poder distinguir con claridad qué cambio fue automático, cuál fue manual y desde qué superficie se lanzó.

**Alcance aprobado**

1. Definir un registro canónico para las acciones administrativas sensibles realizadas desde Operaciones u otras superficies autorizadas.
2. Registrar de forma durable la acción ejecutada, fecha/hora, origen o superficie, actor/sesión técnica disponible, entidad o proceso afectado, confirmación requerida y resultado final.
3. Distinguir explícitamente entre acción manual, automatismo, cron, reparación, mantenimiento y otras procedencias relevantes.
4. Correlacionar la acción administrativa con el `run_id`, Batch, proceso o entidad funcional correspondiente cuando exista, evitando eventos aislados sin contexto.
5. No almacenar contraseñas, tokens, claves, secrets ni payloads sensibles en claro. La auditoría debe registrar que se produjo una rotación o cambio, nunca el secreto rotado.
6. Aplicar el sistema a operaciones sensibles actuales y a las nuevas acciones de mantenimiento que se incorporen en V5, incluida la rotación/revocación de acceso aprobada en la Mejora 4.
7. Presentar la información desde Operaciones en lenguaje suficientemente claro para reconstruir qué ocurrió sin tener que interpretar logs crudos.

**Observabilidad y Actividad**

- **Operaciones** será la superficie canónica para esta auditoría administrativa y conservará el detalle técnico/correlación.
- **Actividad** sólo mostrará la acción cuando tenga una consecuencia funcional relevante para la filmoteca o para el uso visible de PikoFilm; no se duplicará cada mantenimiento puramente técnico.
- La misma acción no deberá generar dos fuentes de verdad paralelas: Actividad y Operaciones serán dos vistas del mismo hecho canónico cuando ambas apliquen.

**Resultado esperado para el usuario**

Semanas o meses después será posible saber si un cambio concreto lo produjo un automatismo o una intervención manual, desde qué parte de PikoFilm se inició, qué afectó y si terminó correctamente, sin exponer información sensible.

**Decisión del usuario:** aprobada.

### Mejora 11 · V5-C011 — Consolidar el CSS global histórico

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** UX · Rendimiento · Mantenibilidad · Limpieza legacy

**Problema detectado**

PikoFilm carga globalmente varias generaciones de estilos acumuladas a lo largo del proyecto. Esa convivencia aumenta el CSS descargado/evaluado, complica la cascada y eleva el riesgo de que una regla antigua afecte a una pantalla nueva o que un ajuste visual tenga efectos laterales inesperados.

**Alcance aprobado**

1. Auditar todas las hojas globales y sus consumidores reales antes de eliminar o fusionar nada.
2. Identificar reglas duplicadas, solapadas, obsoletas y estilos que ya no tengan consumidores vivos.
3. Consolidar la base global en el mínimo necesario y mover estilos específicos a sus superficies/componentes cuando sea seguro.
4. Retirar únicamente CSS cuya falta de uso o redundancia quede demostrada; no borrar por nombre de versión ni por intuición.
5. Mantener el aspecto actual de las superficies que ya funcionan. Esta mejora es una limpieza/consolidación técnica y no un rediseño visual.
6. Añadir pruebas de regresión suficientes para detectar cambios inesperados en las superficies canónicas durante la limpieza.
7. Medir el impacto en tamaño de CSS y comportamiento de carga antes/después para comprobar que la consolidación produce una mejora real.

**Condición de implantación**

La consolidación debe ser **segura y progresiva**. Si una hoja histórica sigue teniendo consumidores legítimos, se conserva hasta migrarlos explícitamente. El objetivo es reducir deuda y riesgo, no forzar una reescritura visual completa.

**Observabilidad**

La limpieza de estilos no debe generar entradas de Actividad. Los cambios relevantes de despliegue/pruebas y cualquier regresión detectada deberán ser diagnosticables técnicamente; no se creará ruido operativo innecesario por cada archivo CSS retirado.

**Resultado esperado para el usuario**

PikoFilm conservará su aspecto funcional actual, pero con una base de estilos más pequeña, coherente y predecible, reduciendo tiempos de carga y el riesgo de regresiones visuales futuras.

**Decisión del usuario:** aprobada.

### Mejora 12 · V5-C012 — Retirar físicamente CSS legacy sin consumidores

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** UX · Rendimiento · Mantenibilidad · Limpieza legacy

**Problema detectado**

Aunque una hoja de estilos antigua deje de importarse, conservarla indefinidamente dentro del repositorio mantiene deuda técnica y hace ambiguo si todavía forma parte del sistema. Esa ambigüedad facilita que estilos obsoletos vuelvan a reutilizarse por accidente o que futuras revisiones pierdan tiempo comprobando piezas ya muertas.

**Alcance aprobado**

1. Realizar un consumer sweep completo de cada hoja CSS histórica antes de eliminarla físicamente.
2. Eliminar del repositorio únicamente archivos y reglas sin consumidores vivos demostrados o cuya funcionalidad haya sido migrada de forma explícita.
3. No borrar hojas por su nombre de versión ni por antigüedad; la retirada debe basarse en evidencia de uso real.
4. Añadir protección de CI o tests que impidan reintroducir imports o dependencias hacia CSS retirado.
5. Mantener cualquier hoja legacy que siga siendo necesaria hasta completar su migración segura.
6. Coordinar esta mejora con la Mejora 11 para que consolidación y retirada se ejecuten como un único bloque de limpieza visual/técnica, evitando trabajo duplicado y dobles regresiones.
7. Comprobar antes y después que las superficies canónicas mantienen su aspecto y comportamiento esperados en desktop y móvil.

**Condición de implantación**

Esta mejora no es un rediseño. El objetivo es que **ningún CSS legacy permanezca sin un consumidor demostrado**, pero nunca a costa de romper una pantalla vigente. La retirada física sólo ocurre después de migración o prueba concluyente de no uso.

**Observabilidad**

No debe generar entradas funcionales en Actividad. Cualquier regresión o fallo técnico detectado durante la limpieza debe ser diagnosticable en Operaciones o CI según corresponda, sin crear ruido por cada archivo retirado.

**Resultado esperado para el usuario**

PikoFilm conservará el aspecto aprobado, pero el repositorio dejará de acumular hojas de estilo muertas o ambiguas. La base visual será más pequeña, comprensible y difícil de degradar con deuda histórica.

**Decisión del usuario:** aprobada y vinculada al mismo bloque de implantación que la Mejora 11.

### Mejora 13 · V5-C013 — Sistema visual canónico mediante design tokens

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** UX · Diseño · Coherencia · Mantenibilidad

**Problema detectado**

La evolución histórica de PikoFilm ha repartido decisiones visuales entre múltiples hojas y superficies. Eso facilita que páginas distintas terminen usando pequeñas variaciones de color, tipografía, espaciado, radios, bordes, sombras o estados aunque conceptualmente representen lo mismo.

**Regla de oro fijada por el usuario**

PikoFilm debe verse y sentirse **como una sola aplicación**. Ninguna página debe definir por su cuenta criterios visuales globales ni evolucionar como si fuera un producto independiente.

**Alcance aprobado**

1. Crear un sistema canónico de design tokens para colores, tipografía, escalas de espacio, radios, bordes, sombras, tamaños y estados visuales compartidos.
2. Hacer que los componentes y superficies nuevas reutilicen esos tokens en vez de introducir valores arbitrarios duplicados.
3. Migrar progresivamente las superficies actuales, priorizando patrones repetidos y evitando un rediseño masivo de una sola vez.
4. Definir semánticamente los tokens —por función, no sólo por valor— para que un cambio global pueda hacerse desde un único punto sin perseguir decenas de archivos.
5. Integrar los tokens con la consolidación CSS de las Mejoras 11 y 12 para que limpieza y coherencia visual formen una misma base arquitectónica.
6. Mantener excepciones sólo cuando exista una razón funcional real y documentada; las excepciones visuales no deben convertirse en otra capa de estilos paralelos.
7. Añadir protección mediante revisión/tests visuales o contratos adecuados para evitar que futuras páginas vuelvan a fragmentar el lenguaje visual.

**Resultado esperado para el usuario**

PikoFilm tendrá una identidad visual coherente en todas sus pantallas. Cuando se cambie una decisión global —por ejemplo un borde, un espaciado o un color semántico— podrá hacerse de forma centralizada y consistente, reduciendo diferencias accidentales y haciendo que la aplicación evolucione como un único producto.

**Decisión del usuario:** aprobada y elevada de P2 a **P1** por considerarse una regla de oro de PikoFilm.

### Mejora 14 · V5-C014 — Auditar y optimizar la carga real de todas las páginas

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Rendimiento · UX · Datos · Arquitectura

**Reformulación solicitada por el usuario**

La propuesta inicial de mejorar la percepción de carga con skeletons o mensajes queda descartada como objetivo principal. El usuario exige **mejorar el tiempo real de carga de las páginas**, no ocultarlo con estados visuales. Señala expresamente que la entrada inicial de **Calidad** tarda demasiado y pide revisar todas las cargas de la aplicación.

**Alcance aprobado**

1. Medir de forma comparable la carga inicial y las navegaciones principales de **todas las superficies canónicas** de PikoFilm, en desktop y móvil cuando proceda.
2. Priorizar las páginas con peor tiempo real, empezando por **Calidad** y cualquier otra que las mediciones identifiquen como lenta.
3. Descomponer cada carga en sus costes reales: consultas SQL, joins, agregaciones, round-trips, renderizado servidor/cliente, JavaScript, CSS, imágenes, peticiones redundantes, datos solicitados pero no visibles y caché desaprovechada.
4. Optimizar la causa, no el síntoma: reducir o reestructurar consultas, paginar/enriquecer después cuando corresponda, evitar cálculos repetidos, reutilizar read models/snapshots seguros, paralelizar sólo cuando aporte mejora real y eliminar trabajo innecesario.
5. Revisar el uso de `force-dynamic`, `no-store`, `router.refresh`, polling y otros mecanismos que puedan forzar recargas completas o impedir caché útil sin necesidad funcional.
6. Comprobar expresamente Calidad, Inicio, Catálogo, Actividad, Operaciones, Personas, Sagas y las demás rutas relevantes; ninguna página queda fuera por asumir que “ya va suficientemente rápido”.
7. Establecer una línea base antes de optimizar y medir después. Una mejora sólo se considerará cerrada si existe reducción objetiva del tiempo/coste o una justificación documentada cuando un límite sea inevitable.
8. No sustituir una página lenta por un spinner, skeleton o mensaje como solución. Los estados de carga sólo podrán usarse como complemento UX cuando exista espera inevitable, nunca como criterio de éxito de esta mejora.
9. Mantener la exactitud de los datos y las reglas funcionales V4/V5; no ganar velocidad a costa de mostrar datos incompletos, obsoletos o inconsistentes.
10. Cuando una optimización cambie arquitectura de consultas o almacenamiento, deberá cubrirse con tests de regresión funcional y de rendimiento apropiados.

**Resultado esperado para el usuario**

Entrar en Calidad y en el resto de PikoFilm debe ser objetivamente más rápido. El roadmap no dará por resuelto un problema de rendimiento porque la página “parezca” cargar mejor: se buscará y corregirá el cuello de botella real y se comprobará con medidas antes/después.

**Decisión del usuario:** aprobada con prioridad P1 y con la condición explícita de optimizar la carga real de todas las páginas, no maquillar la espera con mensajes o skeletons.

### Mejora 15 · V5-C015 — Error boundaries locales por secciones

**Estado:** RECHAZADA  
**Prioridad definitiva:** No entra en V5.  
**Categoría:** UX · Fiabilidad · Gestión de errores

**Propuesta evaluada**

Permitir que una sección secundaria de una página falle de forma aislada mientras el resto de la pantalla continúa funcionando, mediante límites de error locales y estados degradados parciales.

**Motivo de rechazo del usuario**

El usuario prefiere que un fallo relevante haga fallar la página de forma clara y visible, porque así resulta inequívoco que existe un problema y se puede investigar y solventar. No quiere que PikoFilm continúe mostrando una pantalla aparentemente correcta cuando una parte de sus datos o lógica ha fallado.

**Consecuencia para V5**

- No se introducirán error boundaries locales como estrategia general para ocultar o aislar errores de secciones.
- Cuando una dependencia necesaria de una página falle, se priorizará un error claro y diagnosticable de la superficie completa.
- El fallo deberá conservar suficiente contexto técnico en **Operaciones** para localizar la causa con rapidez.
- Sólo podrán existir degradaciones parciales si una futura funcionalidad las exige de forma explícita y se aprueba como excepción concreta.

**Resultado esperado para el usuario**

Cuando una página de PikoFilm no pueda garantizar que sus datos o lógica son correctos, el problema será evidente. Se prioriza detectar y corregir el fallo real antes que mantener una apariencia de funcionamiento parcial.

**Decisión del usuario:** rechazada porque prefiere un fallo completo y claro de página para detectar y solucionar los errores con mayor facilidad.
