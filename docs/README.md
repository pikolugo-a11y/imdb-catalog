# PikoFilm — Documentación canónica

Estado: **fuente de verdad documental viva**.

Este índice existe para que una persona o una IA pueda reconstruir PikoFilm desde el repositorio sin depender de conversaciones anteriores.

## Entrada obligatoria para IA

1. `/AGENTS.md`
2. `/docs/AI_DEVELOPMENT_GUIDE.md`
3. `/docs/PROJECT_RULES.md`
4. `/docs/PRE_V4_READINESS_PLAN.md` mientras PRE-V4 siga activo
5. este índice
6. `/docs/processes/PROCESS_CATALOG.md`
7. `/docs/processes/BATCH_ARCHITECTURE.md`
8. documentación del dominio afectado

**El sistema vivo manda.** Si código, Neon, Railway, Vercel o GitHub Actions contradicen un documento, se verifica la implementación viva y se corrige la documentación en el mismo bloque de trabajo.

## Fuentes canónicas actuales

### Desarrollo con IA
- `AI_DEVELOPMENT_GUIDE.md` — contrato de desarrollo AI-first, jerarquía de fuentes y procedimiento de modificación.
- `PROJECT_RULES.md` — reglas operativas del proyecto.
- `/AGENTS.md` — entrypoint raíz de cualquier nueva sesión/agente.

### PRE-V4
- `PRE_V4_READINESS_PLAN.md` — gate maestro de cierre V3 y preparación V4.
- Los documentos `PRE_V4_*` restantes son evidencias/auditorías de fases concretas; no sustituyen la arquitectura canónica.

### Procesos
- `processes/PROCESS_CATALOG.md` — inventario maestro de procesos vivos y retirados.
- `processes/BATCH_ARCHITECTURE.md` — arquitectura Batch vigente y contratos de paridad.

## Regla documental no negociable

Un cambio funcional o arquitectónico no está terminado hasta revisar su impacto documental. Como mínimo hay que comprobar:

`AGENTS.md → AI_DEVELOPMENT_GUIDE → PROCESS_CATALOG → BATCH_ARCHITECTURE → documento de dominio → PRE_V4/roadmap si aplica`.

No se debe crear una segunda fuente de verdad para explicar el mismo concepto. Si un documento histórico contradice una fuente canónica, debe marcarse como histórico, consolidarse o retirarse tras comprobar que no tiene valor operativo vigente.

## Arquitectura de documentación P6

P6 consolidará progresivamente la documentación en estas áreas, evitando fragmentación artificial:

- `architecture/` — sistema, datos, ejecución, observabilidad y fuentes externas.
- `product/` — especificación funcional, Lifecycle y arquitectura de información/UX.
- `processes/` — catálogo, Batch y procesos de dominio.
- `operations/` — runbooks de Neon, Railway, Vercel, GitHub Actions, incidentes y recuperación.
- `development/` — estructura del repo, desarrollo local, testing, migraciones y contribución AI-first.

Hasta que una pieza haya sido consolidada, los documentos existentes pueden servir como evidencia histórica, pero **no prevalecen** sobre las fuentes canónicas enumeradas arriba ni sobre el sistema vivo.
