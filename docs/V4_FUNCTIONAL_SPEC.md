# PikoFilm V4 — Especificación funcional canónica final

Estado: **FUENTE CANÓNICA FUNCIONAL V4**  
Baseline documentado: `main` después del merge de PR #511 (`323b1cd4dd2cc8b5def081bc98ab094006df3efe`).  
Este documento sustituye como autoridad funcional principal a los contratos V4 separados por vertical (`V4_CATALOGO`, `V4_FICHA`, `V4_PERSONAS`, `V4_SAGAS`, `V4_NOVEDADES`, `V4_CALIDAD`, `V4_ACTIVIDAD`, `V4_OPERACIONES`) y a `PRODUCT_AND_LIFECYCLE.md`.

---

## 1. Qué es PikoFilm

PikoFilm es una **base audiovisual personal maestra**. Su misión es mantener una colección editorial consistente de películas y series y relacionarla con:

- identidad externa;
- metadatos;
- ratings y PikoScore;
- presencia física en Plex;
- calidad física y técnica;
- temporadas y episodios de series;
- Personas y filmografías;
- Sagas;
- admisiones/exclusiones;
- actividad funcional;
- estado operativo y diagnóstico.

PikoFilm **no es** un gestor de consumo. No gestiona visto/no visto, progreso, hábitos de reproducción ni una cola personal de “pendiente de ver”. Plex es la verdad de presencia física y reproducción, no la verdad editorial del catálogo.

---

## 2. Principios funcionales globales

1. **PikoFilm manda editorialmente.** Una obra puede pertenecer al catálogo aunque no esté físicamente en Plex.
2. **Plex manda físicamente.** `En Plex` / `Sin Plex` describe presencia, no intención de consumo.
3. **Una operación funcional tiene una receta canónica.** Manual y Batch no pueden divergir funcionalmente.
4. **Automático no significa invisible.** Toda mutación relevante debe poder explicarse en Actividad y diagnosticarse en Operaciones.
5. **Trabajo automático no equivale a atención humana.** Calidad sólo destaca lo que realmente requiere decisión.
6. **Las decisiones manuales se protegen.** No se sobrescriben silenciosamente por fuentes externas.
7. **Los errores técnicos viven en Operaciones.** Calidad explica bloqueos funcionales; Actividad explica consecuencias funcionales.
8. **Los datos se leen desde Neon.** Abrir una pantalla normal no debe provocar enriquecimiento externo pesado.
9. **El sync Plex global es manual.** No existe polling Plex automático.
10. **Los procesos automáticos posteriores al sync sí pueden encadenarse.** No debe requerirse un segundo click por cada entidad.
11. **La historia detallada de Actividad/Operaciones dura 30 días.** Estado funcional vigente no se purga por edad.
12. **No se inventan controles administrativos.** Operaciones sólo expone acciones reales, seguras y auditables.

---

## 3. Entidades funcionales principales

### 3.1 Obra

Película o serie admitida en PikoFilm. Se identifica principalmente por IMDb en el circuito editorial y puede relacionarse con TMDb y otras fuentes.

### 3.2 Candidato de Novedades

Obra todavía no admitida que espera preparación o decisión humana. Un IMDb corresponde a un único candidato con múltiples orígenes/evidencias.

### 3.3 Exclusión

Decisión editorial que impide que un IMDb sea readmitido silenciosamente. Restaurar no equivale a readmitir: devuelve el título a Novedades.

### 3.4 Persona

Actor, actriz, director/a u otra persona cinematográficamente relevante derivada del universo PikoFilm y su filmografía persistida.

### 3.5 Saga

Colección TMDb persistida, cruzada con PikoFilm y Plex. Su composición no depende del consumo del usuario.

### 3.6 Ejecución

Instancia observada de un proceso funcional (`process_run`). Puede ser manual, individual, Batch, global o automática.

### 3.7 Batch

Conjunto persistente de unidades que repiten una operación canónica sobre varias entidades.

### 3.8 Plan futuro

Intención de trabajo futuro (`process_plans`). No es todavía una ejecución.

### 3.9 Incidencia operativa

Condición técnica que requiere atención ahora. Se deriva de errores/estado operativo; no es sinónimo de “error histórico”.

---

## 4. Lifecycle funcional

El Lifecycle expresa **dónde está una obra respecto a la completitud funcional**.

Flujo conceptual:

```text
Novedades / admisión
 -> identidad
 -> validación de identidad
 -> datos estructurales
 -> ratings
 -> PikoScore
 -> estado físico Plex cuando aplica
 -> validación física de película o reconciliación de serie
 -> PikoQuality cuando aplica
 -> completa
```

Reglas:

- una condición pendiente se resuelve, no se oculta;
- una decisión humana detiene automatización cuando realmente es necesaria;
- un cambio externo puede reabrir trabajo previamente completo;
- la ausencia de Plex no elimina la obra;
- Lifecycle se recalcula desde estado canónico, no desde flags de UI;
- una operación puede terminar técnicamente bien y dejar un resultado funcional `pending` o `blocked`;
- la observabilidad y el Lifecycle son independientes.

---

# 5. Inicio

## 5.1 Propósito

Inicio es el resumen ejecutivo de PikoFilm. Debe permitir entender el estado general sin convertirse en un duplicado de Calidad, Actividad u Operaciones.

## 5.2 Contenido funcional

Puede resumir:

- volumen de catálogo;
- distribución película/serie;
- señales de salud funcional;
- actividad reciente agregada;
- almacenamiento/snapshots históricos cuando corresponda;
- accesos a las verticales principales.

## 5.3 Límites

Inicio no debe:

- mostrar logs técnicos;
- reemplazar Operaciones;
- convertirse en cola de mantenimiento;
- ejecutar APIs externas por render.

El snapshot histórico diario del dashboard es una captura pasiva, no un motor de mantenimiento.

---

# 6. Catálogo

Ruta principal: `/catalogo`.

## 6.1 Propósito

Consultar, localizar, filtrar y comparar las obras **ya admitidas** en la base audiovisual maestra.

## 6.2 Navegación

Scopes principales:

- Todo;
- Películas;
- Series;
- Sagas.

`Excluidas` es una vista secundaria del contexto Catálogo, no una pestaña equivalente de contenido activo.

## 6.3 Vista principal

- 50 obras por página;
- lista/tabla como vista inicial;
- carátulas como alternativa;
- filtrado, orden y paginación en servidor;
- URL persistente para estado de la vista.

Columnas de escritorio:

- Título;
- Año;
- Tipo;
- Géneros;
- PikoScore;
- PikoQuality;
- Plex.

En móvil se recompone en lista compacta manteniendo la misma información esencial.

## 6.4 Búsqueda

Busca sobre:

- título mostrado;
- título original;
- IMDb ID.

Debe ignorar diferencias de mayúsculas y acentos cuando el modelo lo permita.

## 6.5 Filtros

- Plex;
- múltiples géneros;
- rango de años.

Géneros soporta:

- `Cualquiera` = OR;
- `Todos` = AND.

Un rango de años inválido (`desde > hasta`) se rechaza antes de ejecutar una consulta incoherente.

## 6.6 Orden

Opciones:

- Título;
- Año;
- PikoScore.

Orden inicial: PikoScore descendente. Nulos al final. Desempates deterministas para paginación estable.

## 6.7 Estado en URL

La URL conserva:

- scope;
- búsqueda;
- filtros;
- orden;
- vista;
- página.

Cambiar búsqueda/filtro/orden/scope vuelve a página 1. Cambiar sólo lista/carátulas conserva la página.

## 6.8 Lo que no se muestra

Catálogo no expone:

- Lifecycle;
- procesos técnicos;
- ratings externos individuales;
- estados Batch;
- errores operativos;
- watched/unwatched.

## 6.9 Plex

`En Plex` / `Sin Plex` es descriptivo y neutral. `Sin Plex` no se pinta como warning editorial.

---

# 7. Ficha de obra

Ruta: `/catalogo/[imdbId]`.

## 7.1 Propósito

Mostrar el detalle unificado de una obra sin convertir la pantalla en una consola de datos internos.

## 7.2 Jerarquía funcional

Primero:

- identidad;
- PikoScore;
- tipo/año/contexto editorial;
- presencia física Plex.

Después:

- sinopsis;
- país/estreno/duración cuando aportan valor;
- explicación de PikoScore;
- PikoQuality si existe copia física evaluable;
- personas principales;
- saga;
- temporadas para series;
- identificadores externos.

## 7.3 PikoScore

Es la valoración protagonista. La ficha puede explicar:

- confianza;
- familias/fuentes;
- contribuciones comprensibles.

No muestra fórmulas internas ni convierte los ratings externos en notas protagonistas.

## 7.4 Plex y PikoQuality

- Plex describe presencia física;
- PikoQuality sólo aparece cuando hay evidencia técnica válida;
- ausencia de PikoQuality no es automáticamente una incidencia editorial;
- para series puede existir calidad agregada/por temporada.

## 7.5 Personas

Dirección/creación y reparto principal enlazan a Personas. No se vuelca toda la base de créditos externos.

## 7.6 Sagas

Se muestran como contexto compacto: cobertura PikoFilm y presencia Plex, sin lenguaje de visionado.

## 7.7 Series

Por temporada puede mostrarse integridad física, por ejemplo:

- `23/23 · Completa`;
- `22/23 · Pendiente`.

Aquí `Pendiente` significa cobertura física de episodios, no visionado.

## 7.8 Atención contextual

Sólo aparecen casos que realmente requieren decisión humana. Los fallos técnicos se consultan en Operaciones.

## 7.9 Identificadores externos

IMDb/TMDb y otros IDs útiles aparecen en una zona secundaria y pueden enlazar a su origen.

## 7.10 Exclusión

`Excluir de PikoFilm`:

- es secundaria pero visible;
- requiere confirmación;
- afecta editorialmente a la obra;
- deja trazabilidad.

## 7.11 Retorno

La ficha debe volver exactamente al estado de Catálogo o Excluidas recibido por `from`.

## 7.12 Resiliencia

Un fallo de un bloque secundario no debe tumbar toda la ficha. Sólo un fallo/ausencia de identidad imprescindible produce error global.

---

# 8. Excluidas

Ruta: `/catalogo/excluidas`.

## 8.1 Propósito

Histórico reversible de exclusiones vigentes.

## 8.2 Vista

Campos esenciales:

- Título;
- Año;
- Tipo;
- Fecha de exclusión;
- Restaurar.

Búsqueda local/servidor según implementación; 50 registros por página; orden por fecha de exclusión descendente; fecha desconocida al final.

## 8.3 Restaurar

Restaurar:

1. no readmite directamente;
2. crea/reactiva candidato de Novedades;
3. mantiene el guard necesario para evitar admisión automática;
4. elimina la fila de la vista activa de Excluidas cuando la operación termina bien;
5. exige después decisión humana de `Añadir a PikoFilm` en Novedades.

Si falla, la exclusión permanece y la UI no muestra falso éxito.

---

# 9. Novedades

Ruta: `/novedades`.

## 9.1 Propósito

Centro único de admisión. Contiene sólo trabajo **pendiente de decisión o preparación**.

## 9.2 Regla de unicidad

```text
1 IMDb -> 1 candidato -> N orígenes/evidencias -> 1 decisión de admisión
```

Orígenes reconocibles:

- Manual;
- Plex;
- Discovery;
- Sagas;
- Personas.

El origen aporta contexto, no cambia el pipeline.

## 9.3 Mínimos para estar listo

Un candidato necesita:

- IMDb válido;
- título;
- tipo.

El año es útil pero no requisito estructural de Novedades.

## 9.4 Estados

### Lista

Tiene mínimos y espera decisión humana.

Acciones:

- Añadir a PikoFilm;
- Excluir;
- retirar origen manual cuando corresponda.

### Procesando

Existe una ejecución real activa intentando preparar mínimos. No se deriva de un flag antiguo sin ejecución.

### Atención

No hay ejecución activa y faltan mínimos o el último intento falló. Debe ofrecer una salida clara: reintentar o resolver manualmente cuando proceda.

## 9.5 Estados que no pertenecen a Novedades

- Catalogada;
- Excluida.

Al resolverse, el candidato desaparece de Novedades.

## 9.6 Orden y filtros

Orden inicial:

1. Lista;
2. Atención;
3. Procesando;
4. dentro del grupo, más reciente primero.

Filtros por estado y origen.

## 9.7 Discovery

Discovery IMDb:

- lanzamiento manual;
- máximo una vez cada 7 días;
- la UI muestra última ejecución y próxima disponibilidad;
- ejecución observada y despachada a GitHub Actions.

## 9.8 Excluir

Excluir bloquea globalmente el IMDb. No es lo mismo que retirar sólo la evidencia manual.

## 9.9 Añadir a PikoFilm

Al admitir:

1. crea la obra con mínimos;
2. conserva evidencias/orígenes relevantes;
3. retira el candidato;
4. mantiene vínculo Plex si ya se conoce;
5. inicia la continuación automática del Lifecycle de forma durable;
6. el usuario permanece en Novedades.

## 9.10 Un Lifecycle automático ordinario a la vez

Antes de admitir un nuevo título debe comprobarse que no existe otra continuación de Lifecycle incompatible ya `queued/running` según el contrato vigente. Si existe:

- no se crea la película;
- el candidato sigue en Lista;
- se informa del bloqueo funcional;
- el usuario reintenta cuando el anterior termine.

## 9.11 Continuación automática

La continuación avanza por procesos canónicos hasta:

- completo;
- revisión humana;
- bloqueo funcional real;
- error no recuperable automáticamente.

No repite indefinidamente una fase sin progreso.

---

# 10. Calidad

Ruta principal: `/calidad`.

## 10.1 Propósito

Centro de **salud funcional y decisiones humanas**.

Calidad responde:

- qué está bien;
- qué está en seguimiento automático;
- qué necesita decisión humana.

No responde cómo se ejecutó técnicamente: eso pertenece a Operaciones.

## 10.2 Estados transversales

### Requieren atención

Intervención humana real.

### En seguimiento automático

El sistema tiene trabajo/retry/mantenimiento pendiente, pero no necesita un click humano para continuar.

### Al día

No existe anomalía funcional ni trabajo humano pendiente. Puede existir próxima fecha de mantenimiento.

## 10.3 Arquitectura de Calidad

Modelo híbrido:

- hub `/calidad`;
- Centro común para Identidad/Validación, Datos, Personas, PikoQuality e Integridad Lifecycle;
- Películas como página especializada;
- Series como página especializada + ficha de detalle.

No existe una gran cola transversal obligatoria.

---

# 11. Calidad — Identidad y validación

## 11.1 Identidad

Una identidad validada es estable:

- no expira por tiempo;
- no entra en mantenimiento periódico;
- sólo se reabre mediante corrección explícita o invalidación funcional real.

## 11.2 Resolución automática

`PROC-ID-001` resuelve TMDb desde IMDb. Puede ejecutarse individual o Batch usando el mismo core.

## 11.3 Evidencia y validación

`PROC-IV-001` obtiene evidencia; `PROC-IV-002` valida. Batch evita absorber estados que requieren decisión humana.

## 11.4 Correcciones manuales

Incluyen:

- corregir IDs;
- invalidar/reobtener evidencia;
- aceptar/revertir decisión;
- forzar asociación excepcional.

Son decisiones humanas observadas y no deben masificarse automáticamente.

---

# 12. Calidad — Datos, ratings y PikoScore

## 12.1 Datos estructurales

`DATA-001` es **fill missing**:

- actúa sobre huecos reales;
- no sustituye un valor presente por discrepancia de proveedor;
- no se ejecuta periódicamente por antigüedad.

## 12.2 Correcciones manuales

Un valor incorrecto y un valor ausente son problemas diferentes. Un valor manual protegido prevalece hasta `Volver a automático`.

## 12.3 Ratings

Cadencia adaptativa desde estreno:

- <3 meses: 14 días;
- <1 año: 30 días;
- <3 años: 90 días;
- <10 años: 180 días;
- resto: 365 días.

La deuda histórica se absorbe progresivamente; no se reinician timestamps para forzar una tormenta de llamadas.

## 12.4 PikoScore

Sólo se recalcula si:

- cambian ratings/inputs;
- el Lifecycle lo requiere;
- el usuario lo fuerza de forma individual.

No se recalcula por costumbre si el refresco no cambió datos.

## 12.5 Discrepancias de fuentes

PikoFilm no crea automáticamente una cola humana porque IMDb/FA/TMDb discrepen. Se distingue falta de dato, error de dato y diferencia entre fuentes.

---

# 13. Calidad — Películas

Ruta: `/calidad/peliculas`.

## 13.1 Propósito

Validación física y atención sobre archivos de películas.

## 13.2 Disparo

Una película con archivo Plex nuevo/cambiado debe pasar por `MOV-001`.

## 13.3 Resultado

- correcto -> continúa el circuito funcional;
- anomalía real -> aparece en Calidad Películas;
- sin archivo Plex -> no se exige validación física.

## 13.4 Deuda histórica

La deuda histórica no se borra artificialmente; se procesa progresivamente.

## 13.5 Decisiones

`MOV-002` puede aceptar un finding como excepción cuando procede. La decisión se liga a evidencia/fingerprint válida.

## 13.6 Ya la corregí

El reset tras corrección física conserva la semántica completa de reprocesado necesaria; no se sustituye por una falsa reparación parcial.

## 13.7 Desaparición de Plex

No elimina la obra. Se actualiza estado físico y puede invalidar análisis derivados.

---

# 14. Calidad — Series

Rutas:

- `/calidad/series`;
- `/calidad/series/[ratingKey]`.

## 14.1 Dos superficies

Listado para triage rápido; ficha para diagnóstico de temporadas/episodios.

## 14.2 Triggers

Series se revisa por:

- cambio Plex detectado tras sync manual global;
- vencimiento `next_check_at` TMDb;
- UNKNOWN de disponibilidad España;
- acción individual explícita.

## 14.3 Sync Plex

El usuario inicia el sync global. Si una serie cambió, el detalle Plex se procesa automáticamente. `Actualizar Plex` individual sigue disponible como control forzado, no como requisito ordinario.

## 14.4 Cadencia TMDb

- en emisión con próxima fecha: alrededor de `next_air_date`;
- en emisión sin fecha: 7 días;
- estado incierto: 30 días;
- finalizada <2 años: 6 meses;
- finalizada 2–10 años: 1 año;
- finalizada estable >10 años: 3 años.

Un cambio Plex puede invalidar/reabrir lo necesario.

## 14.5 Próximos episodios

Un episodio futuro es información. No cuenta como faltante.

## 14.6 Disponibilidad España

`UNKNOWN` se vuelve a comprobar automáticamente tras 14 días. La disponibilidad confirmada no se consulta cada 14 días de forma perpetua; se reactiva cuando cambia evidencia relevante.

Una temporada completa en Plex puede evitar consultas de disponibilidad innecesarias mientras siga completa.

## 14.7 Gate de faltante

Para declarar un episodio `Falta` no basta con que TMDb diga que ya se emitió. Debe existir evidencia suficiente de exigibilidad/disponibilidad en España y ausencia física real.

## 14.8 Reconciliación

Automático cuando es demostrable:

- matches inequívocos;
- archivos combinados que cubren episodios oficiales.

Manual cuando hay varias interpretaciones razonables. No se adivina.

## 14.9 Overrides

Una decisión manual persiste mientras no cambie la evidencia que la sustenta. Debe poder reabrirse o volver a automático.

## 14.10 Estados

- Atención = necesita humano;
- Seguimiento automático = el sistema está trabajando o esperando ventana;
- Al día = sin anomalía funcional.

---

# 15. Personas

Rutas:

- `/personas`;
- `/personas/[id]`.

## 15.1 Propósito

Descubrimiento cinematográfico a partir de personas relevantes en el universo PikoFilm.

## 15.2 Ranking inicial

`Destacados · Relevancia`.

La relevancia interna combina:

- presencia real en PikoFilm/Plex;
- cantidad de obras relevantes con rendimientos decrecientes;
- calidad/PikoScore con confianza por tamaño de muestra;
- popularidad persistida como señal secundaria.

No se muestra una “nota de relevancia” nueva al usuario.

## 15.3 Tabla

Campos principales:

- Persona;
- Rol;
- Filmografía relevante;
- PikoScore medio;
- En Plex;
- Fuera de PikoFilm.

## 15.4 Créditos secundarios

No contaminan el ranking principal. Ejemplos de clasificación secundaria:

- `self_or_archive`;
- `bonus_or_special`;
- `short`;
- otros descartes canónicos.

`Otros créditos` sigue consultable con motivo.

## 15.5 Ficha

Separa:

- obras relevantes en PikoFilm;
- obras relevantes fuera de PikoFilm;
- otros créditos.

La filmografía se ordena por año descendente y después por señal persistida de popularidad.

## 15.6 Enviar a Novedades

Una obra externa identificada puede convertirse en origen/evidencia de Novedades. No se admite automáticamente.

## 15.7 Refresco

Abrir/buscar/filtrar Personas es sólo lectura. El refresco de persona es explícito o programado.

Cadencia adaptativa:

- activa/reciente: 30 días;
- menos reciente: 90 días;
- años sin trabajos: 1 año;
- fallecida/inactiva desde hace muchos años: 3 años.

Se reutiliza `filmography_refreshed_at`; no se resetea historia.

---

# 16. Sagas

Rutas:

- `/sagas`;
- `/sagas/[collectionId]` o identificador equivalente persistido.

## 16.1 Propósito

Comprender una colección, su composición, su cobertura PikoFilm y su presencia física Plex.

## 16.2 Estados físicos

- Completa en Plex;
- Parcial en Plex;
- Sin Plex.

Nunca `Sin empezar` o `En progreso` de visionado.

## 16.3 Denominador de completitud

Sólo cuentan títulos:

- admitidos en PikoFilm;
- actualmente exigibles físicamente.

No penalizan:

- fuera de PikoFilm;
- futuros;
- todavía dentro de ventana cinematográfica/no doméstica.

## 16.4 Disponibilidad doméstica

Mientras no exista fecha doméstica canónica completa, se usa fallback conservador de 90 días desde estreno cuando no está ya en Plex.

- futuro/no released -> Próximamente;
- <90 días y no Plex -> En cines/no exigible;
- pasado el margen -> exigible;
- si ya está en Plex, Plex demuestra disponibilidad y prevalece.

## 16.5 Prioridad

Orden inicial por utilidad:

1. a una película de completar;
2. parciales;
3. completas;
4. sin Plex.

PikoScore/relevancia desempata dentro de grupos.

## 16.6 Listado

- 50 por página;
- búsqueda en URL;
- filtros Todas / A una película / Parciales / Completas / Sin Plex;
- alternativas de orden por PikoScore, presencia Plex, pendientes, nombre.

## 16.7 Ficha

Cronología completa de miembros. Etiquetas por miembro:

- En Plex;
- Sin Plex;
- Fuera de PikoFilm;
- En cines;
- Próximamente.

Los títulos del catálogo abren Ficha. Los externos pueden ir a Novedades.

## 16.8 PikoScore de saga

Independiente de Plex. Sólo agrega obras admitidas y exigibles.

## 16.9 Actualización

- lectura normal: sólo Neon;
- actualizar una saga: explícito;
- refresco global: Batch/Railway canónico;
- navegación normal: nunca dispara TMDb.

---

# 17. PikoQuality

## 17.1 Propósito

Medir calidad técnica/física, separada de PikoScore.

## 17.2 Vigencia

No expira por calendario. Se invalida por:

- archivo nuevo;
- archivo cambiado;
- fingerprint técnico distinto;
- versión nueva de fórmula.

## 17.3 Automatización

Tras cambio físico relevante, la captura técnica y recálculo se encadenan según el circuito vigente.

## 17.4 Recalcular ahora

Se mantiene acción individual explícita.

## 17.5 Barridos globales

Los controles técnicos de barrido pertenecen a Operaciones/mantenimiento, no a la UX normal de Calidad.

## 17.6 Fallos

Retry automático espaciado. Sólo fallo persistente o decisión humana real se convierte en atención funcional.

---

# 18. Actividad

Ruta: `/actividad`.

## 18.1 Propósito

Historial y planificación **funcional, humana y comprensible** de PikoFilm.

Debe responder:

1. qué hizo PikoFilm;
2. qué resultado tuvo;
3. sobre qué entidad;
4. qué originó la acción;
5. qué ocurrirá después si existe un siguiente paso conocido.

## 18.2 Fuente

No existe `activity_logs` como verdad paralela. Actividad se deriva de observabilidad canónica y `process_plans` para futuro.

## 18.3 Cobertura

Incluye cambios funcionales manuales y automáticos de todos los dominios dentro de 30 días.

## 18.4 Cronología

Una única línea global con filtros:

- Todo;
- Catálogo;
- Plex;
- Calidad;
- Personas;
- Sagas;
- Novedades;
- Errores.

Puede buscar por entidad/texto funcional y filtrar por fecha.

## 18.5 Lenguaje

No muestra stacks, workers, leases ni códigos internos como contenido principal.

Ejemplos válidos:

- `Datos actualizados de Heat`;
- `Sincronización Plex completada`;
- `No se pudo completar la actualización; PikoFilm volverá a intentarlo`;
- `Comprobado: no había cambios`.

## 18.6 En curso

Una actividad relevante puede evolucionar:

```text
En curso -> resultado final
```

No se crean entradas duplicadas si la misma correlación puede actualizarse.

## 18.7 Agrupación

Procesos masivos/repetitivos pueden compactarse visualmente. La agrupación no elimina detalle funcional.

## 18.8 Correlación

Una acción origen puede agrupar consecuencias derivadas cuando existe correlación fiable. Si no es fiable, se muestran separadas.

## 18.9 Prioridad visual

- rutinario correcto -> compacto;
- cambios relevantes -> mayor énfasis;
- bloqueo/fallo/decisión -> prioridad.

## 18.10 Detalle funcional

Primero explica efecto y resultado. Después puede ofrecer `Ver detalle técnico en Operaciones`.

## 18.11 Retención

30 días de detalle funcional.

---

# 19. Calendario y planificación de Actividad

## 19.1 Horizonte

30 días:

- 0–7 días: detalle diario y por franja cuando aporta valor;
- 8–30: visión más agregada;
- >30: sólo eventos especiales de fecha fija cuando proceda.

## 19.2 Estados

Una demanda puede pasar por:

```text
Pendiente de planificar
 -> Planificada
 -> En curso
 -> Completada / Sin cambios / Parcial / Fallida / Cancelada
```

Si no se ejecuta en su ventana:

```text
Planificada -> Retrasada
```

## 19.3 Estimación de carga

No usa sólo número de tareas. Puede considerar:

- duración reciente;
- volumen;
- coste relativo por tipo;
- efectos derivados;
- histórico suficiente.

Se presenta como carga baja/media/alta y volumen funcional, no CPU/workers.

## 19.4 Autodistribución

PikoFilm puede mover automáticamente trabajo rutinario flexible dentro de una **ventana funcional segura**.

Nunca mueve automáticamente:

- fecha límite funcional;
- prioridad explícita;
- lock manual;
- pico deliberado;
- trabajo cuya semántica dependa de fecha/hora;
- casos donde exista duda razonable de seguridad.

## 19.5 Acciones del usuario

Desde calendario puede:

- cambiar prioridad;
- mover fecha/franja;
- bloquear/desbloquear;
- marcar pico deliberado.

Por defecto una edición recurrente afecta sólo a una ocurrencia; cambiar toda la recurrencia exige acción explícita.

## 19.6 Picos

Si incluso tras redistribuir lo flexible sigue existiendo una carga excesiva, Actividad avisa con antelación y permite:

- mantener el pico;
- posponer/reducir carga no prioritaria.

La capacidad técnica se diagnostica en Operaciones.

---

# 20. Operaciones

Ruta: `/admin` y detalle `/admin/runs/[id]`.

## 20.1 Propósito

Herramienta técnica/administrativa para localizar, explicar y recuperar ejecuciones. No es una segunda cronología de Actividad.

## 20.2 Entrada principal

Buscador técnico único. Puede localizar:

- IMDb ID;
- título;
- persona;
- `run_id`;
- Batch ID;
- código/nombre de proceso;
- error/clase/código;
- paso;
- fuente;
- texto técnico e identificadores presentes en contexto/eventos.

Filtros avanzados aparecen sólo cuando hacen falta.

## 20.3 Salud operativa

Franja compacta por excepción. Cuando todo está bien, resumen mínimo. Cuando algo requiere atención, destaca:

- motor Batch pausado;
- Batch detenido;
- worker/heartbeat problemático;
- leases vencidas;
- colas atascadas;
- scheduler/planificador sin ejecutar;
- fuente bloqueada/cuota;
- incidencias técnicas activas.

## 20.4 Error histórico vs incidencia activa

Un error histórico no desaparece porque se resuelva el problema.

Estados operativos:

- activa;
- autorresuelta por éxito posterior equivalente;
- resuelta/descartada manualmente.

La resolución manual no borra `process_run_errors`.

## 20.5 Agrupación de errores

Se agrupan conservadoramente por huella técnica estable: proceso/paso/código-clase/fuente/alcance cuando corresponda.

El grupo muestra:

- ocurrencias;
- primera/última;
- entidades afectadas;
- cuántas siguen activas.

## 20.6 Detalle de ejecución

Primero debe responder:

- qué se hizo;
- sobre qué;
- origen;
- si se completó;
- cómo terminó técnicamente;
- resultado funcional;
- estado final;
- incidencia activa/resuelta.

Después se ofrece detalle profundo:

- eventos/pasos;
- llamadas externas;
- entradas/salidas;
- errores;
- before/after;
- métricas;
- executor/trigger;
- retries;
- parent/children;
- Batch items;
- contexto/JSON técnico.

## 20.7 Navegación hermana

Actividad -> Operaciones conserva `run_id`/correlación. Operaciones puede volver a Actividad.

---

# 21. Centro de control de Operaciones

Se divide en cuatro bloques.

## 21.1 Sistema / Batch

Muestra:

- motor global;
- Batch activos/pausados/detenidos;
- progreso útil;
- concurrencia solicitada/efectiva;
- items queued/running/retry/failed;
- leases/heartbeats;
- reconciliación;
- políticas de retry relevantes.

Acciones sólo si el backend las soporta:

- pausar;
- reanudar;
- cancelar;
- otras recuperaciones específicas.

## 21.2 Fuentes y límites

Para TMDb/OMDb/MDBList cuando aplique:

- disponibilidad;
- uso/restante;
- concurrencia configurada;
- hard cap;
- valor efectivo;
- reparto Batch;
- breaker;
- `blocked_until`;
- rate limits/errores recientes.

La configuración visible debe corresponder al mecanismo que realmente usa el worker/core.

## 21.3 Recuperación

No existe `Reiniciar todo PikoFilm`.

La recuperación es contextual:

- título -> reset completo a Novedades cuando proceda;
- Batch -> pause/resume/cancel/retry válidos por estado;
- ejecución -> orientación/reintento canónico disponible;
- Lifecycle inconsistente -> reparación específica.

Cada acción explica alcance, exige confirmación proporcional al riesgo y queda observada.

## 21.4 Mantenimiento

Sólo operaciones reales con semántica clara. Antes de ejecutar se explica:

- qué toca;
- qué no toca;
- si modifica datos;
- reversibilidad;
- resultado esperado;
- forma de verificarlo.

No se exponen purgas/reconstrucciones destructivas sólo porque técnicamente sean posibles.

---

# 22. Gobierno de APIs

Fuentes gobernadas: TMDb, OMDb, MDBList.

Principio:

> Una llamada a una fuente gobernada sin `apiGate` debe fallar antes del fetch.

Manual y Batch usan la misma configuración persistida. Cada llamada adquiere permiso individual. El sistema distingue:

- valor configurado;
- hard cap;
- valor efectivo.

Una denegación por gobernanza es distinta de un error del proveedor.

---

# 23. Política de reintentos y fallos

## 23.1 Recuperables

- reintentos espaciados;
- nunca ráfagas agresivas;
- próximos intentos visibles funcionalmente cuando aporta valor;
- no convierten automáticamente el caso en tarea humana.

## 23.2 Persistentes

Al agotarse retry automático:

- Calidad muestra consecuencia funcional si requiere humano;
- Operaciones muestra causa técnica e historial;
- puede existir `Reintentar ahora` si es seguro.

## 23.3 Rate limits / gobierno

Se tratan como condición operativa específica, no como “dato no encontrado”. No deben activar falsos fallbacks que generen más llamadas.

---

# 24. Política de mantenimiento automático

## 24.1 Automático por calendario/evento

- ratings: cadencia adaptativa;
- Series TMDb: cadencia por estado/edad;
- Personas: cadencia por actividad;
- Series disponibilidad UNKNOWN: 14 días;
- PikoQuality: evento/fingerprint/fórmula;
- validación física: cambio Plex;
- Datos estructurales: hueco real.

## 24.2 No automático por antigüedad

- identidad ya validada;
- dato manual protegido;
- decisión editorial de admisión/exclusión;
- sync Plex global.

---

# 25. Matriz manual vs automática

| Acción | Manual | Automática | Observada | Puede requerir humano |
|---|---:|---:|---:|---:|
| Sync Plex global | Sí | **No** | Sí | No para iniciar |
| Procesar cambios tras sync | Forzable | Sí | Sí | Sólo anomalías |
| Resolver identidad | Forzable | Sí/Batch según estado | Sí | Si ambigua |
| Validar identidad | Forzable | Sí/Batch | Sí | Si review |
| Corregir IDs | Sí | No | Sí | Sí |
| Completar datos ausentes | Sí | Sí cuando hay hueco | Sí | Sólo excepciones |
| Refrescar ratings | Sí | Sí | Sí | Normalmente no |
| Recalcular PikoScore | Sí | Sí cuando procede | Sí | No |
| Validar archivo película | Sí | Sí tras cambio Plex | Sí | Si finding |
| Refrescar serie Plex | Sí | Sí tras cambio global | Sí | Si anomalía |
| Refrescar TMDb serie | Sí | Sí al vencer | Sí | Si ambigua |
| Comprobar disponibilidad ES | Sí | Sí para UNKNOWN | Sí | Si requiere decisión |
| Refrescar Persona | Sí | Sí planificado | Sí | Fallo persistente |
| Refrescar Saga individual | Sí | No al navegar | Sí | No ordinariamente |
| Refrescar Sagas global | Sí/Batch explícito | Según starter autorizado, no por render | Sí | Incidencias |
| PikoQuality individual | Sí | Sí por evento | Sí | Fallo persistente |
| Admitir título | Sí | No | Sí | **Sí** |
| Excluir | Sí | No | Sí | **Sí** |
| Restaurar exclusión | Sí | No | Sí | Sí para readmitir después |
| Resolver incidencia operativa | Sí | Auto por éxito posterior | Sí | Sí si se descarta manualmente |

---

# 26. Semántica de estados y lenguaje

## 26.1 Plex

Correcto:

- En Plex;
- Sin Plex;
- Falta episodio;
- Completa físicamente.

Incorrecto:

- Pendiente de ver;
- Sin empezar;
- En progreso de visionado.

## 26.2 Calidad

Correcto:

- Requiere atención;
- Seguimiento automático;
- Al día.

No se etiqueta como “error” una simple tarea automática pendiente.

## 26.3 Actividad

Correcto:

- Actualizado;
- Sin cambios;
- Necesita revisión;
- Se reintentará automáticamente;
- Falló y requiere atención.

## 26.4 Operaciones

Puede usar lenguaje técnico, pero el resumen inicial debe ser comprensible antes de desplegar JSON/códigos.

---

# 27. Retención funcional y técnica

30 días de detalle en Actividad y Operaciones.

Se conserva más allá de esa ventana cuando es **estado actual**, no mero histórico:

- catálogo;
- exclusiones vigentes;
- decisiones/overrides vigentes;
- Lifecycle;
- Batch activo;
- planner vigente;
- snapshots/agregados necesarios;
- estado de fuente/breaker vigente.

---

# 28. Reglas de recuperación

## 28.1 Título

El reset completo a Novedades es una intervención destructiva funcional y debe:

- mostrar el IMDb afectado;
- explicar qué datos/estado se invalidan;
- requerir confirmación explícita;
- preservar lo que el contrato de reset declara persistente;
- no iniciar automáticamente un nuevo procesamiento opaco;
- quedar observado.

## 28.2 Incidencias

`Descartar/Marcar resuelto` sólo cambia atención operativa. Nunca borra el error original.

## 28.3 Lifecycle inconsistente

La reparación de “sin estado” es excepcional. No se usa como cola genérica de mantenimiento.

---

# 29. Rendimiento funcional esperado

- Catálogo, Personas, Sagas y fichas normales leen persistencia; no hacen fanout externo por abrir.
- Listados grandes se paginan en servidor.
- Filtros se aplican cerca de PostgreSQL.
- Personas sólo hidrata agregados para la página visible.
- navegación usa `NoPrefetchLink` para evitar requests especulativos masivos.
- Actividad y Operaciones consultan ventanas acotadas de 30 días.
- detalle pesado se carga al navegar/abrir, no en todas las filas.

---

# 30. Criterio de aceptación de una nueva función

Una nueva función no se considera correctamente integrada hasta que se pueda responder:

1. ¿Qué problema funcional resuelve?
2. ¿En qué superficie vive?
3. ¿Cuál es su entidad/alcance?
4. ¿Qué `PROC` la representa, si es una mutación?
5. ¿Qué core canónico ejecuta?
6. ¿Puede lanzarse manual/Batch/automático?
7. ¿Qué estado escribe?
8. ¿Cómo afecta Lifecycle?
9. ¿Qué ve el usuario en Actividad?
10. ¿Qué ve el administrador en Operaciones?
11. ¿Cómo falla y reintenta?
12. ¿Respeta overrides/decisiones humanas?
13. ¿Qué fuentes externas usa y cómo se gobiernan?
14. ¿Qué pruebas de contrato lo protegen?
15. ¿Qué documentación canónica cambia?

---

## 31. Fuentes especializadas que siguen vigentes

Este documento es la autoridad funcional global. Para ejecución exacta:

- `docs/processes/PROCESS_CATALOG.md` — procesos y cores;
- `docs/processes/BATCH_ARCHITECTURE.md` — orquestación Batch;
- `docs/V4_ARCHITECTURE.md` — arquitectura técnica;
- `docs/V4_UX_SPEC.md` — experiencia y presentación;
- `docs/operations/RUNBOOK.md` — procedimientos operativos.

Los antiguos contratos V4 por vertical quedan reemplazados por este documento y permanecen disponibles en el historial Git.