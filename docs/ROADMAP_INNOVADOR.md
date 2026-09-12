# PikoFilm — Road Map Innovador

Estado: **BANCO DE APUESTAS FUTURAS — NO COMPROMETE V5**  
Objetivo: conservar ideas deliberadamente ambiciosas que puedan inspirar V6+ o experimentos independientes sin contaminar el alcance de V5.

## Principio

Este documento no es backlog comprometido ni especificación. Cada apuesta deberá pasar, cuando corresponda, por auditoría de viabilidad, coste, seguridad, impacto en producto y retorno real antes de entrar en una versión.

## INNO-01 — PikoFilm Autopilot

Convertir la capa de operaciones en un sistema capaz de **planificar, replanificar y recuperar automáticamente** el trabajo del catálogo dentro de límites explícitos.

La idea no sería sólo ejecutar cron jobs: el sistema observaría cola, coste, fallos, disponibilidad de APIs, ventanas horarias, urgencia y carga de workers y decidiría qué ejecutar, aplazar, reagrupar o reintentar.

Ejemplos futuros:
- repartir 1.000 actualizaciones durante varios días sin picos;
- acelerar procesos urgentes cuando el sistema esté ocioso;
- reducir concurrencia si Plex o una API externa se degrada;
- suspender automáticamente familias de trabajo si detecta una anomalía repetitiva;
- proponer al usuario un nuevo plan antes de aplicar cambios de gran impacto.

Condición: siempre con guardrails, límites de coste y acciones irreversibles fuera del modo autónomo.

## INNO-02 — Gemelo digital de PikoFilm

Crear un **digital twin** del sistema capaz de simular horas o días de actividad antes de aplicar un cambio real.

Podría reproducir una copia lógica de catálogo, procesos, colas y reglas con datos anonimizados/sintéticos para responder preguntas como:
- qué ocurriría si duplicamos la concurrencia;
- qué carga generaría una nueva regla de actualización;
- cuántos procesos quedarían pendientes tras una caída de Plex;
- cómo afectaría una migración a tiempos y costes;
- qué resultados produciría una nueva heurística de Series antes de activarla.

La meta sería convertir cambios de arquitectura y automatización en experimentos medibles en vez de pruebas directamente sobre producción.

## INNO-03 — Shadow Mode universal

Todo algoritmo nuevo importante podría ejecutarse primero en **modo sombra**: recibe los mismos inputs que producción, pero no modifica datos canónicos.

El sistema compararía automáticamente resultado actual vs resultado candidato y mostraría:
- diferencias funcionales;
- regresiones;
- mejoras reales;
- coste adicional;
- casos ambiguos que requieren revisión humana.

Esto permitiría evolucionar reglas de matching, diagnóstico, enriquecimiento o planificación con una seguridad mucho mayor y podría convertirse en el mecanismo estándar de promoción de nuevas lógicas.

## INNO-04 — Grafo temporal de procedencia y confianza

Transformar la trazabilidad de datos en un **grafo de procedencia**: cada dato importante sabría de dónde vino, cuándo cambió, qué proceso lo modificó, con qué fuente y con qué nivel de confianza.

En lugar de ver sólo el valor actual, PikoFilm podría contestar:
- por qué creemos que esta temporada tiene 22 episodios;
- qué fuente originó un año, título o duración;
- qué decisión manual prevaleció sobre una automática;
- qué procesos posteriores dependieron de ese dato;
- cuál era el estado conocido en una fecha pasada.

Sería una base muy potente para calidad, auditoría, explicabilidad y recuperación.

## INNO-05 — Time Machine de catálogo

Añadir una capacidad de **viaje temporal operativo**: reconstruir el estado lógico de una película, serie, proceso o conjunto de datos en cualquier momento relevante.

No se trataría de restaurar una copia completa de la base, sino de poder responder y comparar:
- cómo estaba este título hace 30 días;
- qué cambió después de una sincronización concreta;
- qué versión de reglas produjo un determinado resultado;
- qué habría que revertir para volver al último estado válido.

Combinada con INNO-04, permitiría auditoría y rollback de alto nivel sin depender de investigar logs dispersos.

## INNO-06 — Control Center conversacional

Crear una interfaz donde el usuario pueda hablar con PikoFilm como con un operador técnico del sistema:

> “¿Por qué falta el episodio S07E19?”  
> “Enséñame qué va a ejecutarse mañana y reduce los picos.”  
> “¿Qué ha cambiado hoy en Plex?”  
> “Simula qué pasaría si refresco toda la biblioteca ahora.”

El sistema traduciría lenguaje natural a consultas, diagnósticos y planes de acción verificables. Las acciones de escritura seguirían requiriendo permisos, previsualización y confirmación según riesgo.

La apuesta es convertir Observabilidad + Actividad + Operaciones en una única capa de interacción inteligente.

## INNO-07 — Motor predictivo de degradación

Pasar de reaccionar a errores a **predecirlos antes de que sean visibles**.

A partir de señales como latencia, frecuencia de cambios, reintentos, volumen de misses, comportamiento de APIs, backlog o desviaciones de tiempos normales, PikoFilm podría detectar:
- fuentes externas que empiezan a degradarse;
- procesos con riesgo creciente de timeout;
- catálogos que probablemente quedarán desactualizados;
- trabajadores subdimensionados;
- anomalías que todavía no han generado un error duro.

El resultado sería una Operaciones más preventiva que reactiva.

## INNO-08 — Broker virtual de fuentes

Crear una capa que trate las fuentes externas como proveedores intercambiables y evaluables dinámicamente.

Para cada tipo de dato, PikoFilm podría ponderar automáticamente:
- calidad histórica;
- frescura;
- coste;
- latencia;
- disponibilidad;
- nivel de confianza por dominio.

Así, en vez de una jerarquía rígida, el sistema podría elegir la mejor fuente disponible para cada dato y degradar con elegancia si una API falla. Añadir una nueva fuente sería registrar capacidades y reglas, no repartir integraciones por toda la aplicación.

## INNO-09 — Arquitectura de decisiones explicables

Cada decisión automática relevante podría producir un **expediente de decisión** compacto y legible: inputs considerados, reglas aplicadas, alternativas descartadas, confianza y efecto final.

Esto permitiría que procesos complejos como matching, reconciliación o selección de fuente no fueran una caja negra y facilitaría muchísimo revisar falsos positivos y evolucionar reglas.

No implica guardar logs infinitos: se almacenarían sólo decisiones significativas y resumidas, con retención y compresión por diseño.

## INNO-10 — Sistema que aprende de correcciones humanas

Las correcciones manuales del usuario podrían convertirse en señales estructuradas para mejorar futuras decisiones sin perder control determinista.

Ejemplo: si varias correcciones muestran que cierto patrón de títulos o temporadas suele resolverse de una forma concreta, el sistema podría proponer una nueva regla o candidato de matching y probarlo en Shadow Mode antes de activarlo.

La innovación no sería permitir que una IA cambie reglas sola, sino cerrar un ciclo seguro:

**corrección humana → patrón detectado → propuesta → simulación → validación → regla nueva**.

## Horizontes sugeridos

- **Horizonte A — experimentable pronto:** INNO-03 Shadow Mode, INNO-06 Control Center conversacional, INNO-09 decisiones explicables.
- **Horizonte B — requiere cimientos V5 sólidos:** INNO-01 Autopilot, INNO-04 grafo de procedencia, INNO-05 Time Machine, INNO-08 broker virtual de fuentes.
- **Horizonte C — apuesta avanzada:** INNO-02 gemelo digital, INNO-07 predicción de degradación, INNO-10 aprendizaje de correcciones humanas.

## Regla de promoción

Una idea de este documento sólo pasa al roadmap de una versión concreta mediante una decisión explícita posterior. Hasta entonces debe permanecer como apuesta futura y no generar alcance implícito en V5.
