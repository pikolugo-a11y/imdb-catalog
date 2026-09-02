# PikoFilm — Reglas de oro permanentes

Documento obligatorio para cualquier sesión futura. Leer después de `AGENTS.md` y antes de modificar el proyecto.

## Propósito

PikoFilm es una **base de datos audiovisual personal maestra**. Gobierna selección editorial, identidad, metadatos, PikoScore, relación con Plex, calidad física/técnica, Series, Personas, Sagas y explotación del catálogo. Plex es la fuente de verdad física y de reproducción.

## Reglas de oro

1. **Continuidad.** Una vez autorizado continuar, ejecutar todo lo posible sin pedir confirmación entre fases; parar sólo por finalización, decisión real o bloqueo técnico.
2. **Arquitectura antes que parche.** Identificar fuente de verdad, propietario, derivados e impacto antes de corregir/ampliar.
3. **Una fuente canónica por responsabilidad.** No crear modelos paralelos para resolver problemas locales.
4. **Comprender antes de modificar.** Revisar código, BBDD, procesos, infraestructura y documentación afectados.
5. **Sistema vivo manda.** Si documentación y producción discrepan, verificar la implementación viva y corregir la documentación en el mismo bloque.
6. **No probar código no desplegado.** Confirmar commit/deployment antes de atribuir resultados funcionales.
7. **Aceptación funcional tras deploy.** El usuario ejecuta las pruebas funcionales/visuales en producción; ChatGPT prepara y conduce la batería y puede realizar verificaciones técnicas previas.
8. **Documentación es implementación.** Todo cambio funcional/arquitectónico revisa las fuentes canónicas afectadas. No mantener especificaciones históricas paralelas.
9. **Memoria persistente.** Decisiones duraderas en código, tests, BBDD o documentación. Las issues se usan para trabajo activo, no como arquitectura permanente.
10. **Baseline antes de evolucionar.** Cerrar lo validado y dejar una baseline inequívoca antes de una nueva versión.
11. **Inicio de nueva conversación.** Seguir `AGENTS.md` y `docs/README.md`; mientras PRE-V4 esté activo leer además `PRE_V4_READINESS_PLAN.md`.
12. **Trazabilidad.** Una lección arquitectónica o regresión valiosa debe convertirse en test/contrato/documentación.
13. **Seguridad.** Nunca persistir tokens, credenciales o secretos en código, documentación, issues o logs.
14. **Merge sí; deployment Vercel no.** Un bloque preparado se integra por PR/CI y merge a `main`; los deployments de producción Vercel los realiza exclusivamente el usuario.
15. **Infraestructura por responsabilidad, no por nombre.** No clasificar Railway, tablas, módulos o workflows como legacy por sufijo/nombre.
16. **Neon destructivo con gate.** Auditar antes de borrar; UNKNOWN bloquea eliminación; usar migraciones revisables + smoke.
17. **Eficiencia.** Filtrar/agregar cerca de PostgreSQL, evitar transferencias/`SELECT *`/históricos/índices innecesarios y justificar coste sin sacrificar integridad o trazabilidad.
18. **Batch reutiliza operación canónica.** Individual y Batch deben ejecutar la misma receta funcional. Batch sólo añade selección, cola, leases, concurrencia, retry, rate limits, pausa/cancelación y métricas.
19. **Observabilidad única.** `process_runs` + eventos/errores son la frontera canónica. No crear otro `*_runs` sin demostrar necesidad.
20. **Documentación histórica fuera de `main`.** Si un documento deja de describir el presente, se consolida o elimina; Git conserva la historia.
21. **V4 empieza desde cero.** El cierre PRE-V4 debe dejar 0 issues abiertas heredadas y ninguna propuesta V4 predefinida. Las decisiones V4 se crearán de nuevo a partir del baseline auditado.

## Cierre de sesión significativa

Antes de cerrar trabajo significativo, comprobar que el estado durable está reflejado en GitHub/documentación y que la arquitectura canónica sigue describiendo el sistema real.
