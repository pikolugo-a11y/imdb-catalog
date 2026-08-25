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
