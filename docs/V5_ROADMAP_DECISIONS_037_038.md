# PikoFilm V5 — Continuación canónica de decisiones

Este archivo continúa temporalmente `docs/V5_ROADMAP.md` desde la Mejora 37. Se mantiene separado para preservar íntegramente el roadmap existente mientras continúa la auditoría PRE‑V5. Antes de cerrar la fase de decisiones deberá consolidarse de nuevo en el roadmap canónico sin perder ninguna decisión.

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
