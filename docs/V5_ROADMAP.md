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

[DECISIONES 1–36 SIN CAMBIOS; SE CONSERVA EL CONTENIDO CANÓNICO EXISTENTE]

### Mejora 37 · V5-C037 — Guardar combinaciones de filtros de Catálogo

**Estado:** RECHAZADA  
**Prioridad definitiva:** No entra en V5.  
**Categoría:** Catálogo · UX · Conveniencia

**Propuesta evaluada**

Permitir guardar combinaciones de filtros de Catálogo para reutilizarlas posteriormente sin tener que reconstruirlas manualmente.

**Motivo de rechazo del usuario**

El usuario no quiere añadir filtros guardados ni presets persistentes en Catálogo y no considera que esta comodidad justifique el estado y complejidad adicional.

**Consecuencia para V5**

- No se añadirá un sistema para guardar combinaciones de filtros.
- Los filtros seguirán funcionando de forma directa en cada uso, sin presets persistentes.
- Esta decisión no afecta a las optimizaciones de rendimiento, filtrado u ordenación ya aprobadas para Catálogo.

**Resultado esperado para el usuario**

Catálogo mantendrá una experiencia directa y sin elementos adicionales de gestión de filtros guardados.

**Decisión del usuario:** rechazada.

### Mejora 38 · V5-C038 — Guardar vistas completas de Catálogo

**Estado:** RECHAZADA  
**Prioridad definitiva:** No entra en V5.  
**Categoría:** Catálogo · UX · Personalización

**Propuesta evaluada**

Permitir guardar vistas completas de Catálogo que recuerden filtros, ordenación y configuración de visualización para recuperarlas posteriormente con un nombre.

**Motivo de rechazo del usuario**

El usuario no quiere añadir vistas guardadas de Catálogo. La funcionalidad amplía la misma dirección de personalización persistente que ya rechazó en la Mejora 37 y no aporta valor suficiente para V5.

**Consecuencia para V5**

- No se guardarán vistas completas ni configuraciones persistentes de Catálogo.
- No se añadirá gestión de nombres, edición o eliminación de vistas.
- Catálogo conservará filtros, ordenación y visualización normales sin una capa adicional de personalización persistente.
- Esta decisión no afecta a las mejoras aprobadas de rendimiento, diseño visual común ni comportamiento actual de Catálogo.

**Resultado esperado para el usuario**

Catálogo seguirá siendo simple y directo, sin un sistema adicional de vistas guardadas que el usuario no necesita.

**Decisión del usuario:** rechazada.
