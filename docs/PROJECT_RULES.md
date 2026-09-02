# PikoFilm — Reglas de oro permanentes

Documento obligatorio para cualquier sesión futura. Leer después de `AGENTS.md` y antes de modificar el proyecto.

## Regla 0 — Propósito

PikoFilm es una **base de datos audiovisual personal maestra**. Gobierna selección editorial, identidad, metadatos, PikoScore, relación con Plex, calidad física/técnica, Series, Personas, Sagas y explotación del catálogo.

Plex es la fuente de verdad física y de reproducción. PikoFilm no gestiona progreso, visto/no visto, historial ni hábitos de consumo.

## Reglas de oro

1. **Continuidad.** Una vez autorizado continuar, ejecutar todo lo posible sin pedir confirmación entre fases; parar sólo por finalización, decisión real del usuario o bloqueo técnico.

2. **Arquitectura antes que parche.** Identificar fuente de verdad, propietario, derivados e impacto antes de corregir/ampliar.

3. **Fuentes de verdad.** No crear fuentes canónicas paralelas para resolver un problema local.

4. **Comprender antes de modificar.** Revisar código, BBDD, procesos, infraestructura y documentación afectados.

5. **Sistema vivo manda.** Si documentación y producción discrepan, verificar la implementación viva y corregir la documentación en el mismo bloque.

6. **No probar código no desplegado.** Confirmar commit/deployment antes de atribuir resultados funcionales.

7. **Aceptación funcional tras deploy.** El usuario ejecuta las pruebas funcionales/visuales en producción; ChatGPT prepara y conduce la batería prueba a prueba y puede realizar comprobaciones técnicas previas.

8. **No cerrar incidencias antes de validar.** Implementar, mergear, desplegar, validar y sólo después cerrar, salvo trabajo explícitamente no bloqueante.

9. **Documentación es implementación.** Todo cambio funcional/arquitectónico revisa en el mismo ciclo `docs/README.md`, `product/`, `architecture/`, `processes/`, `operations/` y el roadmap/gate aplicable. No mantener especificaciones V2 paralelas.

10. **Memoria persistente.** Decisiones duraderas en código, tests, BBDD, issues o documentación; nunca sólo en conversación.

11. **Issues para trabajo relevante.** Mantener contexto, criterios y estado coherentes con el sistema real.

12. **Baseline antes de evolucionar.** Cerrar lo validado y dejar baseline inequívoca antes de una nueva versión/fase.

13. **Inicio de nueva conversación.** Seguir `AGENTS.md` y `docs/README.md`; mientras PRE-V4 esté activo leer además `PRE_V4_READINESS_PLAN.md`. No usar memoria conversacional como fuente de verdad.

14. **Trazabilidad.** Una lección arquitectónica o regresión valiosa debe convertirse en test/contrato/documentación.

15. **Seguridad.** Nunca persistir tokens, credenciales o secretos en código, documentación, issues o logs.

16. **Merge sí; deployment Vercel no.** Un bloque preparado se integra por PR/CI y merge a `main`; los deployments de producción Vercel los realiza exclusivamente el usuario. Tras merge, comunicar HEAD preparado; tras confirmación del usuario, verificar técnicamente el deployment.

17. **Infraestructura por responsabilidad, no por nombre.** No clasificar Railway, tablas, módulos o workflows como legacy por sufijo/nombre. Auditar consumidores y comportamiento vivo.

18. **Neon destructivo con gate.** Auditar antes de borrar; UNKNOWN bloquea eliminación; usar migraciones revisables + smoke para cambios destructivos.

19. **Eficiencia.** Filtrar/agregar cerca de PostgreSQL, evitar transferencias/`SELECT *`/históricos/índices innecesarios y justificar coste sin sacrificar integridad o trazabilidad. Detalle: `docs/INFRASTRUCTURE_EFFICIENCY.md`.

20. **Batch reutiliza operación canónica.** Individual y Batch deben ejecutar la misma receta funcional. Batch sólo añade selección, cola, leases, concurrencia, retry, rate limits, pausa/cancelación y métricas. Arquitectura: `docs/processes/BATCH_ARCHITECTURE.md`.

21. **Observabilidad única.** `process_runs` + eventos/errores son la frontera canónica. No crear otro `*_runs` sin demostrar que la arquitectura común no cubre la necesidad.

22. **Documentación histórica no gobierna.** Los tombstones/documentos históricos sólo aportan evidencia. La autoridad documental se descubre desde `docs/README.md`.

## Cierre de sesión significativa

Antes de cerrar trabajo significativo, comprobar que el estado durable está reflejado en GitHub/documentación y que cualquier deuda real queda registrada. Si cambió funcionalidad o arquitectura, actualizar las fuentes canónicas correspondientes antes de considerar el bloque entregado.