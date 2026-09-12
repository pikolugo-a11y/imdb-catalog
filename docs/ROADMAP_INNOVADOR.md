# PikoFilm — Road Map Innovador

Estado: **BANCO DE APUESTAS FUTURAS — EN DEFINICIÓN**  
Objetivo: conservar únicamente innovaciones futuras que hayan sido revisadas y aprobadas expresamente por el usuario. No compromete V5.

## Método obligatorio

Después de completar la auditoría y las propuestas V5 de **cada uno de los 20 bloques**, se presentarán **como mínimo 5 innovaciones rompedoras y atrevidas** inspiradas por ese bloque.

Las innovaciones se revisarán **una a una**.

Para cada propuesta:

1. Se presenta una única innovación, con objetivo, valor potencial, riesgos y horizonte posible.
2. El usuario decide **APROBAR** o **RECHAZAR**.
3. Sólo las innovaciones aprobadas se incorporan a este Road Map Innovador.
4. Las rechazadas no se conservarán como backlog implícito.
5. No se pasa a la siguiente innovación hasta registrar la decisión de la actual cuando corresponda.
6. La aprobación para este documento no implica que la innovación entre en V5, V6 ni ninguna versión concreta.
7. Para entrar en una versión futura deberá existir una decisión posterior explícita y una evaluación de viabilidad, coste, seguridad e impacto.

## Frontera de producto obligatoria

PikoFilm gestiona **la base de datos, el catálogo, su calidad, sus procesos, integraciones y operaciones**, pero **no gestiona el historial personal de visionado ni los gustos del usuario**.

En concreto:

- PikoFilm no debe intentar sustituir a Plex como fuente y gestor de qué películas o episodios ha visto el usuario.
- PikoFilm no debe construir perfiles de gustos, recomendaciones personales o modelos de afinidad basados en lo visto o valorado.
- Si una función futura necesita saber si algo está visto, esa información pertenece a Plex y sólo puede utilizarse como dato externo cuando sea estrictamente necesario para una función de gestión del catálogo.
- Las futuras propuestas del Road Map Innovador deben respetar esta frontera desde su planteamiento inicial.

## Innovaciones aprobadas

### INNO-01 — PikoFilm Autopilot

**Estado:** APROBADA  
**Fecha:** 2026-09-13

Convertir la capa de Operaciones/Calendario en un sistema capaz de planificar, replanificar y recuperar automáticamente el trabajo del catálogo dentro de límites explícitos.

El sistema tendría en cuenta backlog, trabajo futuro, prioridad, carga de workers, estado de Plex y APIs, ventanas horarias, coste y tiempos históricos para decidir qué ejecutar, cuándo, cuánto paralelizar, qué aplazar y cuándo recuperarse de una degradación.

Ejemplos de comportamiento futuro:

- repartir automáticamente grandes picos de actualizaciones entre días con capacidad libre;
- adelantar trabajo cuando los workers estén ociosos;
- reducir concurrencia si Plex o una fuente externa se degrada;
- pausar una familia de procesos ante un patrón anómalo de fallos;
- preparar más capacidad cuando el usuario decida concentrar carga en un día;
- proponer un nuevo plan antes de aplicar cambios de gran impacto.

La autonomía siempre estará limitada por guardrails: presupuesto máximo, concurrencia máxima, procesos no reprogramables sin permiso y confirmación para acciones de alto impacto o irreversibles.

**Visión:** evolucionar Actividad + Calendario + Operaciones hacia un auténtico sistema operativo del catálogo.

**Horizonte orientativo:** V6/V7 o experimento posterior, sujeto a una decisión futura específica.
