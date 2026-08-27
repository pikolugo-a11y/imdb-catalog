# PikoFilm — PATRÓN UX del frontal

> Guía viva y operativa para **auditar, diseñar y corregir pantallas** de PikoFilm.
>
> Referencia inicial: **Catálogo** (`/catalogo`). El patrón incorpora después decisiones transversales aprobadas durante las revisiones de Calidad y navegación.
>
> **Uso recomendado:** antes de tocar una pantalla, leer primero la checklist de la sección 1. El resto del documento explica el criterio y las excepciones.

---

## 1. Checklist rápida de auditoría

Una pantalla no se considera UX terminada hasta revisar, cuando aplique, estos puntos:

### A. Propósito y jerarquía
- [ ] ¿Se entiende en pocos segundos **para qué sirve** la pantalla?
- [ ] ¿Lo primero visible responde al estado, problema o decisión principal?
- [ ] ¿La jerarquía sigue, cuando aplique, **estado/contexto → problema → evidencia/contenido → acción → navegación**?
- [ ] ¿Se ha eliminado información repetida, decorativa o que no ayuda a decidir/actuar?
- [ ] ¿El contenido/objeto principal ocupa más espacio que los controles secundarios?

### B. Resumen y métricas
- [ ] Si representa un conjunto, ¿hay un resumen pequeño y útil antes del detalle?
- [ ] ¿Cada KPI responde a una pregunta operativa real?
- [ ] ¿Los contadores usan la **misma fuente de verdad** que la pantalla o proceso que resumen?
- [ ] ¿Se evita repetir el mismo estado en varios bloques con distinta redacción?

### C. Estados e incidencias
- [ ] ¿Correcto, pendiente, procesando, advertencia, error y desconocido son reconocibles de un vistazo?
- [ ] ¿Color + icono + texto mantienen una semántica estable? El color nunca es el único indicador.
- [ ] ¿Ningún estado anómalo queda invisible? Debe existir filtro, cola, señal o acceso para localizarlo.
- [ ] ¿Cuando todo está correcto se reduce el ruido técnico y, cuando hay un problema, éste gana protagonismo?

### D. Búsqueda y filtros
- [ ] ¿La búsqueda frecuente está visible y los filtros avanzados disponibles sin dominar la pantalla?
- [ ] ¿Los filtros responden también a **tareas reales** (pendiente, requiere atención, error, correcto...) y no sólo a atributos técnicos?
- [ ] ¿Los filtros muestran cantidades cuando aportan contexto?
- [ ] En títulos audiovisuales: ¿busca independientemente por **título localizado, principal, original e IMDb ID**?
- [ ] ¿La búsqueda es parcial, no sensible a mayúsculas/minúsculas y el placeholder promete sólo capacidades reales?
- [ ] ¿Existe una forma clara de limpiar/restablecer filtros?

### E. Colecciones y maestro-detalle
- [ ] ¿La unidad visible es la adecuada para la decisión del usuario, evitando detalle técnico innecesario?
- [ ] ¿Listado/colección permite detectar rápidamente qué requiere atención?
- [ ] ¿El detalle explica el motivo y permite actuar sin perder el contexto de procedencia?
- [ ] ¿Se conservan búsqueda, filtros, orden, vista y página al entrar/salir del detalle?
- [ ] ¿Grid/tabla u otras vistas alternativas existen sólo cuando resuelven necesidades distintas sobre el mismo conjunto?

### F. Acciones
- [ ] ¿Las acciones aparecen junto al elemento/contexto sobre el que actúan?
- [ ] ¿Las acciones principales son evidentes y las secundarias no compiten visualmente?
- [ ] ¿El peso visual refleja riesgo: consulta < reversible < cambio de estado < destructiva?
- [ ] ¿Toda acción deja feedback: ejecutando, completado/error y resultado?
- [ ] ¿Las acciones molestas son reversibles cuando sea razonable?
- [ ] Si una acción de dominio aparece en varias pantallas, ¿todas usan **la misma operación canónica y significado**?

### G. Navegación
- [ ] ¿Toda sección funcional accesible está representada en la navegación que le corresponde?
- [ ] ¿Escritorio y móvil derivan de la misma definición/arquitectura de navegación?
- [ ] ¿La ubicación actual es evidente y el regreso conserva contexto?
- [ ] ¿Se evita obligar a hacer scroll sólo para alcanzar navegación o acciones principales que deberían estar visibles?

### H. Densidad y lenguaje visual
- [ ] ¿Hay mucha información útil sin sensación de formulario administrativo?
- [ ] ¿Datos secundarios son discretos y anomalías/decisiones tienen mayor peso visual?
- [ ] ¿Tipografía, espaciado, superficies y estados son coherentes con PikoFilm?
- [ ] ¿Se aprovecha el espacio sin introducir ruido ni aire innecesario?

### I. Rendimiento
- [ ] ¿La ruta frecuente se siente ágil?
- [ ] ¿Las colecciones grandes paginan/filtran en servidor cuando corresponde?
- [ ] ¿Se cargan sólo datos necesarios para la vista actual?
- [ ] ¿Se evitan N+1, colecciones completas, consultas redundantes y llamadas externas durante listados?
- [ ] ¿La pantalla evita cargar miles de filas si por defecto no son necesarias?
- [ ] ¿Una mejora visual/funcional evita degradar perceptiblemente rendimiento real o percibido?

### J. Responsive/móvil
- [ ] ¿Móvil reorganiza prioridades y controles en vez de encoger escritorio?
- [ ] ¿Ninguna acción o información esencial desaparece?
- [ ] ¿Se evita scroll horizontal innecesario?
- [ ] ¿Filtros, popovers y paneles se transforman en superficies táctiles adecuadas?
- [ ] ¿También en móvil se conserva contexto y fluidez?

---

## 2. Principios maestros aprobados

### 2.1. Jerarquía antes que minimalismo

PikoFilm puede y debe mostrar bastante información cuando sea útil. La complejidad se resuelve con **jerarquía**, no ocultando información necesaria.

Secuencia de referencia, adaptable al objetivo de cada pantalla:

**Estado/contexto → problema o resumen → herramientas/filtros → contenido/evidencia → acciones → navegación.**

No es obligatorio usar todos los niveles ni exactamente en ese orden si el propósito exige otra cosa. Sí es obligatorio evitar mezclar sin jerarquía métricas, filtros, contenido, procesos y acciones.

### 2.2. El contenido y la decisión son protagonistas

La mayor superficie debe dedicarse al objeto que el usuario necesita entender o gestionar. Controles, procesos técnicos y metadatos secundarios se comprimen o pliegan cuando no requieren atención.

En pantallas operativas, cuando todo está correcto, el estado técnico debe ocupar poco espacio. Si aparece un error, pendiente o proceso activo, puede ganar protagonismo automáticamente.

### 2.3. KPI operativos, no decorativos

Los KPI deben responder preguntas reales: cuánto hay, cuánto falta, qué requiere atención, cuál es el estado de cobertura, etc.

Un resumen debe consumir la **fuente canónica** del módulo que representa. No se deben reconstruir cifras mediante reglas paralelas que puedan divergir de la pantalla secundaria.

### 2.4. Estados con semántica consistente

Correcto, pendiente, procesando, advertencia, error, desconocido y estados equivalentes deben utilizar un lenguaje visual reconocible en toda la aplicación.

- verde: positivo/correcto;
- amarillo: atención/ausencia;
- azul: proceso;
- rojo apagado: error/destructivo;
- naranja: interacción/selección principal cuando corresponda.

Los colores concretos pueden evolucionar; **la semántica no debe cambiar arbitrariamente entre pantallas**. Color e icono complementan al texto y no lo sustituyen cuando pueda existir ambigüedad.

### 2.5. Densidad informativa controlada

PikoFilm favorece interfaces compactas y de alta densidad útil. Datos secundarios pueden ser discretos; anomalías, decisiones y acciones importantes deben destacar. Se debe evitar tanto el ruido como el espacio desperdiciado.

### 2.6. Filtros orientados a tareas

Lo frecuente debe estar visible; lo avanzado, accesible a un clic. Los filtros no deben limitarse a atributos técnicos: cuando exista un flujo operativo deben incluir conceptos como **requiere atención, pendiente, error, correcto, prioridad**, etc.

Cuando una métrica o categoría ya representa un subconjunto útil, debe considerarse convertirla en acceso/filtro directo en vez de obligar al usuario a reconstruir ese criterio manualmente.

### 2.7. Acciones contextuales, consistentes y reversibles

Las acciones rápidas y seguras deben estar junto al elemento al que afectan. El detalle se reserva para análisis o acciones más completas.

Toda acción debe comunicar qué está ocurriendo y el resultado. Siempre que sea razonable, cambios molestos deben ofrecer Deshacer/restauración.

Una acción de dominio con el mismo nombre y significado debe invocar **una única operación canónica** en toda PikoFilm.

### 2.8. Navegación con conservación de contexto

Entrar en un detalle no debe hacer perder el punto de partida. Búsqueda, filtros, orden, vista y página deben conservarse mediante estado navegable/query parameters cuando corresponda.

Toda sección funcional accesible debe aparecer en la navegación apropiada. Escritorio y móvil deben partir de la misma definición para evitar divergencias como páginas existentes que desaparecen del menú.

### 2.9. Maestro-detalle consistente

En colecciones, la vista maestra debe permitir localizar rápidamente elementos relevantes o problemáticos. El detalle debe explicar el motivo, aportar evidencia y permitir resolverlo, conservando contexto suficiente para regresar.

La **unidad visible debe responder a la decisión del usuario**, no necesariamente a la granularidad técnica del almacenamiento. Si el sistema procesa capítulos pero la decisión es por temporada, la interfaz debe poder resumir por temporada.

### 2.10. Responsive real

Responsive significa **reorganizar prioridades, controles y acciones**, no reducir tamaños. Ninguna información o acción operativa esencial puede desaparecer en móvil.

### 2.11. Rendimiento como requisito UX

La velocidad real y percibida es criterio de aceptación. Una evolución visual o funcional no se considera correcta si empeora perceptiblemente la navegación.

En colecciones grandes:

- paginación/filtrado en servidor cuando corresponda;
- sólo datos necesarios de la vista actual;
- evitar N+1 y llamadas externas en render de listados;
- evitar cargar colecciones completas por defecto;
- minimizar payload, consultas redundantes y trabajo de renderizado;
- medir antes de introducir índices, cachés, vistas materializadas o duplicación de datos.

### 2.12. Feedback de procesos

Todo proceso manual o automático visible debe dejar traza comprensible: **qué fase ejecuta, progreso, completado/error y resultado**. No debe existir una barra al 100 % que deje al usuario sin saber si terminó o qué hizo.

La profundidad técnica visible debe adaptarse al contexto: en una pantalla de mantenimiento puede ser extensa; en una portada funcional debe resumirse y poder desplegarse.

---

## 3. Contratos transversales

### 3.1. Buscadores audiovisuales

Todo buscador de películas, series o títulos audiovisuales debe consultar independientemente:

- título español/localizado;
- título principal;
- título original;
- IMDb ID.

No usar `COALESCE` para reducir esos campos a un único valor buscable. La búsqueda textual será parcial y no sensible a mayúsculas/minúsculas. Un `tt...` debe poder localizar directamente el IMDb ID.

### 3.2. Excluir

- **Excluir no significa borrar.**
- Misma operación canónica desde cualquier pantalla.
- Saca el elemento del catálogo operativo y de las colas/flujos correspondientes según Lifecycle.
- Conserva datos, identificadores, histórico, auditoría y referencias.
- No borra ni modifica el archivo físico de Plex.
- Comportamiento coherente para películas y series.
- Feedback claro y, cuando sea razonable, **Deshacer** o restauración equivalente.

### 3.3. Navegación principal

Una sección funcional que forma parte del producto no puede depender de conocer su URL para ser encontrada. Las entradas de escritorio y móvil deben generarse desde una fuente común o mantenerse mediante un mecanismo que garantice paridad.

### 3.4. Contadores/resúmenes

Una portada o tarjeta que resume otro módulo debe reutilizar su fuente de verdad o helper canónico. El número de la portada y el de la secundaria deben representar **el mismo universo y la misma definición**. Si miden conceptos distintos, deben etiquetarse explícitamente como tales.

---

## 4. Patrones por tipo de pantalla

### 4.1. Colección / catálogo

Normalmente considerar:

**búsqueda → filtros → resumen → orden/vista → colección → acciones → paginación.**

Debe existir contador de resultados, acceso claro al detalle, estados visibles y acciones rápidas sólo cuando aporten valor.

Grid y tabla pueden convivir si resuelven necesidades visuales y analíticas distintas sobre el mismo conjunto y conservan el mismo contexto.

### 4.2. Cola / calidad / incidencias

Normalmente considerar:

**estado global → subconjuntos que requieren atención → filtros operativos → resultados → resolución/acción → mantenimiento técnico.**

No ocultar incidencias. Cuando no haya pendientes, no es necesario cargar una tabla vacía ni miles de elementos; sí debe existir una forma explícita de consultar históricos/correctos si aporta valor.

### 4.3. Ficha / detalle

Debe dejar claro:

- qué entidad se está viendo;
- por qué se llegó allí o qué estado tiene;
- evidencia/datos relevantes;
- acciones disponibles y su riesgo;
- retorno al contexto anterior.

Evitar repetir información técnica que ya esté sintetizada en una métrica más útil, salvo que el detalle tenga propósito diagnóstico.

### 4.4. Administración / procesos

Puede mostrar más detalle técnico que el resto del producto, pero debe conservar jerarquía y trazabilidad. Fases, progreso, resultado y errores deben ser comprensibles. Si el proceso está al día, el bloque puede permanecer plegado.

---

## 5. Lenguaje visual de referencia

### Superficies
- fondo oscuro;
- paneles diferenciados de forma sutil;
- bordes finos/discretos;
- radios moderados;
- sombras contenidas cuando aporten profundidad.

### Tipografía y densidad
- números importantes grandes y legibles;
- etiquetas secundarias pequeñas;
- metadatos compactos;
- títulos claramente diferenciados;
- poco espacio desperdiciado entre bloques relacionados.

### Interacción
- hover discreto;
- selección claramente visible;
- botones compactos;
- destructivas diferenciadas de primarias;
- controles avanzados mediante popovers/paneles cuando convenga.

El objetivo es mantener un **lenguaje común**, no copiar píxeles ni colores exactos entre pantallas.

---

## 6. Antipatrones que debemos detectar

- Portadas que reconstruyen contadores distintos a los de sus secundarias.
- KPI que repiten información sin añadir decisión o contexto.
- Procesos/batches dominando una pantalla cuyo objetivo principal es consultar resultados.
- Tres o más filas de navegación/tarjetas cuando la información principal podría estar visible sin scroll.
- Cargar miles de filas para mostrar inicialmente “no hay pendientes”.
- Ocultar elementos problemáticos porque no encajan en el flujo feliz.
- Acciones globales alejadas del objeto sobre el que actúan.
- Misma acción con implementaciones o consecuencias diferentes según pantalla.
- Color como único indicador de estado.
- Responsive entendido como simple reducción.
- Buscadores que sólo consultan un alias/título aunque prometan más.
- Pérdida de filtros/página al volver de una ficha.
- Barras al 100 % sin resultado o estado final comprensible.
- Páginas funcionales existentes pero ausentes de la navegación.
- Duplicar información técnica que ya está sintetizada en una métrica útil.

---

## 7. Qué NO debemos copiar mecánicamente

Catálogo es referencia, no plantilla rígida. No todas las pantallas necesitan cuatro KPI, filtros, grid, tabla, los mismos colores o idéntica densidad.

Una portada, una cola de Calidad, una ficha, un catálogo y una pantalla administrativa tienen objetivos diferentes. Reutilizamos **jerarquía, claridad, consistencia, densidad útil, rendimiento y comportamiento**, no una composición fija.

---

## 8. Decisiones explícitas consolidadas

### 2026-08-25 — Catálogo como referencia inicial
Catálogo establece el lenguaje inicial del patrón: alta densidad útil, contenido protagonista, filtros compactos, KPI operativos, estados visuales, acciones contextuales, conservación de contexto y responsive real.

### 2026-08-25 — Búsqueda audiovisual transversal
Los buscadores de títulos deben localizar por título localizado, principal, original e IMDb ID de forma independiente.

### 2026-08-25 — Rendimiento y paginación
La velocidad es primordial. Rendimiento real y percibido son criterio UX; las colecciones deben paginar/filtrar de forma eficiente cuando corresponda.

### 2026-08-25 — Consistencia de acciones globales
Acciones como Excluir deben tener una única implementación/semántica canónica en toda la aplicación.

### 2026-08-25 — Navegación móvil
Toda evolución debe diseñarse y validarse también en móvil sin perder información ni acciones esenciales.

### 2026-08-27 — Revisión de Calidad y navegación
Se consolidan como reglas transversales:

1. jerarquía progresiva de información;
2. acciones asociadas a su contexto;
3. estados con semántica visual consistente y no dependiente sólo del color;
4. densidad informativa controlada;
5. filtros orientados a tareas reales;
6. feedback obligatorio para acciones y procesos;
7. navegación como fuente coherente de descubrimiento, con paridad escritorio/móvil;
8. patrón maestro-detalle consistente.

La revisión de Calidad añade además dos aprendizajes operativos: los resúmenes deben reutilizar la **fuente canónica** de cada secundaria y los procesos técnicos deben ceder protagonismo a estado/resultados cuando la pantalla tenga una finalidad funcional distinta del mantenimiento.

---

## 9. Cómo evoluciona este documento

Este archivo es deliberadamente vivo. Cada auditoría puede proponer nuevos patrones, antipatrones, excepciones o componentes estandarizables.

**Regla de gobierno:** una observación encontrada en una pantalla no se convierte automáticamente en patrón global. Debe ser reutilizable y quedar aprobada expresamente antes de incorporarse como norma transversal.

Antes de rediseñar una pantalla existente o crear una nueva, esta guía debe utilizarse como referencia. Durante la auditoría, la **sección 1** funciona como checklist rápida; el resto sirve para resolver el porqué y las excepciones.