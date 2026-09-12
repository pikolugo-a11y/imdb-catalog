# PikoFilm V5 — Decisiones 01: Arquitectura general (ARQ-10 a ARQ-15)

Estado: **EN REVISIÓN**  
Rama de trabajo: `roadmap/v5-01-architecture-decisions`

Continuación de `docs/V5_DECISIONS_01_ARCHITECTURE.md`. Este documento registra las decisiones ARQ-10 a ARQ-15 del Punto 1 — Arquitectura general. Cada decisión se persiste antes de pasar a la siguiente propuesta.

## ARQ-10 — Gate de CI antes de desplegar cambios en Railway

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 formalizará que ningún commit nuevo de `main` podrá promoverse a un worker productivo de Railway sin haber superado previamente las validaciones CI obligatorias definidas para ese commit.

### Reglas

- Un commit de `main` sin CI válido no será desplegable en Railway.
- El gate será uniforme para API, FAST, Plex y Technical, salvo excepciones explícitas y justificadas.
- La implementación podrá usar integración nativa Railway/GitHub checks o un mecanismo equivalente de promoción controlada; la herramienta concreta se decidirá durante implementación.
- El gate se aplicará al commit final que llega a producción, no sólo al head previo del PR.
- ARQ-08 y ARQ-09 definirán la configuración y qué servicios deben desplegarse; ARQ-10 decidirá si ese commit está autorizado para desplegarse.
- El diseño deberá evitar introducir un segundo pipeline paralelo innecesario.

### Motivo

La auditoría encontró que Railway sigue `main` y puede iniciar despliegues sin una barrera arquitectónica uniforme que espere al resultado de CI del commit final. Aunque el flujo habitual PR + CI + merge reduce el riesgo, no garantiza por sí mismo que el commit productivo de `main` haya pasado todas las validaciones antes de comenzar el rollout.

### Alcance V5

La implementación deberá coordinarse con el bloque específico de CI/CD. Esta decisión fija la invariante arquitectónica: código no validado no se promueve a executors Railway de producción.

## ARQ-11 — Matriz explícita de compatibilidad entre Vercel y los workers

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 versionará de forma explícita los contratos que cruzan fronteras de ejecución entre Vercel, Neon y los workers Railway. Cada trabajo durable declarará la versión de protocolo con la que fue creado y cada executor declarará qué versiones sabe consumir.

### Reglas

- Los payloads y comandos que crucen planos tendrán una versión de contrato/protocolo explícita.
- El gateway de ARQ-02 persistirá la versión de protocolo al crear trabajo durable.
- Cada worker declarará el rango o conjunto de versiones compatibles que puede ejecutar.
- Un worker no ejecutará silenciosamente trabajo con un protocolo incompatible; lo dejará bloqueado o pendiente con diagnóstico observable y recuperable.
- Los despliegues graduales podrán admitir temporalmente más de una versión para permitir compatibilidad hacia atrás durante la transición.
- La versión se aplicará sólo a contratos inter-plano relevantes, no a cada función interna del producto.
- Tests y CI comprobarán compatibilidad mínima entre el productor y los executors antes de promover cambios.

### Motivo

Vercel y Railway tienen ciclos de despliegue separados y pueden existir ventanas normales de version skew. Mientras los contratos sean compatibles esto es correcto, pero sin una versión explícita una incompatibilidad podría manifestarse como un fallo funcional tardío o, peor, como una ejecución incorrecta silenciosa.

### Alcance V5

El primer protocolo V5 deberá modelar los contratos reales de Batch, gateway y continuaciones durables aprobados en ARQ-02 y ARQ-07. La implementación no pretende introducir una plataforma compleja de versionado, sino hacer verificables las fronteras críticas del sistema.

## ARQ-12 — Tests arquitectónicos automáticos

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 incorporará una capa explícita de tests arquitectónicos en CI para convertir las fronteras y contratos aprobados del sistema en invariantes ejecutables que no puedan romperse silenciosamente mediante cambios futuros.

### Reglas mínimas a validar

- Ningún proceso clasificado como durable/largo podrá ejecutarse directamente dentro de Vercel.
- Todo `PROC-*` ejecutable deberá existir en el registro canónico aprobado en ARQ-05.
- Cada proceso sólo podrá usar `worker_pool` y `executor` permitidos por su contrato.
- No se permitirán defaults silenciosos de `executor` capaces de falsear la identidad real del worker.
- Los adapters de infraestructura no deberán contener recetas funcionales u orquestación que deban vivir en cores canónicos.
- Las continuaciones que requieran garantía deberán pasar por el mecanismo durable aprobado en ARQ-07.
- Los workers no podrán consumir payloads con una versión de protocolo incompatible con ARQ-11.
- La configuración Railway declarada deberá ser coherente con los servicios y contratos versionados.
- GitHub Actions seguirá limitado a excepciones explícitamente registradas y no podrá convertirse en executor general de forma implícita.

### Alcance

- Estos tests complementan, no sustituyen, los tests unitarios, integración, contratos y E2E.
- Las reglas deberán basarse en fuentes canónicas de código/configuración y evitar comprobaciones frágiles de texto cuando exista una representación estructurada.
- Las excepciones arquitectónicas deberán ser explícitas, justificadas y revisables; no se resolverán desactivando el test de forma genérica.
- El bloque específico de Tests y CI/CD podrá ampliar cobertura, pero no rebajar estas invariantes sin una nueva decisión de roadmap.

### Motivo

La auditoría concluyó que la arquitectura conceptual de PikoFilm es razonable, pero parte de sus fronteras dependen hoy de convenciones humanas. El bug real de identidad `worker_pool='plex'` con `executor='railway_batch_fast'`, la presencia de un proceso ejecutable fuera del catálogo canónico y la ejecución larga de Plex en Vercel demuestran que las convenciones sin enforcement pueden derivar con el tiempo.

### Alcance V5

La implementación deberá introducir estos tests de forma incremental junto a ARQ-01 a ARQ-11, de modo que cada nueva frontera quede protegida en CI desde el momento en que se materialice.

## ARQ-13 — Presupuesto formal para trabajo síncrono

**Estado:** APROBADA  
**Fecha:** 2026-09-13

### Decisión

V5 clasificará explícitamente cada proceso por clase de ejecución y presupuesto técnico para convertir la frontera Vercel/Railway en una regla medible y verificable, no en una convención informal.

### Clases mínimas

- **Interactivo corto:** trabajo ligado a una petición de usuario que debe responder rápidamente y puede ejecutarse en Vercel dentro de límites estrictos.
- **Coordinador corto:** trabajo que consulta, decide, planifica o encola, pero no realiza procesamiento pesado ni bucles prolongados.
- **Durable:** trabajo con red prolongada, fan-out, volumen significativo, bucles largos o posibilidad razonable de exceder el presupuesto síncrono; debe ejecutarse mediante un executor durable.

### Reglas

- Cada proceso del registro canónico de ARQ-05 declarará su clase de ejecución.
- Cada clase tendrá límites explícitos de duración esperada, volumen de trabajo y tipo/cantidad de I/O externo cuando corresponda.
- Vercel sólo podrá ejecutar trabajo que pertenezca a una clase permitida para el plano síncrono.
- ARQ-12 deberá detectar procesos durables ejecutados directamente en Vercel o cambios que hagan que una implementación deje de cumplir su presupuesto declarado.
- La clasificación podrá revisarse cuando cambie la carga real del proceso, pero no se ignorará un exceso recurrente ampliando timeouts sin reevaluar la arquitectura.
- Coordinadores ligeros como `PROC-PLAN-002` permanecerán en Vercel mientras sigan cumpliendo objetivamente su presupuesto.

### Motivo

La auditoría confirmó que la separación conceptual Vercel=control/Railway=ejecución es correcta, pero también mostró que sin un presupuesto explícito puede aparecer trabajo pesado dentro del plano síncrono, como ocurrió con `PROC-NOV-009`. Definir clases y límites permite conservar procesos cortos donde están bien ubicados y mover sólo aquellos que realmente necesitan ejecución durable.

### Alcance V5

La implementación concreta de los presupuestos se coordinará con Rendimiento, Tests y CI/CD. Esta decisión fija la regla arquitectónica: el lugar de ejecución de un proceso debe justificarse por una clase y un presupuesto verificables.