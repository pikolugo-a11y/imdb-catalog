# PikoFilm — Reglas de oro permanentes

Este documento es obligatorio para cualquier sesión futura de trabajo sobre PikoFilm. Debe leerse antes de modificar el proyecto.

## Regla 0 — Propósito de PikoFilm

**PikoFilm es una base de datos audiovisual personal maestra.** Su objetivo es construir, mantener y explotar el universo editorial de películas, series y miniseries que el usuario considera relevantes, independientemente de que exista o no una copia física en Plex.

PikoFilm debe permitir:

- saber qué títulos forman parte del universo editorial y cuáles están excluidos;
- cruzar ese universo con Plex para saber qué existe físicamente, qué falta y qué está en proceso de conseguirse;
- mantener identidad y metadatos fiables y completos: títulos, año, país, géneros, sinopsis, reparto, sagas y demás información editorial útil;
- calcular **PikoScore** como valoración propia a partir de fuentes externas persistidas, con reglas y fórmula versionadas;
- calcular **PikoQuality** como valoración técnica de la copia física disponible, separada de la valoración artística/editorial;
- detectar y resolver problemas de identidad, datos incompletos, archivos incorrectos o técnicamente mejorables;
- en series, conocer la referencia oficial de temporadas/episodios, qué existe en Plex, qué falta realmente y cuándo una ausencia no debe considerarse todavía accionable por disponibilidad;
- consultar y explotar la BBDD mediante Catálogo, Personas, Sagas, búsqueda, filtros, estadísticas y demás vistas derivadas sin crear fuentes de verdad paralelas.

**Plex y PikoFilm tienen responsabilidades distintas:** Plex es la fuente de verdad física y el sistema de reproducción; PikoFilm gobierna la BBDD audiovisual, su selección editorial, enriquecimiento, calidad y coherencia.

**No objetivos permanentes:** PikoFilm no gestiona reproducciones, progreso, visto/no visto, historial de consumo ni hábitos de visionado, y no debe evolucionar hacia un sustituto de Plex para esas funciones.

Toda nueva funcionalidad, propuesta o cambio arquitectónico debe poder justificarse por este propósito. Si no mejora el gobierno, calidad, consulta o explotación de la BBDD audiovisual personal, debe considerarse fuera de alcance salvo decisión explícita del usuario.

## Reglas de oro

1. **Continuidad de ejecución.** Una vez que el usuario autoriza continuar, ejecutar de forma continuada todo lo posible sin pedir confirmación entre fases. Solo detenerse por finalización, una decisión que realmente requiera al usuario o un bloqueo técnico real.

2. **Arquitectura antes que parche.** No crear soluciones aisladas, duplicadas o "champiñones". Antes de corregir o ampliar una función, identificar su fuente de verdad, propietario del proceso, datos derivados e impacto en el resto de PikoFilm.

3. **Respetar las fuentes de verdad.** Plex gobierna presencia física; el catálogo gobierna selección editorial; `catalog_exclusions` gobierna exclusiones; las capas de referencia gobiernan sus derivados. No crear una segunda fuente canónica para arreglar un problema local.

4. **Comprender el flujo antes de modificarlo.** Revisar código, BBDD, procesos y documentación necesarios para colocar cada cambio en el punto correcto de la arquitectura.

5. **No probar código que no esté realmente desplegado.** Antes de atribuir un resultado funcional a un cambio, verificar que producción contiene el commit/deployment esperado.

6. **Validación funcional obligatoria después de CADA deploy.** Ningún despliegue se considera terminado ni ninguna corrección se considera cerrada hasta completar una batería funcional proporcional a los cambios desplegados. ChatGPT diseña y conduce la batería prueba a prueba; el usuario ejecuta siempre las pruebas funcionales/visuales en producción y comunica el resultado. ChatGPT registra cada resultado en la bitácora y abre/actualiza issues cuando corresponda. Las pruebas deben incluir el caso corregido y regresiones razonables sobre funciones relacionadas.

7. **No cerrar issues antes de validar.** Implementar, desplegar, probar funcionalmente y solo entonces cerrar la issue. Una mejora explícitamente no bloqueante puede mantenerse abierta aunque una versión se considere estable.

8. **Documentación funcional siempre actualizada.** Todo cambio funcional relevante debe reflejarse en `docs/FUNCTIONAL_SPECIFICATION_V2.md` (o su sucesor vigente) dentro del mismo ciclo de trabajo.

9. **Documentación técnica siempre actualizada.** Todo cambio técnico/arquitectónico relevante debe reflejarse en `docs/TECHNICAL_SPECIFICATION_V2.md` (o su sucesor vigente) dentro del mismo ciclo de trabajo.

10. **Bitácora obligatoria y continua.** `docs/PROJECT_STATUS.md` es la bitácora operativa y debe actualizarse después de cada hito relevante: implementación, merge, deploy, batería de pruebas, apertura/cierre de incidencias, bloqueo o cambio del siguiente paso. Debe indicar siempre qué se hizo, qué commit/deploy está vigente, qué se ha probado, qué queda pendiente y cuál es el siguiente paso exacto. No dejar el estado real únicamente en una conversación de ChatGPT.

11. **GitHub/Neon y documentación como memoria del proyecto.** Las decisiones duraderas deben quedar persistidas en código, BBDD, issues o documentación; no depender de memoria conversacional.

12. **Issues para trabajo relevante.** Las funcionalidades o incidencias de entidad suficiente deben quedar registradas con contexto y criterios de aceptación. Mantener las issues coherentes con el estado real.

13. **Baseline antes de evolucionar.** Cuando una versión alcance estabilidad, cerrar lo validado, actualizar documentos y bitácora y dejar una baseline inequívoca antes de iniciar la siguiente evolución.

14. **Reconstrucción de contexto al iniciar una conversación nueva.** Antes de proponer o ejecutar cambios: leer `docs/PROJECT_STATUS.md`, este documento, la especificación funcional, la especificación técnica, revisar issues abiertas y comprobar el estado reciente de `main`. La bitácora determina el punto operativo exacto desde el que continuar.

15. **Trazabilidad de decisiones y pruebas.** Cuando un bug produzca una lección arquitectónica o un buen caso de regresión, incorporarlo a documentación/pruebas para evitar que reaparezca.

16. **Seguridad y secretos.** Nunca persistir tokens, credenciales o secretos en código, documentación, issues o logs. Usar variables de entorno/secretos de plataforma.

17. **Merge siempre; deployment nunca por ChatGPT.** Todo bloque de trabajo terminado y técnicamente preparado debe integrarse mediante PR/CI y **merge a `main`**; no debe quedar abandonado en una rama de trabajo. Los deployments de producción en Vercel los realiza **siempre y exclusivamente el usuario**. ChatGPT no debe intentar desplegar ni sustituir ese paso. Tras cada merge debe comunicar de forma explícita el commit/HEAD de `main` preparado para deployment. Después de que el usuario confirme que ha hecho el deploy, ChatGPT debe verificar en Vercel que producción corresponde al commit esperado.

18. **Pruebas de aceptación ejecutadas siempre por el usuario.** ChatGPT no debe ejecutar por su cuenta acciones funcionales o visuales de aceptación sobre la aplicación en producción. Debe generar una batería ordenada, entregar las pruebas de una en una con pasos concretos y resultado esperado, recibir la respuesta del usuario, registrar cada resultado y decidir si procede continuar, diagnosticar o abrir/actualizar una issue. Las comprobaciones técnicas no funcionales necesarias para preparar o interpretar la prueba (commit desplegado, logs, BBDD, código, configuración) sí puede realizarlas ChatGPT.

## Regla de cierre de sesión

Antes de terminar una sesión significativa de PikoFilm, actualizar obligatoriamente `PROJECT_STATUS.md`. Si durante la sesión cambió funcionalidad o arquitectura, actualizar también los documentos funcional y técnico antes de considerar el trabajo entregado.
