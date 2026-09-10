# PikoFilm V4 — Especificación UX/UI canónica final

Estado: **FUENTE CANÓNICA UX/UI V4**  
Baseline documentado: `main` después del merge de PR #511 (`323b1cd4dd2cc8b5def081bc98ab094006df3efe`).  
Este documento sustituye como autoridad UX principal a `V4_UX_FOUNDATION.md`, los apartados UX repartidos por cada vertical y los refinamientos aislados de Actividad/Operaciones.

---

## 1. Objetivo UX de PikoFilm V4

PikoFilm V4 debe sentirse como una **base de datos audiovisual operativa, clara y rápida**, no como un dashboard técnico ni como una app de consumo.

La experiencia debe permitir tres niveles de lectura sin mezclarlos:

1. **Consulta editorial**: Catálogo, Ficha, Personas, Sagas.
2. **Trabajo funcional**: Novedades, Calidad, Actividad.
3. **Diagnóstico técnico**: Operaciones.

La jerarquía visual debe reflejar esta separación. Los usuarios no deberían ver códigos internos, JSON, workers o estados de infraestructura salvo cuando entren expresamente en Operaciones.

---

## 2. Principios de diseño

### 2.1 Información primero, decoración después

PikoFilm no usa tarjetas grandes por defecto si una tabla/lista compacta comunica mejor la información. Las superficies de base de datos son **list-first**.

### 2.2 Densidad controlada

- mucho dato útil, poco ruido;
- información primaria visible;
- información secundaria subordinada;
- detalle técnico bajo demanda;
- evitar mega-paneles que obliguen a interpretar todo a la vez.

### 2.3 El color comunica estado, no adorna

El color de estado se reserva a significado:

- correcto/sano;
- atención;
- fallo/bloqueo;
- en curso;
- neutro.

PikoScore conserva su acento cálido y no compite con colores de alerta.

### 2.4 Neutralidad física

`Sin Plex` es un hecho descriptivo. No debe parecer un error editorial ni una tarea de visionado.

### 2.5 Acciones peligrosas separadas

Excluir, resetear, cancelar o modificar estado operativo se presentan con:

- contexto;
- explicación;
- confirmación proporcional al riesgo;
- nunca junto a acciones inocuas de forma que un clic accidental sea fácil.

### 2.6 Progresive disclosure

Primero se responde la pregunta del usuario; después se ofrece detalle.

Ejemplo Operaciones:

```text
Qué se hizo
¿Se completó?
Resultado
Estado final
----------------
Eventos / llamadas / JSON / errores / before-after
```

### 2.7 URL como estado de navegación

Cuando una superficie tiene filtros, orden, scope, página o vista relevantes, se persisten en URL para:

- volver desde una ficha;
- compartir/reabrir estado;
- evitar pérdida de contexto al recargar;
- mantener navegación determinista.

### 2.8 Responsive sin pérdida funcional

El iPhone no recibe una versión “recortada”. Se reordena el contenido:

- tabla de escritorio -> lista compacta;
- columnas secundarias -> segunda línea/metadatos;
- filtros -> filas apiladas/controles adaptados;
- acciones -> botones accesibles sin scroll horizontal obligatorio.

---

# 3. Shell global

## 3.1 Responsabilidad

El Shell da navegación estable entre grandes dominios. No debe incluir lógica técnica oculta ni prefetch agresivo.

## 3.2 Navegación principal

Debe permitir llegar de forma directa a las grandes superficies vigentes, incluyendo:

- Inicio;
- Catálogo;
- Novedades;
- Calidad;
- Personas;
- Sagas;
- Actividad;
- Operaciones.

La denominación exacta del menú puede adaptarse a espacio, pero no debe ocultar Operaciones ni Actividad dentro de menús ambiguos.

## 3.3 No prefetch masivo

La navegación usa el primitive `NoPrefetchLink` en caminos de alta fanout. Abrir una página no debe disparar decenas/cientos de requests especulativos a destinos dinámicos.

## 3.4 Estado activo

La sección actual debe ser reconocible visualmente sin depender únicamente del color.

---

# 4. Sistema visual

## 4.1 Apariencia

- dark-first;
- paneles sobrios;
- bordes/líneas finas para separación;
- radios contenidos;
- jerarquía tipográfica clara;
- evitar gradientes o brillos salvo acentos puntuales.

## 4.2 Tipografía

La jerarquía debe distinguir:

- kicker/contexto;
- título de página;
- subtítulo/explicación;
- títulos de sección;
- contenido principal;
- metadatos técnicos/secundarios.

No se usan tamaños enormes que desperdicien pantalla en una aplicación de datos.

## 4.3 Badges

Los badges sirven para estados cortos. No deben sustituir párrafos explicativos cuando el estado requiera contexto.

## 4.4 Tablas

Buenas prácticas:

- encabezado claro;
- filas clicables sólo cuando el destino es inequívoco;
- acciones separadas de la navegación de fila;
- nulos como `—`;
- orden estable;
- evitar columnas de datos internos que el usuario no necesita.

## 4.5 Listas compactas móviles

Cada elemento debe conservar:

1. identidad;
2. dato protagonista;
3. estado principal;
4. metadatos secundarios;
5. acción/destino.

---

# 5. Inicio

## 5.1 Objetivo visual

Dar una lectura rápida de “cómo está PikoFilm” sin duplicar todas las verticales.

## 5.2 Jerarquía

1. resumen general;
2. indicadores útiles;
3. accesos a áreas con trabajo;
4. tendencias/snapshots sólo si aportan contexto.

## 5.3 Evitar

- convertir Inicio en Operaciones;
- mostrar tablas técnicas;
- mostrar todas las incidencias detalladas;
- duplicar cada cola de Calidad.

---

# 6. Catálogo `/catalogo`

## 6.1 Cabecera

Debe dejar claro:

- que se está en Catálogo;
- scope actual (Todo/Películas/Series/Sagas);
- búsqueda/filtros disponibles;
- cantidad/resultados cuando aporta valor.

## 6.2 Navegación interna

`Todo · Películas · Series · Sagas` como scopes principales. `Excluidas` se presenta como destino secundario relacionado con Catálogo.

## 6.3 Barra de herramientas

Incluye de manera compacta:

- búsqueda;
- Plex;
- género(s);
- año desde/hasta;
- orden;
- vista lista/carátulas.

No se deben mostrar filtros que no tengan utilidad real sólo porque el dato existe.

## 6.4 Búsqueda

Placeholder debe sugerir los campos útiles: título/IMDb. La búsqueda se mantiene al navegar/paginar.

## 6.5 Géneros

Cuando hay selección múltiple, el modo OR/AND debe explicarse con lenguaje sencillo:

- Cualquiera;
- Todos.

## 6.6 Lista de escritorio

Orden recomendado de percepción:

1. Título;
2. Año;
3. Tipo;
4. Géneros;
5. PikoScore;
6. PikoQuality;
7. Plex.

PikoScore debe destacar más que el resto de métricas. Plex queda como estado físico corto.

## 6.7 Carátulas

Es una vista alternativa, no el modo dominante. Mantiene capacidad de abrir la Ficha y reconocer PikoScore/Plex sin sobrecargar cada tarjeta.

## 6.8 Paginación

50 resultados. Debe conservar todos los parámetros de URL. Los controles anterior/siguiente y/o numeración no deben provocar prefetch masivo.

## 6.9 Empty states

Distinguir:

- catálogo realmente vacío;
- filtros sin resultados;
- búsqueda sin coincidencias.

En filtros sin resultado, ofrecer una salida clara para limpiar/refinar, no un error técnico.

---

# 7. Ficha `/catalogo/[imdbId]`

## 7.1 Cabecera

La cabecera debe responder de inmediato:

- qué obra es;
- año/tipo;
- PikoScore;
- estado Plex.

No debe estar dominada por IDs o datos técnicos.

## 7.2 PikoScore

Protagonista visual. Puede incluir confianza/explicación en un bloque secundario accesible.

## 7.3 Sinopsis y datos editoriales

Se presentan como lectura natural, sin una cuadrícula de decenas de metadatos pequeños.

## 7.4 Plex/PikoQuality

Si hay copia física:

- estado Plex;
- PikoQuality;
- información técnica relevante.

Si no hay copia:

- `Sin Plex` neutral;
- no se inventa una alerta.

## 7.5 Personas

Dirección/creación/reparto principal con enlaces compactos. No usar un “muro de cast”.

## 7.6 Saga

Bloque compacto. Debe llevar a la ficha de Saga sin duplicar toda la composición.

## 7.7 Series

Temporadas en densidad compacta. Integridad física se entiende de un vistazo y no sugiere visionado.

## 7.8 Identificadores

Zona secundaria, normalmente al final o dentro de detalle. Los links externos abren nueva pestaña cuando procede.

## 7.9 Exclusión

`Excluir de PikoFilm` se separa del flujo de consulta. La confirmación debe mencionar claramente la obra/IMDb y la consecuencia editorial.

## 7.10 Volver

El control de retorno utiliza el `from` recibido y debe recuperar exactamente página, filtros, orden y vista.

## 7.11 Fallos secundarios

Si falla saga/personas/PikoQuality u otro bloque secundario, ese bloque puede mostrar indisponibilidad parcial sin reemplazar toda la Ficha por error.

---

# 8. Excluidas `/catalogo/excluidas`

## 8.1 Tono

Histórico reversible, sobrio. No tratar cada exclusión como un error.

## 8.2 Lista

Mostrar sólo lo necesario para decidir una restauración:

- título;
- año;
- tipo;
- fecha;
- acción Restaurar.

## 8.3 Restaurar

La microcopia debe dejar claro:

> Restaurar devuelve el título a Novedades; no lo añade directamente al Catálogo.

Tras éxito, mantener el usuario en Excluidas y actualizar la lista.

---

# 9. Novedades `/novedades`

## 9.1 Objetivo visual

Novedades es **cola de admisión**, no un catálogo paralelo.

## 9.2 Cabecera

Debe comunicar:

- cantidad de trabajo pendiente;
- estado de Discovery;
- botón de alta/manual cuando exista;
- sync Plex global manual cuando corresponda a esta superficie.

## 9.3 Estados visibles

- Lista;
- Atención;
- Procesando.

No mostrar tabs `Catalogada` o `Excluida`.

## 9.4 Prioridad

Lista primero, luego Atención, después Procesando. Dentro del grupo: más reciente primero.

## 9.5 Filtros

- estado;
- origen (Manual/Plex/Discovery/Sagas/Personas).

## 9.6 Fila de candidato

Información suficiente:

- título;
- año sólo si existe;
- tipo;
- IMDb;
- origen/evidencias;
- contexto;
- estado;
- fecha detectada;
- acciones.

No añadir columnas de país, ratings, votos o PikoScore antes de que el candidato haya pasado por Calidad.

## 9.7 Acciones en Lista

`Añadir a PikoFilm` es acción primaria. `Excluir` es secundaria/peligrosa. `Retirar propuesta manual` debe distinguirse de excluir globalmente.

## 9.8 Procesando

Mostrar actividad real, no un spinner eterno derivado de un flag. Si no existe run activo, debe convertirse en Atención o estado final adecuado.

## 9.9 Atención

Debe explicar por qué necesita ayuda y mostrar una salida:

- reintentar;
- resolver IMDb;
- otra acción canónica específica.

## 9.10 Discovery

Bloque/control que muestra:

- última ejecución;
- próxima fecha permitida;
- botón habilitado/deshabilitado con motivo.

## 9.11 Admisión

Tras pulsar Añadir:

- feedback inmediato;
- candidato desaparece cuando la admisión se confirma;
- usuario permanece en Novedades;
- el seguimiento posterior se ve en Actividad.

Si el Lifecycle está ocupado, el candidato no debe desaparecer ni simular éxito.

---

# 10. Calidad `/calidad`

## 10.1 Hub

La portada funciona como radar, no como mega-cola.

Tres conceptos transversales:

- Requieren atención;
- En seguimiento automático;
- Al día.

## 10.2 Tarjetas/bloques del hub

Cada dominio debe resumir:

- qué necesita atención humana;
- qué está siguiendo el sistema;
- estado general;
- enlace a su workbench.

No mostrar filas técnicas individuales aquí.

## 10.3 Centro común

Agrupa dominios con patrón parecido:

- Identidad + Validación;
- Datos;
- Personas;
- PikoQuality;
- Integridad Lifecycle.

## 10.4 Páginas especializadas

Películas y Series conservan más profundidad porque su diagnóstico lo necesita.

---

# 11. Calidad — Películas

## 11.1 Objetivo

Leer rápidamente:

- anomalía física;
- estado de análisis;
- deuda histórica;
- acción manual disponible.

## 11.2 Jerarquía

Atención real primero. Seguimiento automático después. Casos sanos como contexto mínimo.

## 11.3 Acciones

- analizar/forzar;
- aceptar finding cuando proceda;
- `Ya la corregí`/reset completo.

Una acción destructiva debe explicar qué recalcula/invalida.

---

# 12. Calidad — Series listado

## 12.1 Propósito

Triage diario. Debe ser una de las superficies más rápidas del sistema.

## 12.2 Información por serie

Priorizar:

- identidad;
- estado funcional;
- motivo de atención/seguimiento;
- estado Plex;
- referencia TMDb;
- disponibilidad/diagnóstico cuando sea relevante;
- cambio reciente funcional.

## 12.3 No convertir vencimientos en errores

Una serie pendiente de refresco automático debe etiquetarse como seguimiento automático, no “problema” o “error”.

## 12.4 Acceso al detalle

Toda anomalía real debe abrir la ficha de Series en el contexto preciso.

---

# 13. Calidad — Serie detalle

## 13.1 Workbench

Es una pantalla de diagnóstico funcional, no una ficha editorial.

## 13.2 Bloques

Orden recomendado:

1. estado/resumen;
2. Plex;
3. referencia TMDb;
4. temporadas/episodios;
5. disponibilidad España;
6. anomalías/matches;
7. decisiones manuales;
8. cambios recientes;
9. acciones individuales.

## 13.3 Evidencia

En casos ambiguos mostrar:

- numeración;
- título;
- duración;
- archivo Plex;
- episodio TMDb candidato;
- motivo de la ambigüedad.

La UI debe ayudar a decidir; no sólo listar IDs.

## 13.4 Futuros

Próximos episodios se muestran como información y visualmente no se confunden con faltantes.

## 13.5 Disponibilidad

`UNKNOWN` se presenta como seguimiento automático salvo que exista una razón real de intervención.

## 13.6 Overrides

Una decisión manual debe indicar que está activa y ofrecer `Volver a automático` o reapertura cuando corresponda.

---

# 14. Calidad — Datos/Identidad/Personas/PikoQuality

## 14.1 Patrón común

Estas áreas deben usar un patrón coherente:

- resumen del estado;
- atención real;
- seguimiento automático;
- controles individuales;
- link a detalle cuando exista.

## 14.2 Datos

Distinguir claramente:

- faltante;
- valor manual;
- valor presente;
- discrepancia informativa;
- rating vencido automático.

## 14.3 Identidad

Una identidad validada no aparece como “pendiente” por edad. Los estados de revisión deben explicar la razón.

## 14.4 Personas

Calidad de Personas puede lanzar el refresh individual sin convertir toda Persona en una pantalla de Operaciones.

## 14.5 PikoQuality

Mostrar calidad/estado y atención, no los controles de barrido masivo como UX principal.

---

# 15. Personas `/personas`

## 15.1 Objetivo

Explorar personas relevantes y descubrir filmografía útil.

## 15.2 Vista inicial

`Destacados · Relevancia`.

No mostrar el score interno de relevancia como nueva nota.

## 15.3 Tabla escritorio

Columnas:

- Persona;
- Rol;
- Filmografía relevante;
- PikoScore medio;
- En Plex;
- Fuera de PikoFilm.

## 15.4 Ordenes

Los nombres de orden deben comunicar intención, por ejemplo:

- Relevancia;
- Mejor PikoScore fiable;
- otros órdenes aprobados.

## 15.5 PikoScore medio

El valor visible es la media real. La señal de confianza sólo afecta al orden, no falsifica el valor mostrado.

## 15.6 Móvil

Lista compacta: nombre/rol arriba; métricas en segunda línea; no tabla horizontal.

---

# 16. Persona detalle `/personas/[id]`

## 16.1 Cabecera

Identidad de la persona + resumen relevante. Biografía no debe desplazar la filmografía, que es el propósito de la superficie.

## 16.2 Secciones

- obras relevantes en PikoFilm;
- obras relevantes fuera de PikoFilm;
- otros créditos.

## 16.3 Fuera de PikoFilm

Cada título identificado puede ofrecer `Enviar a Novedades`. Debe quedar claro que no se añade directamente al Catálogo.

## 16.4 Otros créditos

Sección secundaria/colapsable con motivo de descarte.

## 16.5 Refresco

`Actualizar persona` es explícito. Abrir la página nunca inicia refresh automáticamente.

---

# 17. Sagas `/sagas`

## 17.1 Objetivo

Priorizar colecciones útiles desde la perspectiva PikoFilm/Plex.

## 17.2 Filtros

- Todas;
- A una película;
- Parciales;
- Completas;
- Sin Plex.

## 17.3 Orden inicial

Prioridad de colección. La semántica debe favorecer primero lo cercano a completar, no sólo el nombre alfabético.

## 17.4 Métricas

Por saga se pueden mostrar de manera compacta:

- estado Plex;
- En Plex / exigibles;
- faltantes;
- PikoScore;
- no exigibles;
- fuera de PikoFilm;
- periodo.

## 17.5 Móvil

Lista compacta, no mosaico editorial grande.

---

# 18. Saga detalle

## 18.1 Pregunta principal

¿Qué compone esta colección, qué tengo físicamente, qué falta, qué no es exigible aún y qué está fuera de PikoFilm?

## 18.2 Cabecera

- nombre;
- periodo;
- PikoScore agregado;
- estado físico global.

## 18.3 Cronología

Miembros ordenados cronológicamente. Cada fila muestra estado entre:

- En Plex;
- Sin Plex;
- Fuera de PikoFilm;
- En cines;
- Próximamente.

## 18.4 Acciones

- título admitido -> abrir Ficha;
- externo -> enviar a Novedades;
- `Actualizar esta saga` -> acción explícita.

La navegación normal no dispara TMDb.

---

# 19. Actividad `/actividad`

## 19.1 Propósito

Explicar **qué está haciendo PikoFilm** en lenguaje funcional.

## 19.2 Estructura principal

Dos grandes ejes compatibles:

- cronología pasado/presente;
- calendario futuro.

## 19.3 Cronología

Orden descendente y agrupación por tiempo (`Hoy`, `Ayer`, fechas).

Cada entrada debe poder mostrar:

- verbo/acción funcional;
- entidad;
- resultado;
- origen (`Tú`, `Automático`, `Plex`, etc.);
- hora;
- estado;
- siguiente paso si existe.

## 19.4 Filtros

Accesos rápidos:

- Todo;
- Catálogo;
- Plex;
- Calidad;
- Personas;
- Sagas;
- Novedades;
- Errores.

Búsqueda por entidad/texto funcional.

## 19.5 Peso visual

### Rutinario correcto

Compacto, sin ocupar una tarjeta grande.

### Cambio relevante

Más contraste y resumen de qué cambió.

### Atención/fallo

Visible con prioridad y una acción/destino.

## 19.6 Actividad en curso

Mostrar progreso sólo si aporta valor. Actualizar la misma entrada correlacionada; evitar spam de filas por heartbeat o item.

## 19.7 Agrupación

Ejemplo:

`Actualizaciones automáticas · 80 títulos`  
`76 actualizados · 4 sin cambios`

Debe ser posible abrir el detalle funcional sin cargar cientos de filas al inicio.

## 19.8 Fallos

No mostrar mensaje crudo de excepción. Explicar:

- qué no se completó;
- consecuencia actual;
- si se reintentará;
- dónde revisar si necesita humano.

## 19.9 Enlace a Operaciones

Secundario: `Ver detalle técnico en Operaciones`.

---

# 20. Calendario de Actividad

## 20.1 Visualización

Horizonte 30 días. La primera semana admite más detalle; el resto se compacta.

Debe poder ver días vacíos: no ocultarlos, porque son relevantes para entender distribución de carga.

## 20.2 Carga

Mostrar:

- volumen;
- tipo de trabajo;
- nivel baja/media/alta;
- alertas de concentración.

No mostrar CPU, lanes o workers aquí.

## 20.3 Planes

Estados visuales distinguibles:

- Pendiente de planificar;
- Planificada;
- Retrasada;
- En curso;
- resultado final.

## 20.4 Acciones de planificación

En contexto de tarea/bloque:

- mover;
- priorizar;
- bloquear/desbloquear;
- marcar pico deliberado.

No convertir el calendario en un panel técnico.

## 20.5 Recurrencia

Una edición puntual debe dejar claro que afecta a esa ocurrencia. Cambiar todas las siguientes exige una acción explícita diferenciada.

## 20.6 Pico de carga

Cuando existe riesgo previsto:

- explicar qué día/franja;
- volumen responsable;
- qué pudo redistribuirse;
- opciones Mantener pico / Posponer no prioritario;
- link a Operaciones si hay restricción técnica.

---

# 21. Operaciones `/admin`

## 21.1 Filosofía UX

**Search-first, exception-first, detail-on-demand.**

No es una lista de 100 ejecuciones recientes como contenido principal.

## 21.2 Cabecera

Debe explicar que Operaciones sirve para diagnóstico y control técnico.

## 21.3 Salud por excepción

Franja compacta superior.

### Sano

Ejemplo conceptual:

`Sistema operativo · 0 incidencias activas · fuentes disponibles`

### Con atención

Tarjetas/ítems sólo para anomalías reales:

- incidencias activas;
- Batch detenidos;
- motor pausado;
- fuente bloqueada;
- worker/heartbeat;
- planner problemático.

Cada ítem abre diagnóstico.

## 21.4 Buscador técnico

Campo protagonista. Placeholder debe sugerir amplitud:

`IMDb, título, persona, run ID, Batch, proceso, error…`

No exigir al usuario seleccionar primero “tipo de búsqueda”.

## 21.5 Filtros avanzados

Dentro de disclosure (`Filtros avanzados`). Pueden incluir:

- estado;
- proceso;
- trigger/origen;
- ejecución;
- entidad;
- fuente;
- periodo;
- Batch.

## 21.6 Resultados

Sólo se muestran al buscar/navegar. Cada resultado debe explicar **por qué coincide** y dar contexto suficiente para decidir qué abrir.

---

# 22. Incidencias de Operaciones

## 22.1 Presentación

No listar 200 errores iguales. Agrupar cuando la huella es realmente equivalente.

## 22.2 Grupo

Mostrar:

- causa/código comprensible;
- proceso/paso;
- fuente;
- ocurrencias;
- entidades afectadas;
- primera/última vez;
- activas restantes.

## 22.3 Estado

- Activa;
- Resuelta después;
- Resuelta/descartada manualmente.

## 22.4 Acción `Descartar / Marcar resuelto`

Debe comunicar:

> Esto deja de tratar la incidencia como activa; no borra el error ni la ejecución original.

Si el grupo contiene varias entidades, la acción debe respetar el alcance mostrado.

---

# 23. Detalle de ejecución `/admin/runs/[id]`

## 23.1 Navegación

Arriba:

- volver a Operaciones;
- `Ver en Actividad` cuando exista correlación.

## 23.2 Hero/resumen

Identifica:

- nombre humano del proceso;
- código como información secundaria;
- entidad/alcance;
- badge de estado técnico;
- resultado funcional.

## 23.3 Bloque “Qué pasó”

Es el bloque principal y responde:

- `Se hizo`;
- `Completado`;
- `Resultado`;
- `Estado final`.

Un `failed` o `cancelled` no debe mostrar `Completado: Sí`.

## 23.4 Resumen técnico compacto

- solicitado;
- origen;
- executor;
- tipo de run;
- duración;
- llamadas externas;
- retries;
- errores.

## 23.5 Incidencias y resultado técnico

Sección desplegable; se abre por defecto si existe incidencia activa. Distinguir error histórico, resuelto manualmente y resuelto por ejecución posterior.

## 23.6 Eventos, pasos y llamadas

Timeline técnica bajo demanda. Puede incluir datos JSON en `<pre>` cuando son realmente necesarios.

## 23.7 Relacionadas

Parent/children y ejecuciones correlacionadas deben ser navegables.

## 23.8 Batch items

Si el run es/está ligado a Batch, mostrar items sólo en el detalle, no inundar la portada.

## 23.9 Bajo nivel

IDs, correlation, idempotency, contexto, métricas y before/after en una sección final.

---

# 24. Centro de control

## 24.1 Estructura

Cuatro dominios visibles y estables:

- Sistema / Batch;
- Fuentes y límites;
- Recuperación;
- Mantenimiento.

No crear una pestaña por cada tabla interna.

## 24.2 Navegación interna

Links/anchors claros. La portada de Operaciones enlaza al Centro sin duplicarlo entero.

---

# 25. Sistema / Batch

## 25.1 Estado antes que parámetros

Mostrar primero:

- operativo/pausado;
- Batch activos;
- progreso;
- colas relevantes;
- anomalías.

## 25.2 Detalle progresivo

Concurrencia, leases, heartbeats y retry son secundarios hasta que se investiga una incidencia.

## 25.3 Acciones

Pausa/reanuda/cancela sólo cuando el estado real lo permite. Deshabilitar/ocultar acciones imposibles es mejor que dejar botones que luego fallan.

---

# 26. Fuentes y límites

## 26.1 Ficha por fuente

Para cada fuente gobernada:

- nombre;
- disponibilidad;
- uso/restante;
- Configurado;
- Hard cap;
- Efectivo;
- reparto Batch;
- breaker;
- bloqueo hasta;
- errores/rate limit recientes.

## 26.2 Edición

Sólo inputs soportados. La UI no ofrece valores superiores al hard cap.

## 26.3 Semántica

La diferencia Configurado / Hard cap / Efectivo debe ser evidente. Evitar una tabla donde tres números parezcan equivalentes.

---

# 27. Recuperación

## 27.1 Filosofía

Nunca un botón `Reset` genérico.

## 27.2 Recuperar título

Flujo:

1. buscar/identificar título;
2. mostrar estado actual;
3. explicar qué hará “Reiniciar desde Novedades”;
4. enumerar lo que se invalida y lo que se conserva;
5. pedir IMDb de confirmación u otra confirmación fuerte;
6. ejecutar;
7. mostrar resultado y link a run.

## 27.3 Batch

Las acciones dependen del estado:

- running -> pausar/cancelar;
- paused -> reanudar/cancelar;
- retryable -> acción específica si existe;
- terminal -> no simular que puede reanudarse si backend no lo soporta.

---

# 28. Mantenimiento

## 28.1 Tarjeta de operación

Cada mantenimiento debe tener:

- nombre humano;
- propósito;
- alcance;
- tipo lectura/mutación;
- riesgo;
- reversibilidad;
- resultado esperado;
- botón.

## 28.2 Confirmación

- sólo lectura: directa;
- mutación pequeña: confirmación normal;
- destructiva/alto impacto: confirmación fuerte y contextual.

## 28.3 Resultado

Después de ejecutar, mostrar:

- completado/no;
- qué cambió;
- estado final;
- link al run de Operaciones.

---

# 29. Formularios y acciones

## 29.1 Estados

Toda acción debe contemplar:

- idle;
- pending;
- éxito;
- fallo;
- duplicate/idempotent cuando corresponda.

## 29.2 Doble click

Deshabilitar mientras se envía cuando sea posible y, además, confiar en idempotencia backend. La UX no sustituye la protección funcional.

## 29.3 Mensajes

Un mensaje de éxito debe afirmar sólo lo que realmente ocurrió.

Incorrecto:

`Todo listo` si sólo se encoló.

Correcto:

`Proceso iniciado` / `Título devuelto a Novedades` / `Incidencia marcada como resuelta` según el caso.

---

# 30. Empty, loading y error states

## 30.1 Empty sano

Ejemplo Operaciones:

`Sin incidencias activas`.

Debe leerse como éxito, no como una pantalla vacía desconcertante.

## 30.2 Empty por filtro

Explicar que no hay coincidencias y ofrecer limpiar filtros.

## 30.3 Loading

Evitar skeletons enormes si la pantalla puede conservar estructura. En procesos reales, distinguir “cargando UI” de “proceso en curso”.

## 30.4 Error de lectura

Mostrar reintento y contexto humano. No volcar stack.

## 30.5 Error parcial

En Ficha y otras superficies compuestas, mantener bloques sanos y aislar el secundario fallido.

---

# 31. Microcopy canónica

## 31.1 Origen de actividad

Preferir:

- Tú;
- Automático;
- Plex;
- Discovery.

Evitar:

- railway-api-worker;
- lane_api;
- cron-job-foo.

## 31.2 Estado funcional

Preferir:

- Al día;
- Necesita revisión;
- Seguimiento automático;
- Sin cambios;
- Actualizado.

## 31.3 Estado técnico

En Operaciones se permite:

- En cola;
- En curso;
- Correcto;
- Parcial;
- Fallido;
- Cancelado.

## 31.4 Resultado técnico vs funcional

No mezclar:

`Correcto` = ejecución técnica.  
`Sin cambios` = resultado funcional.

La UI puede mostrar ambos juntos cuando ayuda.

---

# 32. Accesibilidad y usabilidad

Aunque PikoFilm sea una herramienta personal, se deben conservar principios básicos:

- controles con etiqueta visible o accesible;
- no depender sólo del color;
- áreas clicables con tamaño suficiente en móvil;
- contraste alto en dark theme;
- focus reconocible;
- inputs con error explicativo;
- confirmaciones con nombre/entidad concreta;
- tablas con cabeceras semánticas;
- links distinguibles de botones;
- no usar texto minúsculo para información imprescindible.

---

# 33. Rendimiento UX

La percepción de rapidez depende de evitar trabajo innecesario, no sólo de loaders.

Reglas:

- paginar en servidor;
- filtros en DB;
- no traer históricos completos;
- no cargar detalle de cientos de items hasta que se abre;
- no hacer APIs externas al render normal;
- evitar prefetch masivo;
- mantener auto-refresh moderado en Actividad;
- en Operaciones no cargar resultados hasta que exista búsqueda;
- hidratar Personas sólo para la página actual;
- usar read models para Series/Sagas cuando corresponda.

---

# 34. Coherencia entre superficies

## 34.1 Actividad ↔ Operaciones

Mismo hecho, dos niveles de lectura.

Actividad:

`Datos actualizados de Heat · Se actualizaron 3 campos.`

Operaciones:

`PROC-DATA-001 · run_id · llamadas · tiempos · eventos · before/after.`

## 34.2 Calidad ↔ Operaciones

Calidad muestra:

`Necesita revisión: episodio sin correspondencia clara.`

Operaciones muestra:

causa técnica, ejecución, fuente, retries, payloads.

## 34.3 Novedades ↔ Actividad

Novedades sirve para decidir. Tras la admisión, el seguimiento deja de vivir en la fila y pasa a Actividad.

## 34.4 Catálogo ↔ Ficha

Catálogo sirve para comparar; Ficha para profundizar. La Ficha no repite una tabla completa ni Catálogo intenta mostrar todo el detalle.

---

# 35. Criterios de revisión visual por superficie

Antes de cerrar un cambio UX comprobar:

### Catálogo

- ¿se puede localizar una obra rápidamente?
- ¿PikoScore domina las métricas?
- ¿Sin Plex sigue neutral?
- ¿URL/retorno conserva estado?

### Ficha

- ¿sé qué obra es y cómo está sin hacer scroll?
- ¿los secundarios no tumban la página?
- ¿la exclusión es clara y segura?

### Novedades

- ¿sé qué puedo decidir ahora?
- ¿Procesando corresponde a una ejecución real?
- ¿Atención ofrece salida?

### Calidad

- ¿distingo humano vs automático?
- ¿puedo llegar al dominio correcto desde el hub?
- ¿no estoy viendo logs técnicos?

### Personas

- ¿la relevancia favorece personas realmente útiles?
- ¿no se muestra un score opaco adicional?
- ¿abrir no refresca?

### Sagas

- ¿entiendo qué falta realmente?
- ¿futuro/cine no penaliza?
- ¿no hay semántica de visionado?

### Actividad

- ¿entiendo qué hizo PikoFilm?
- ¿puedo localizar una entidad?
- ¿el ruido automático está compactado?
- ¿el futuro está visible?

### Operaciones

- ¿puedo encontrar un run/error sin navegar un feed?
- ¿sé qué pasó antes de abrir JSON?
- ¿una incidencia resuelta deja de pedir atención?
- ¿las acciones peligrosas explican su alcance?

---

# 36. Reglas para cambios UX futuros

1. No añadir información sólo porque exista en la DB.
2. Identificar la pregunta principal de la superficie.
3. Clasificar cada dato como primario/secundario/técnico.
4. Mantener términos funcionales consistentes.
5. No trasladar complejidad de Operaciones a Catálogo/Calidad.
6. No introducir semántica de consumo.
7. Mantener capacidad en móvil.
8. Preservar estado URL cuando ya forma parte del flujo.
9. No sustituir un control seguro por uno genérico.
10. Añadir/actualizar tests de contrato cuando la estructura sea funcionalmente relevante.
11. Validar visualmente producción después del deploy del usuario.
12. Si un cambio UX altera comportamiento, actualizar también `V4_FUNCTIONAL_SPEC.md`.

---

## 37. Documentos relacionados

- `docs/V4_FUNCTIONAL_SPEC.md` — qué debe hacer la aplicación;
- `docs/V4_ARCHITECTURE.md` — cómo está construida;
- `docs/processes/PROCESS_CATALOG.md` — procesos concretos;
- `docs/processes/BATCH_ARCHITECTURE.md` — Batch;
- `docs/operations/RUNBOOK.md` — operación técnica.

Los mockups y documentos UX históricos pueden seguir existiendo en historial Git como evidencia de diseño, pero no tienen autoridad frente a esta especificación y al código vivo.