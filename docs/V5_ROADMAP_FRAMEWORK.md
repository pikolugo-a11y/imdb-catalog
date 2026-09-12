# PikoFilm V5 — Marco de auditoría y roadmap

Estado: **marco de trabajo activo para definir V5 desde el estado real actual de V4**.

## Método obligatorio

La V5 se definirá bloque a bloque. Para cada uno de los 20 bloques:

1. Realizar una auditoría profunda del sistema real, no sólo de la documentación.
2. Revisar código, datos, infraestructura, ejecución, UX y costes cuando aplique.
3. Identificar defectos, deuda, riesgos, duplicidades, cuellos de botella y oportunidades de simplificación/evolución.
4. Presentar **no menos de 10 propuestas concretas** de evolución/corrección para V5.
5. Revisar las propuestas **una a una** con el usuario.
6. Registrar cada propuesta como **APROBADA** o **RECHAZADA**, con motivo y alcance.
7. No implementar funcionalidad V5 durante esta fase de definición salvo petición expresa posterior.
8. Mantener este documento y los documentos de decisión actualizados para que el roadmap V5 sea recuperable desde Git sin depender del historial del chat.

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

- Punto 1 — Arquitectura general: **CERRADO — 15/15 PROPUESTAS APROBADAS** (`V5_AUDIT_01_ARCHITECTURE.md`; decisiones en `V5_DECISIONS_01_ARCHITECTURE.md` y `V5_DECISIONS_01_ARCHITECTURE_10_15.md`)
- Punto 2 — Rendimiento: **PENDIENTE**
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

## Regla de decisiones

Las propuestas de V5 se numerarán desde cero para esta nueva revisión y no heredarán decisiones borradas de la preparación anterior. Cada decisión debe quedar persistida en Git antes de pasar a la siguiente.
