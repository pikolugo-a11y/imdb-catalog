# PikoFilm V5 — Decisiones 04: Procesos automáticos y Batch

Estado: **FASE 2 ACTIVA**  
Rama: `audit/v5-04-processes`

Este documento registra decisiones aprobadas/rechazadas del Punto 4. Cada decisión se persiste antes de presentar la siguiente.

---

## PROC-01 — Registro canónico y ejecutable de procesos

**Estado: APROBADA.**

### Problema que resuelve

La auditoría detectó que la identidad y metadata de los procesos `PROC-*` están repartidas entre:

- `docs/processes/PROCESS_CATALOG.md`;
- `lib/process-display.js`;
- starters Batch;
- adapters de workers;
- `SAFE_AUTOMATIC_PROCESS_CODES`;
- políticas del planner;
- configuración de automatizaciones;
- excepciones especiales.

La deriva ya es real: `PROC-SER-007` y `PROC-LC-001` ejecutan producción pero no aparecen en el catálogo maestro documental.

### Decisión

V5 tendrá **un único registro canónico ejecutable y versionado en Git para todos los procesos PikoFilm**.

Ese registro será la fuente técnica de verdad sobre la identidad y el contrato de ejecución de cada `PROC-*`.

### El registro debe poder declarar, cuando aplique

- código;
- nombre legible;
- dominio;
- estado: activo / legacy / retirado;
- modelos de ejecución admitidos: manual, individual, Batch, automático, sistema;
- tipo de ejecución: Batch común, controlador especializado, GitHub Actions, Vercel chunked u otra excepción explícita;
- pool requerido: `api`, `fast`, `plex` o especial;
- adapter/capacidad requerida del worker;
- si puede entrar en el planner automático;
- si es global;
- concurrencia/limitaciones estructurales;
- core canónico al que delega;
- fuentes externas relevantes;
- protecciones operativas necesarias.

No todos los campos tienen que ser obligatorios para todos los modelos de ejecución; el esquema debe expresar explícitamente las excepciones.

### Invariantes

1. **Ningún componente puede inventar una segunda definición funcional del mismo proceso.**
2. Todo `PROC-*` activo que se use en código debe existir en el registro canónico.
3. Los nombres, labels y metadata de UI/documentación se derivarán del registro o se validarán contra él para evitar divergencia.
4. Planner y automatizaciones no mantienen listas paralelas de autoridad: un proceso automático debe estar expresamente autorizado por el registro.
5. Los workers no pueden declarar adapters desconectados del registro.
6. Los procesos especiales —por ejemplo `PROC-PQ-002` o `PROC-NOV-001`— no se fuerzan artificialmente al Batch común; el registro declara su modelo de ejecución real.
7. Un proceso global protegido como `PROC-NOV-009` puede declarar explícitamente `automatic=false`; CI debe impedir introducirlo en planificación automática por accidente.
8. Los procesos dudosos/históricos como `PROC-NOV-013` deben clasificarse como activos, legacy o retirados; no se borran por intuición.

### CI / validación obligatoria

V5 debe añadir validaciones automáticas que fallen cuando, al menos:

- aparece un `processCode` desconocido;
- un proceso Batch referencia un pool/adapter no declarado;
- un adapter desplegable no está respaldado por un proceso registrado;
- un proceso marcado como no automático aparece en planner/automatizaciones;
- existe metadata duplicada contradictoria entre registro y consumidores;
- un proceso declarado activo carece de las piezas estructurales obligatorias para su modelo de ejecución.

La validación exacta puede implementarse con tests/CI, pero debe ser ejecutable y no depender de revisión manual.

### Límites

- El registro **no absorbe lógica de negocio** de Series, Personas, PikoScore, Novedades, etc.
- Las reglas de elegibilidad permanecen en sus cores/módulos canónicos.
- No se crea una “mega-configuración” que sustituya el código funcional.
- La aprobación no autoriza aún refactor masivo, cambios de Neon, despliegues ni cambios de comportamiento de procesos.
- No añade workers, polling ni coste operativo material.

### Resultado esperado

Una sola identidad/contrato por proceso, con workers, planner, Actividad, UI técnica, CI y documentación alineados sobre esa definición.
