# PikoFilm V4 — Fundación UX desde la baseline V3

Estado: **punto de partida de producto para V4**. No es un backlog ni una lista de issues heredadas.

## Propósito

P8 recorrió el frontal real desplegado de V3 y lo contrastó con el contrato de producto, Lifecycle, procesos canónicos y observabilidad. Este documento conserva únicamente las conclusiones útiles para iniciar el diseño de V4 desde cero, sin convertir propuestas antiguas en requisitos automáticos.

## Superficies observadas

- Inicio / Centro de control y explorador estadístico: ADN, Cobertura, PikoScore, Países, Sagas, Perfil y Balance.
- Catálogo: listado, búsqueda, filtros, ordenación, película y serie.
- Personas: listado y ficha/filmografía.
- Novedades: cola unificada y acceso a Excluidas.
- Calidad: portada, Identidad, Validación de identidad, Datos/PikoScore, Películas, Series y detalle, Personas, PikoQuality y Recuperación Lifecycle.
- Sagas: listado y detalle de colección.
- Operaciones: runs, Batch Engine, límites de fuentes, mantenimiento y errores.

## Lo que V4 debe conservar

1. **Identidad visual propia.** El tema oscuro, los acentos por estado, las tarjetas y la composición editorial ya hacen reconocible PikoFilm.
2. **Navegación por dominios.** Inicio, Catálogo, Personas, Novedades, Calidad, Sagas y Operaciones expresan bien las responsabilidades funcionales.
3. **Lifecycle visible.** El usuario entiende qué está completo, qué requiere acción y cuál es la siguiente acción sin tener que conocer la base de datos.
4. **Ficha maestra rica.** Las fichas de película/serie combinan identidad editorial, PikoScore, ratings, Plex, PikoQuality, saga, reparto y estado de forma útil.
5. **Calidad como centro de decisión.** Los procesos automáticos preparan evidencia; las decisiones humanas quedan explícitas.
6. **Batch subordinado al proceso canónico.** La interfaz debe seguir dejando claro que Batch repite operaciones individuales, no crea una segunda lógica funcional.
7. **Observabilidad visible.** Operaciones permite saber qué se ejecutó, dónde, cuánto tardó y si falló.
8. **Estados vacíos informativos.** Identidad, Validación y Recuperación Lifecycle muestran correctamente cuándo no existe trabajo pendiente.
9. **Consulta bajo demanda en superficies pesadas.** PikoQuality evita cargar miles de filas al entrar; este patrón debe extenderse donde aporte rendimiento y claridad.

## Fricciones observadas que V4 debe replantear

### Jerarquía global

La V3 contiene mucha información válida pero algunas pantallas compiten por atención. V4 debe priorizar una sola pregunta principal por pantalla: qué está pasando, qué merece atención o qué puedo hacer aquí. Métricas secundarias y detalle técnico deben quedar progresivamente revelables.

### Inicio

El dashboard es potente, pero combina salud, cobertura, estadísticas exploratorias, historia, Calidad y tamaño de base de datos en una sola superficie larga. V4 debería separar con más nitidez **estado actual**, **prioridades**, **evolución** y **exploración** sin perder el explorador estadístico.

### Catálogo

El listado funciona bien como centro de navegación. En V4 conviene reforzar filtros persistentes, vistas guardables y lectura rápida de estado sin sobrecargar cada tarjeta. La ficha debe seguir siendo la fuente maestra y no ejecutar procesos pesados durante render.

### Personas

El modelo listado → ficha es claro. V4 debería elevar búsqueda y descubrimiento de personas, mantener el refresco explícito y distinguir mejor datos biográficos, cobertura real en Plex y filmografía fuera de catálogo.

### Novedades

La cola única es correcta, pero mezcla discovery, Plex, sagas y altas manuales en una tabla muy operativa. V4 puede mantener una única cola y ofrecer vistas por intención/origen sin fragmentar la fuente de verdad. Excluir/restaurar debe seguir siendo reversible y claramente peligroso.

### Calidad

Es el dominio más complejo y donde más valor aporta una arquitectura de **resumen → cola → diagnóstico → decisión**. V4 debe homogeneizar esa secuencia entre Identidad, Datos, Películas, Series y Personas, con lenguaje consistente para `pendiente`, `incidencia`, `decisión`, `resuelto` y `completo`.

En Series, la cantidad de señales es alta. La portada y el detalle funcionan, pero V4 debería reducir ruido visual, mantener separadas las fuentes Plex/TMDb/España y mostrar primero la siguiente acción canónica.

### PikoQuality

La separación entre salud de biblioteca, distribución, prioridades y mantenimiento técnico es buena. V4 debe preservarla y evitar confundir PikoScore con PikoQuality.

### Sagas

El modelo de cobertura y `a una película` resulta muy entendible. V4 debería mantener esa lectura orientada a completitud y hacer más visible la diferencia entre película pendiente, no exigible y fuera de catálogo.

### Operaciones

Es la superficie con mayor margen de simplificación. Actualmente conviven observabilidad, control Batch, límites de APIs, mantenimiento destructivo y errores. V4 debería organizarla por capas:

- **Ahora:** ejecuciones activas y problemas accionables.
- **Historial:** runs y trazabilidad.
- **Batch:** control operacional y colas.
- **Fuentes:** cuotas, breakers y concurrencia con componentes de administración consistentes.
- **Mantenimiento:** acciones destructivas aisladas, confirmadas y visualmente separadas.

`Errores abiertos` debe distinguir claramente error histórico, error todavía vigente y error que requiere una acción. Un contador grande sin esa semántica puede transmitir una alarma falsa.

## Sistema visual V4

La evolución debe ser incremental, no un cambio arbitrario de identidad:

- conservar dark-first y contraste por estados;
- consolidar tokens de espaciado, tipografía, radios, bordes y badges;
- unificar botones, inputs, selects y controles de administración —especialmente en Operaciones—;
- reservar colores intensos para significado funcional, no decoración;
- reforzar jerarquía tipográfica y densidad adaptativa;
- usar disclosure progresivo para información técnica;
- asegurar estados loading/error/empty/success consistentes;
- diseñar responsive desde el sistema de componentes, no como parche por pantalla;
- mantener navegación y acciones accesibles por teclado, foco visible, labels y semántica apropiada.

## Principios de interacción para V4

1. El usuario nunca debe preguntarse cuál es la **siguiente acción** sobre una entidad.
2. Una acción destructiva debe estar separada de la navegación normal y pedir confirmación proporcional al daño.
3. Un proceso largo debe mostrar estado, progreso, executor y resultado sin bloquear la navegación.
4. Individual y Batch deben usar el mismo lenguaje funcional y diferenciarse sólo por alcance/orquestación.
5. Las pantallas de lectura no deben provocar llamadas externas pesadas implícitas.
6. Los errores deben clasificarse por **accionabilidad y vigencia**, no sólo por existencia histórica.
7. Los filtros deben ser rápidos, legibles, persistentes cuando ayudan al flujo y reflejarse en la URL cuando corresponda.
8. Las métricas deben responder a una decisión; una métrica que no cambia ninguna acción debe perder protagonismo.
9. La interfaz debe explicar el modelo de PikoFilm sin exponer innecesariamente detalles de infraestructura.
10. V4 parte de cero en decisiones e issues: estas conclusiones son contexto, no requisitos cerrados.

## Hallazgos de baseline separados de UX

P8 detectó dos hechos que no deben convertirse en decisiones de diseño:

- `/catalogo/excluidas` fallaba en producción por SQL inválido; se corrige como bloqueo de baseline antes de cerrar PRE-V4.
- La colección `El padrino` mostró un miembro con metadatos visuales/título ajenos a la saga. Es una señal de integridad de datos/asociación a investigar cuando se diseñe o ejecute la validación de datos de V4; la pantalla de Sagas no es por sí misma la causa demostrada.

## Regla de arranque V4

Al iniciar V4 se crea el backlog desde cero. Cada propuesta debe volver a justificarse contra esta baseline, el sistema vivo y el objetivo de producto. No se reabren automáticamente issues V3/PRE-V4 ni se considera este documento una especificación cerrada de implementación.
