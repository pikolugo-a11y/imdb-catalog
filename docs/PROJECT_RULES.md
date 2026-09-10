# PikoFilm — Reglas de oro permanentes

Documento obligatorio para cualquier sesión futura. Leer después de `AGENTS.md` y antes de modificar el proyecto.

## Propósito

PikoFilm es una **base de datos audiovisual personal maestra**. Gobierna selección editorial, identidad, metadatos, PikoScore, relación con Plex, calidad física/técnica, Series, Personas, Sagas, Novedades, Actividad y explotación del catálogo. Plex es la fuente de verdad física y de reproducción.

## Fuentes canónicas actuales

La descripción global del sistema está consolidada en:

- `docs/V4_FUNCTIONAL_SPEC.md`;
- `docs/V4_ARCHITECTURE.md`;
- `docs/V4_UX_SPEC.md`.

`docs/processes/PROCESS_CATALOG.md`, `docs/processes/BATCH_ARCHITECTURE.md` y `docs/operations/RUNBOOK.md` son anexos técnicos especializados.

## Reglas de oro

1. **Continuidad.** Una vez autorizado continuar, ejecutar todo lo posible sin pedir confirmación entre fases; parar sólo por finalización, decisión real o bloqueo técnico.
2. **Arquitectura antes que parche.** Identificar fuente de verdad, propietario, derivados e impacto antes de corregir/ampliar.
3. **Una fuente canónica por responsabilidad.** No crear modelos paralelos para resolver problemas locales.
4. **Comprender antes de modificar.** Revisar código, BBDD, procesos, infraestructura y documentación afectados.
5. **Sistema vivo manda.** Si documentación y producción discrepan, verificar la implementación viva y corregir la documentación en el mismo bloque.
6. **No probar código no desplegado.** Confirmar commit/deployment antes de atribuir resultados funcionales.
7. **Aceptación funcional tras deploy.** El usuario ejecuta las pruebas funcionales/visuales en producción; ChatGPT prepara y conduce la batería y puede realizar verificaciones técnicas previas.
8. **Documentación es implementación.** Todo cambio funcional/arquitectónico/UX revisa las fuentes canónicas afectadas. No mantener especificaciones históricas paralelas.
9. **Memoria persistente.** Decisiones duraderas en código, tests, BBDD o documentación. Las issues se usan para trabajo activo, no como arquitectura permanente.
10. **Baseline antes de evolucionar.** Cerrar lo validado y dejar una baseline inequívoca antes de una nueva versión.
11. **Inicio de nueva conversación.** Seguir `AGENTS.md`, `docs/README.md` y la tríada V4; después leer los anexos del proceso/Batch/operación afectados.
12. **Trazabilidad.** Una lección arquitectónica o regresión valiosa debe convertirse en test/contrato/documentación.
13. **Seguridad.** Nunca persistir tokens, credenciales o secretos en código, documentación, issues o logs.
14. **Merge sí; deployment Vercel no.** Un bloque preparado se integra por PR/CI y merge a `main`; los deployments de producción Vercel los realiza exclusivamente el usuario.
15. **Infraestructura por responsabilidad, no por nombre.** No clasificar Railway, tablas, módulos o workflows como legacy por sufijo/nombre.
16. **Neon destructivo con gate.** Auditar antes de borrar; UNKNOWN bloquea eliminación; usar migraciones revisables + smoke.
17. **Eficiencia.** Filtrar/agregar cerca de PostgreSQL, evitar transferencias/`SELECT *`/históricos/índices innecesarios y justificar coste sin sacrificar integridad o trazabilidad.
18. **Batch reutiliza operación canónica.** Individual y Batch deben ejecutar la misma receta funcional. Batch sólo añade selección, cola, leases, concurrencia, retry, rate limits, pausa/cancelación y métricas.
19. **Observabilidad única.** `process_runs` + eventos/errores son la frontera canónica. No crear otro `*_runs` sin demostrar necesidad.
20. **Documentación histórica fuera de `main`.** Si un documento deja de describir el presente, se consolida o elimina; Git conserva la historia.
21. **V4 es la baseline actual.** El sistema posterior al PR #511 es el punto de partida. No reabrir PRE-V4 o contratos intermedios como si fueran backlog vigente.
22. **Gate de persistencia de decisiones.** Toda decisión funcional o UX que el usuario apruebe debe escribirse **inmediatamente en la documentación canónica de Git antes de presentar la siguiente decisión**. Una decisión no se considera cerrada sólo porque conste en el chat.
23. **Plex global sigue siendo manual.** No añadir polling o cron de sync Plex sin una decisión explícita que cambie el producto.
24. **Trabajo automático no es atención humana.** Calidad separa `Requiere atención`, `Seguimiento automático` y `Al día`.
25. **Actividad y Operaciones son hermanas.** Actividad explica qué ocurrió; Operaciones cómo ocurrió. Comparten observabilidad y 30 días de detalle.
26. **Gobierno API fail-closed.** TMDb, OMDb y MDBList no se consultan desde procesos canónicos sin el gate de gobernanza.
27. **Recuperación contextual.** No existe un reset global genérico. Reinicios, retries y cancelaciones dependen del estado y deben ser observables.
28. **No borrar errores para resolverlos.** Una incidencia puede resolverse/descartarse sin eliminar el hecho histórico.
29. **Read model no es verdad funcional.** Si una vista/aggregate deriva de datos canónicos, las decisiones se escriben en el modelo propietario, no en el read model.
30. **No semántica de consumo.** `Sin Plex`, temporadas incompletas o sagas parciales describen presencia física; no implican “pendiente de ver”.

## Cierre de sesión significativa

Antes de cerrar trabajo significativo:

- comprobar que el estado durable está reflejado en GitHub/documentación;
- comprobar que la tríada canónica sigue describiendo el sistema real;
- comprobar `PROCESS_CATALOG.md` si cambió algún PROC;
- comprobar Batch/runbook si cambió ejecución u operación;
- comprobar CI/contratos;
- indicar al usuario el commit/PR/merge y, cuando corresponda, que el deploy Vercel de producción es su paso.
