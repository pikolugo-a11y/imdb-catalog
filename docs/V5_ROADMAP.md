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

[CONTENIDO PREVIO SIN CAMBIOS HASTA MEJORA 36]

### Mejora 37 · V5-C037 — Guardar presets de filtros de Catálogo

**Estado:** RECHAZADA  
**Prioridad definitiva:** No entra en V5.  
**Categoría:** Catálogo · UX · Conveniencia

**Propuesta evaluada**

Permitir guardar combinaciones de filtros de Catálogo para reutilizarlas después, por ejemplo rangos de años, género, nota mínima, estado visto/no visto u otras combinaciones frecuentes.

**Motivo de rechazo del usuario**

El usuario no quiere añadir filtros guardados ni presets persistentes y no considera que esta comodidad aporte suficiente valor para V5.

**Consecuencia para V5**

- No se añadirá un sistema de presets o vistas guardadas de filtros.
- Catálogo seguirá permitiendo aplicar filtros manualmente como hasta ahora.
- No se añadirá persistencia adicional en navegador o servidor para recordar combinaciones personalizadas.
- Esta decisión no impide optimizar el rendimiento de filtros ni mantener correctamente el estado de navegación dentro de los flujos ya existentes.

**Resultado esperado para el usuario**

Catálogo seguirá siendo directo y sin elementos adicionales de gestión de presets. V5 se centrará en mejorar velocidad, coherencia y funcionamiento de los filtros existentes.

**Decisión del usuario:** rechazada.
