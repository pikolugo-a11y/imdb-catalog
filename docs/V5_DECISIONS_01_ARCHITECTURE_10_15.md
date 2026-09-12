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
