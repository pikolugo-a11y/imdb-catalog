# PikoFilm — Guía viva de UX/UI del frontal

> Documento de referencia para la evolución del frontal de PikoFilm.
> 
> **Referencia inicial aprobada:** pantalla **Catálogo** (`/catalogo`).
> 
> Este documento no pretende congelar el diseño actual ni obligar a que todas las pantallas sean iguales. Su objetivo es conservar las decisiones de UX que funcionan y utilizarlas como lenguaje común al revisar, diseñar o rehacer otras áreas.

## 1. Estado del documento

- Referencia analizada: **Catálogo**.
- Estado: **patrón aprobado por el usuario**.
- Otras pantallas se incorporarán sólo cuando se revisen expresamente.
- Las conclusiones inferidas se distinguen de las decisiones explícitamente confirmadas.

---

## 2. Qué funciona especialmente bien en Catálogo

### 2.1. Alta densidad sin sensación de desorden

Catálogo muestra mucha información y muchas posibilidades sin convertir la pantalla en un formulario administrativo. La información está organizada por capas:

1. búsqueda y filtros;
2. resumen cuantitativo;
3. contexto del resultado y herramientas de vista;
4. contenido principal;
5. acciones rápidas;
6. paginación.

**Patrón aprobado:** una pantalla de PikoFilm puede ser densa si existe una jerarquía visual clara. No hay que resolver la complejidad eliminando información útil.

### 2.2. El contenido es el protagonista

En vista de carátulas, los pósteres ocupan la mayor parte de la pantalla. Los controles son compactos y quedan por encima del contenido sin competir con él.

**Patrón aprobado:** dedicar la mayor superficie posible al objeto principal de cada pantalla y comprimir controles secundarios.

### 2.3. Filtros potentes pero compactos

El filtro combina:

- buscador principal visible;
- conjuntos rápidos;
- filtros desplegables;
- selección múltiple mediante chips;
- rango de años;
- atajos por décadas;
- posibilidad de limpiar filtros;
- aplicación explícita cuando corresponde.

Los filtros complejos viven en popovers y no ocupan permanentemente espacio vertical.

**Patrón aprobado:** lo frecuente debe estar visible; lo avanzado debe estar disponible a un clic, sin inundar la pantalla.

### 2.4. Resumen contextual inmediato

La banda de KPI responde rápidamente a preguntas básicas: cuántos títulos hay, cuántos faltan, cuántos están en proceso y cuántos están en Plex. Cada dato utiliza número, etiqueta, icono/estado y porcentaje.

**Patrón aprobado:** cuando una pantalla represente un conjunto de elementos, ofrecer primero un resumen pequeño y útil del estado de ese conjunto. Los KPI deben aportar contexto operativo, no ser decoración.

### 2.5. Estados reconocibles visualmente

Catálogo no obliga a leer texto para entender cada situación. Plex, faltantes, en proceso y estados de Lifecycle tienen señales visuales diferenciadas.

**Patrón aprobado:** los estados recurrentes deben tener un lenguaje visual consistente y reconocible. Color/icono complementan al texto; no deben sustituirlo cuando pueda existir ambigüedad.

### 2.6. Dos vistas para dos necesidades

La vista Grid favorece exploración visual. La vista Tabla favorece inspección de datos y comparación. Ambas representan el mismo conjunto y conservan filtros/contexto.

**Patrón aprobado:** cuando una colección tenga uso visual y analítico, considerar vistas alternativas sin duplicar la lógica funcional.

### 2.7. Acciones donde se necesitan

En las tarjetas se puede marcar un título como “En proceso” o excluirlo sin abrir la ficha. La tabla mantiene acciones equivalentes. Para profundizar se abre la ficha individual.

**Patrón aprobado:** permitir acciones rápidas y seguras desde el contexto donde aparece el elemento; reservar la ficha para análisis o acciones más completas.

### 2.8. Navegación con conservación de contexto

Al abrir una ficha se transmite la procedencia (`from`) para poder regresar al catálogo conservando el contexto. Los filtros, orden, vista y página se expresan mediante query parameters.

**Patrón aprobado:** navegar hacia el detalle no debe hacer perder al usuario el punto desde el que llegó.

### 2.9. Feedback y reversibilidad

Al excluir un título aparece confirmación y opción de **Deshacer**.

**Patrón aprobado:** las acciones que cambian el estado deben dar feedback inmediato. Siempre que sea razonable, una acción potencialmente molesta debe poder revertirse fácilmente.

### 2.10. Responsive real, no simple reducción

La interfaz cambia su composición según el ancho: número de columnas, distribución de KPI, popovers convertidos en superficies móviles, herramientas que se reorganizan y acciones que cambian de disposición.

**Patrón aprobado:** responsive significa reorganizar prioridades y controles, no limitarse a reducir tamaños.

---

## 3. Lenguaje visual de referencia

### Superficies

- Fondo oscuro.
- Paneles ligeramente diferenciados del fondo general.
- Bordes finos y discretos.
- Radios moderados.
- Sombras contenidas para profundidad, especialmente en tarjetas y popovers.

### Acentos

- Naranja como acento principal de interacción/selección.
- Verde asociado a estados positivos/Plex.
- Amarillo para ausencia o atención.
- Azul para procesos en curso.
- Rojo apagado para acciones destructivas o de exclusión.

La regla importante no es copiar literalmente cada color, sino mantener una **semántica estable de estados y acciones**.

### Tipografía y densidad

- Números importantes grandes y muy legibles.
- Etiquetas secundarias pequeñas.
- Metadatos compactos.
- Títulos claramente diferenciados.
- Poco espacio desperdiciado entre bloques funcionalmente relacionados.

### Interacción

- Hover discreto en tarjetas.
- Selección claramente visible.
- Botones compactos.
- Acciones destructivas diferenciadas de las primarias.
- Controles avanzados mediante popovers.

---

## 4. Arquitectura UX que debemos reutilizar

Cuando diseñemos una nueva pantalla, comprobar si encaja esta secuencia:

**Contexto / filtros → resumen → herramientas → contenido principal → acciones → navegación.**

No es obligatorio utilizar todos los niveles. Sí debemos evitar mezclar sin jerarquía filtros, métricas, contenido y acciones.

### Colecciones

Para pantallas con muchos elementos:

- búsqueda visible;
- filtros compactos;
- contador de resultados;
- ordenación;
- paginación o mecanismo equivalente;
- estados visibles;
- acceso claro al detalle;
- acciones rápidas cuando aporten valor.

### Buscadores de películas y títulos audiovisuales

**Patrón aprobado:** todo buscador cuyo objeto sean películas, series o títulos audiovisuales debe buscar, como mínimo, de forma independiente sobre:

- título en español/localizado;
- título principal;
- título original;
- IMDb ID.

La existencia de un título localizado no puede impedir encontrar el elemento mediante su título principal u original. No debe implementarse esta búsqueda mediante un `COALESCE` que reduzca los campos a un único valor buscable.

La búsqueda textual debe ser parcial y no sensible a mayúsculas/minúsculas. Cuando la entrada tenga formato de IMDb ID (`tt...`), el sistema debe permitir localizar directamente ese identificador. El placeholder y la ayuda del buscador deben describir únicamente capacidades que realmente estén implementadas.

Esta regla se aplica transversalmente a Catálogo, Calidad y cualquier pantalla presente o futura que permita buscar títulos audiovisuales, salvo que exista una excepción funcional expresamente justificada.

### Paginación, rendimiento y fluidez

**Patrón aprobado:** la velocidad de navegación es un requisito UX de primer nivel. Una mejora visual o funcional no se considera correcta si degrada perceptiblemente el rendimiento.

En colecciones potencialmente grandes:

- paginar en servidor cuando corresponda;
- devolver únicamente los datos necesarios de la página actual;
- conservar búsqueda, filtros, orden y página al navegar al detalle y volver;
- evitar N+1, cargas completas de colecciones y llamadas externas durante la renderización de listados;
- minimizar consultas redundantes, payload y trabajo de renderizado;
- optimizar primero las rutas frecuentes y medir antes de introducir índices, cachés, vistas materializadas o datos duplicados;
- hacer que búsqueda, filtros, ordenación y cambio de página se sientan ágiles.

La paginación debe comunicar claramente la posición dentro del conjunto y no debe obligar a recargar o reconstruir contexto innecesariamente.

### Navegación móvil

**Patrón aprobado:** toda pantalla y toda evolución deben diseñarse y validarse también para móvil. Responsive significa reorganizar jerarquía, controles y acciones para uso táctil; no simplemente reducir la versión de escritorio.

- Ninguna acción o información operativa esencial puede desaparecer porque no quepa.
- Debe evitarse el scroll horizontal innecesario.
- Los filtros deben seguir siendo comprensibles y manejables.
- Los paneles/popovers de escritorio deben transformarse en superficies móviles adecuadas cuando sea necesario.
- Debe conservarse contexto al entrar y salir de detalle también en móvil.
- La navegación debe mantenerse fluida y rápida en anchos pequeños.

### Consistencia de acciones globales

**Patrón aprobado:** una acción de dominio con el mismo nombre y significado debe ejecutar la misma operación canónica y producir las mismas consecuencias funcionales independientemente de la pantalla desde la que se invoque.

Las pantallas no deben implementar variantes locales de una misma acción de dominio. Esto aplica, entre otras, a acciones como **Excluir**, **Restaurar** o cambios de estado equivalentes cuando existan en varias superficies.

#### Contrato transversal de Excluir

- **Excluir no significa borrar.**
- Debe utilizar la misma operación canónica desde cualquier pantalla.
- Debe sacar el elemento del catálogo operativo y de los flujos/colas que correspondan según Lifecycle.
- Debe conservar los datos, identificadores, histórico, auditoría y referencias existentes.
- No debe borrar ni modificar el archivo físico de Plex.
- Debe funcionar de forma coherente para películas y series.
- Debe ofrecer feedback claro y, cuando sea razonable, posibilidad de **Deshacer** o restauración equivalente.

### Estados

Una pantalla no debería esconder elementos porque tengan un estado anómalo. Si un elemento requiere intervención, debe existir una cola, filtro o señal que permita encontrarlo.

### Acciones

Clasificar mentalmente las acciones en:

- navegación/consulta;
- acción habitual y reversible;
- cambio de estado;
- acción destructiva.

Su peso visual debe corresponder a su importancia y riesgo.

---

## 5. Qué NO debemos copiar mecánicamente

Catálogo es una referencia de UX, no una plantilla rígida. No todas las pantallas necesitan:

- cuatro KPI;
- filtros;
- grid de pósteres;
- tabla alternativa;
- los mismos colores exactos;
- la misma densidad.

Una pantalla de administración, una cola de Calidad y una ficha individual tienen objetivos diferentes. Debemos reutilizar **jerarquía, claridad, consistencia, densidad útil y comportamiento**, no clonar la composición.

---

## 6. Criterios de revisión para futuras pantallas

Al revisar cada pantalla responderemos, como mínimo:

1. ¿Se entiende inmediatamente para qué sirve?
2. ¿Está visible primero lo más importante?
3. ¿Hay información ocupando espacio sin ayudar a decidir o actuar?
4. ¿Las acciones principales son evidentes?
5. ¿Los estados se reconocen de un vistazo?
6. ¿Los controles avanzados están disponibles sin dominar la pantalla?
7. ¿La densidad es útil o produce ruido?
8. ¿Se conserva el contexto al entrar y salir del detalle?
9. ¿Las acciones dan feedback y son reversibles cuando procede?
10. ¿Funciona correctamente en escritorio y móvil?
11. ¿Es coherente con el lenguaje visual aprobado de PikoFilm?
12. ¿Existe algún estado o incidencia que pueda quedar invisible para el usuario?
13. Si existe buscador de títulos, ¿busca realmente por título localizado, principal, original e IMDb ID?
14. ¿La colección está paginada cuando corresponde y comunica claramente posición/rango?
15. ¿La navegación entre páginas, filtros, búsqueda y orden mantiene una respuesta ágil?
16. ¿Se han evitado N+1, cargas completas y llamadas externas innecesarias en listados?
17. ¿La versión móvil reorganiza realmente la interfaz sin perder acciones o información esencial?
18. Si una acción de dominio existe en varias pantallas, ¿todas invocan la misma operación canónica y producen el mismo comportamiento funcional?

---

## 7. Preferencias UX inferidas a partir de Catálogo

Estas conclusiones son **inferidas** y deberán consolidarse o corregirse durante las siguientes revisiones:

- Preferencia por interfaces modernas, oscuras y compactas.
- Preferencia por aprovechar bien el espacio disponible.
- Preferencia por ver mucha información útil sin tener que navegar continuamente.
- Preferencia por una jerarquía clara antes que por interfaces minimalistas que oculten información.
- Preferencia por estados y métricas visuales que permitan entender la situación rápidamente.
- Preferencia por filtros potentes cuando la cantidad de información lo exige.
- Preferencia por acciones contextuales que reduzcan pasos.
- Preferencia por mantener control manual incluso cuando existan automatismos.
- Preferencia por poder detectar excepciones y elementos que se salen del flujo normal.

---

## 8. Registro de decisiones explícitas

### 2026-08-25 — Referencia inicial

El usuario establece **Catálogo** como única pantalla de referencia inicial para construir la guía UX del frontal. Las siguientes conclusiones y reglas se irán añadiendo durante la revisión pantalla a pantalla.

### 2026-08-25 — Buscadores de películas y títulos audiovisuales

Durante la revisión de **Calidad → Identidad**, el usuario establece como regla transversal que los buscadores de películas/títulos deben permitir encontrar un elemento por título localizado, título principal, título original e IMDb ID. Esta decisión pasa a formar parte del patrón UX aprobado y debe comprobarse también al revisar pantallas existentes.

### 2026-08-25 — Paginación, rendimiento y fluidez

El usuario establece que la **velocidad es primordial**. Las colecciones deben paginarse cuando corresponda y la navegación entre búsqueda, filtros, orden, páginas y detalle debe sentirse muy ágil. Rendimiento real y percibido pasan a ser criterio de aceptación UX.

### 2026-08-25 — Consistencia de acciones globales

Durante la revisión de **Calidad → Identidad**, el usuario establece que acciones globales como **Excluir** deben hacer siempre lo mismo, independientemente de la pantalla. Se fija el principio de una única operación canónica por acción de dominio y se documenta expresamente el contrato funcional de Excluir.

### 2026-08-25 — Navegación móvil

El usuario establece que la navegación móvil debe tenerse siempre en cuenta. Toda pantalla y evolución debe diseñarse y validarse también para móvil, reorganizando la interfaz sin perder información ni acciones esenciales.

---

## 9. Evolución del documento

Este archivo es deliberadamente vivo. Cada revisión de pantalla podrá añadir:

- nuevas decisiones confirmadas;
- patrones reutilizables;
- antipatrónes detectados;
- componentes que convenga estandarizar;
- excepciones justificadas;
- criterios específicos para móvil;
- reglas de navegación y feedback;
- decisiones sobre densidad, métricas y visualización de estados.

Antes de rediseñar una pantalla existente o crear una nueva, este documento debe utilizarse como referencia UX del frontal de PikoFilm.
