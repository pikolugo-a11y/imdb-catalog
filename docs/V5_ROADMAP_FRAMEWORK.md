# PikoFilm V5 — Marco de auditoría y roadmap

Estado: **marco de trabajo activo para definir V5 desde el estado real actual de V4**.

## Método obligatorio por cada bloque

La V5 se definirá bloque a bloque. **Ninguno de los 20 bloques se considerará cerrado hasta completar íntegramente estas tres fases y en este orden:**

### Fase 1 — Auditoría extremadamente detallada

1. Realizar una auditoría **completa, profunda y extremadamente detallada** del sistema real, no sólo de la documentación.
2. Revisar todo lo que sea materialmente relevante para el bloque: código, datos, esquema e índices, infraestructura, ejecución real, colas, workers, integraciones, frontend/UX, CI/CD, seguridad, costes, logs, métricas y documentación cuando aplique.
3. Contrastar documentación contra implementación y, cuando sea posible, contra el estado vivo de los servicios implicados.
4. Identificar defectos, deuda, riesgos, duplicidades, incoherencias, cuellos de botella, trabajo redundante, costes evitables, límites de escalabilidad y oportunidades de simplificación/evolución.
5. Separar claramente hechos observados, riesgos, hipótesis y oportunidades. No dar por bueno un comportamiento sólo porque esté documentado.
6. Dejar la auditoría persistida en Git y suficientemente detallada para poder reconstruir el diagnóstico sin depender del historial del chat.

### Fase 2 — Propuestas para V5

7. A partir de la auditoría, presentar **como mínimo 10 propuestas concretas para V5**. Pueden ser ideas, mejoras, correcciones, simplificaciones, cambios funcionales, cambios de UX, arquitectura, operaciones, rendimiento, coste, seguridad o cualquier otra evolución que resulte justificada por la auditoría.
8. Las propuestas se revisarán **una a una** con el usuario. No se aprobarán en bloque.
9. Cada propuesta se registrará como **APROBADA** o **RECHAZADA**, con su motivo, alcance y límites.
10. Cada decisión aprobada o rechazada debe persistirse en Git antes de pasar a la siguiente propuesta.
11. No implementar funcionalidad V5 durante esta fase de definición salvo petición expresa posterior.

### Fase 3 — Road Map Innovador

12. Después de terminar las propuestas V5 del bloque, presentar **como mínimo 5 innovaciones deliberadamente rompedoras y atrevidas** que puedan tener sentido para versiones futuras, aunque no sean apropiadas para V5.
13. Estas innovaciones deben surgir del conocimiento adquirido en la auditoría del bloque, pero pueden romper con la arquitectura o el producto actuales si existe una visión futura razonable.
14. Las innovaciones se revisarán también **una a una** con el usuario. El usuario decide individualmente si cada una entra o no en el `ROADMAP_INNOVADOR.md`.
15. Sólo las innovaciones expresamente aprobadas se incorporan al Road Map Innovador. Las rechazadas no se conservan como backlog implícito.
16. Una innovación aprobada para el Road Map Innovador **no entra automáticamente en V5, V6 ni ninguna versión concreta**; su promoción a una versión requerirá una decisión futura específica.

### Regla de cierre

Un bloque sólo pasa a **CERRADO** cuando existen en Git: la auditoría completa, las decisiones de las propuestas V5 y la ronda de al menos 5 innovaciones futuras revisadas individualmente. Mantener los documentos suficientemente actualizados para que el roadmap completo sea recuperable desde Git sin depender del historial del chat.

## Frontera de producto fija

PikoFilm gestiona **la base de datos, el catálogo, su calidad, sus procesos, integraciones y operaciones**. **Plex es el sistema responsable del historial personal de visionado y de las señales de gusto del usuario.**

Por tanto, esta revisión V5 y cualquier roadmap futuro deben respetar estas reglas:

- PikoFilm no sustituirá a Plex como gestor de qué películas o episodios ha visto el usuario.
- PikoFilm no construirá perfiles de gustos ni motores de recomendación personal basados en historial de visionado o valoraciones.
- Si una función de gestión del catálogo necesita consultar si algo está visto, se tratará como un dato externo procedente de Plex, no como un dominio propio de PikoFilm.
- Las propuestas de auditoría e innovación que invadan esta frontera deberán descartarse o reformularse.

## 20 bloques de revisión

1. **Arquitectura general**
   - separación Vercel / Railway / Neon / GitHub
   - responsabilidades de cada capa
   - procesos síncronos vs asíncronos
   - dependencias cruzadas y acoplamientos

2. **Rendimiento**
   - carga del frontend
   - consultas a Neon
   - llamadas entre servicios
   - trabajo redundante
   - caché, paginación y carga incremental

3. **Base de datos y modelo de datos**
   - tablas redundantes o históricas
   - índices
   - crecimiento de tablas
   - datos canónicos vs read models
   - retención y limpieza

4. **Procesos automáticos y Batch**
   - planificación
   - concurrencia
   - reintentos
   - timeouts
   - recuperación de procesos huérfanos
   - reparto de carga

5. **Observabilidad y errores**
   - errores activos vs históricos
   - resolución automática
   - trazabilidad
   - métricas útiles vs ruido
   - logs

6. **Workers y servicios persistentes**
   - consumo inactivo
   - polling
   - heartbeats
   - wake-up / sleep
   - escalado y coste

7. **Integraciones externas**
   - Plex
   - TMDb
   - IMDb / fuentes externas
   - Watchmode / OMDb / MDBList y otras
   - límites, timeouts, fallbacks y degradación

8. **Frontend y UX**
   - coherencia visual
   - navegación
   - densidad de información
   - móvil
   - loading / error / empty
   - claridad funcional de superficies

9. **Sistema de diseño / CSS**
   - estilos duplicados
   - generaciones V2/V3/V4 coexistentes
   - componentes repetidos
   - tokens, tipografía, controles, cards, tablas y responsive

10. **Código legacy y deuda técnica**
    - componentes antiguos
    - rutas obsoletas
    - shims
    - módulos duplicados
    - utilidades equivalentes

11. **Tests**
    - unitarios
    - integración
    - contratos
    - E2E
    - accesibilidad
    - fallos reales de runtime

12. **CI/CD**
    - cobertura real de GitHub Actions
    - huecos aunque CI esté verde
    - tiempos del pipeline
    - gates de merge
    - preproducción

13. **Seguridad**
    - secretos
    - permisos
    - endpoints internos
    - acciones peligrosas
    - validación de inputs
    - exposición de datos técnicos

14. **Coste**
    - Neon
    - Railway
    - Vercel
    - almacenamiento
    - logs
    - consultas repetidas
    - automatismos innecesarios

15. **Mantenibilidad**
    - implementación canónica
    - documentación
    - nomenclatura
    - estructura de carpetas
    - migraciones
    - ramas/restos históricos

16. **Escalabilidad**
    - crecimiento 10x de catálogo
    - crecimiento 10x de automatizaciones
    - crecimiento 10x de actividad
    - límites DB/workers/APIs

17. **Consistencia funcional**
    - paridad manual / Batch / automático
    - evitar reglas duplicadas
    - una fuente de verdad por proceso

18. **Recuperación y resiliencia**
    - caída/lentitud de Plex
    - caída de Railway
    - degradación de Neon
    - timeout/muerte de Vercel
    - recuperación automática y segura

19. **Calidad de datos**
    - identidades
    - duplicados
    - inconsistencias Plex-catálogo
    - datos parciales
    - estados imposibles o contradictorios

20. **Gobierno del producto**
    - qué es canónico en V4
    - qué se puede cambiar en V5
    - qué áreas están cerradas
    - qué se simplifica, rediseña o elimina

## Estado de revisión

- Punto 1 — Arquitectura general: **CERRADO — auditoría completada; 15/15 propuestas V5 aprobadas; ronda de innovación completada; INNO-01 aprobada** (`V5_AUDIT_01_ARCHITECTURE.md`; decisiones en `V5_DECISIONS_01_ARCHITECTURE.md` y `V5_DECISIONS_01_ARCHITECTURE_10_15.md`; innovación aprobada en `ROADMAP_INNOVADOR.md`)
- Punto 2 — Rendimiento: **FASE 1 CERRADA — auditoría extremadamente detallada completada; Fase 2 de decisiones V5 pendiente** (`V5_AUDIT_02_PERFORMANCE.md`)
- Punto 3 — Base de datos y modelo de datos: **PENDIENTE**
- Punto 4 — Procesos automáticos y Batch: **PENDIENTE**
- Punto 5 — Observabilidad y errores: **PENDIENTE**
- Punto 6 — Workers y servicios persistentes: **PENDIENTE**
- Punto 7 — Integraciones externas: **PENDIENTE**
- Punto 8 — Frontend y UX: **PENDIENTE**
- Punto 9 — Sistema de diseño / CSS: **PENDIENTE**
- Punto 10 — Código legacy y deuda técnica: **PENDIENTE**
- Punto 11 — Tests: **PENDIENTE**
- Punto 12 — CI/CD: **PENDIENTE**
- Punto 13 — Seguridad: **PENDIENTE**
- Punto 14 — Coste: **PENDIENTE**
- Punto 15 — Mantenibilidad: **PENDIENTE**
- Punto 16 — Escalabilidad: **PENDIENTE**
- Punto 17 — Consistencia funcional: **PENDIENTE**
- Punto 18 — Recuperación y resiliencia: **PENDIENTE**
- Punto 19 — Calidad de datos: **PENDIENTE**
- Punto 20 — Gobierno del producto: **PENDIENTE**

## Road Map Innovador

Existe `docs/ROADMAP_INNOVADOR.md` como banco separado de apuestas futuras. Tras cada auditoría temática se revisarán **como mínimo 5 innovaciones rompedoras, una a una**, y sólo se incorporarán al documento cuando sean aprobadas expresamente. Una innovación aprobada para este banco no genera alcance automático en V5 ni en ninguna versión futura.

## Regla de decisiones

Las propuestas de V5 se numerarán desde cero para esta nueva revisión y no heredarán decisiones borradas de la preparación anterior. Cada decisión debe quedar persistida en Git antes de pasar a la siguiente.
