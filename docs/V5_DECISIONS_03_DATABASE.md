# PikoFilm V5 — Decisiones Punto 3 · Base de datos y modelo de datos

Fecha: 2026-09-18

Documento canónico de decisiones de la Fase 2 del Punto 3. Cada propuesta se revisa individualmente con el usuario y debe quedar persistida antes de presentar la siguiente.

## DB-01 — Contrato único de retención por clase de dato

**Estado: APROBADA**

### Decisión

V5 definirá una política central de retención para todas las tablas, en lugar de depender de que cada módulo implemente o recuerde su propia limpieza.

Clasificación base:

- **Foto actual / estado vigente:** no caduca automáticamente y nunca puede desaparecer por una purga de histórico.
- **Dato canónico / decisiones manuales vigentes:** sin TTL automático salvo regla funcional explícita.
- **Histórico operativo, runs, logs y eventos técnicos:** 30 días por defecto; el usuario no necesita conservar históricos antiguos si ya no aportan valor operativo.
- **Auditoría funcional relevante:** retención explícita según necesidad, sin depender accidentalmente de la vida de un log técnico.
- **Read models / cachés reconstruibles:** política propia, reconstruibles desde fuentes canónicas.
- **Snapshots y raw payloads técnicos:** TTL definido por utilidad real y coste.

### Invariante aprobada por el usuario

> Cualquier histórico puede purgarse tras X días; lo que debe quedar garantizado es la foto actual. La foto actual nunca puede desaparecer.

Esta condición es obligatoria en el diseño V5: ningún estado vigente puede existir únicamente como consecuencia de conservar histórico. Si una superficie necesita una foto actual, ésta debe tener representación persistente o ser reconstruible de forma determinista desde datos canónicos que no estén sujetos a la purga del histórico.

### Alcance esperado

- un único mecanismo de housekeeping incremental y seguro;
- contratos de retención documentados por clase de dato/tabla;
- protección explícita de estado actual, decisiones manuales y datos canónicos;
- visibilidad operativa de cumplimiento de retención, volumen purgable y espacio recuperable;
- eliminación segura de históricos sin degradar la foto actual ni la capacidad funcional del sistema.

### Límites

- Esta decisión no autoriza ninguna purga inmediata ni modificación de datos históricos en Neon.
- No implica que todos los datos tengan 30 días de TTL; 30 días es el valor por defecto para histórico operativo/técnico.
- No se debe borrar un histórico si todavía es la única fuente de una verdad funcional vigente; antes deberá existir una fuente actual/canónica separada.

### Motivo

La auditoría detectó que la retención de 30 días está bien implementada en algunas tablas (`process_runs` y dependencias, `process_plans`) pero no existe un contrato global. Al mismo tiempo, observabilidad e históricos ya representan una fracción material del almacenamiento. Centralizar la política permite controlar coste y crecimiento sin comprometer el estado actual del producto.

## DB-02 — Personas canónicas: sólo profesionales consolidados y sólo películas reales con IMDb

**Estado: APROBADA**

### Decisión funcional

La filmografía de Personas deja de ser una copia amplia de `movie_credits` de TMDb. PikoFilm sólo persistirá la filmografía que tenga utilidad real para el producto.

Principios obligatorios:

1. **Sólo personas consolidadas.** Una persona sólo entra en el enriquecimiento completo de filmografía cuando supera el umbral canónico de relevancia dentro de PikoFilm: más de 5 películas distintas del catálogo como actor o más de 5 como director.
2. **Corregir directores.** La regla debe reconocer la representación real `credit_type='director'` además del legacy `credit_type='crew' AND job='Director'`. La auditoría detectó 544 directores que la regla actual deja fuera por esa inconsistencia, con ejemplos claros como Steven Spielberg, Ridley Scott, Pedro Almodóvar, Tim Burton o Brian De Palma.
3. **Sólo películas reales.** Conciertos grabados, representaciones teatrales, ceremonias, eventos deportivos, recopilatorios de programas, especiales televisivos, making-of, featurettes, cortos y equivalentes no forman parte de la filmografía útil de PikoFilm.
4. **IMDb obligatorio.** Si una obra no tiene un `imdb_id` resuelto, queda fuera. No se persiste como filmografía porque no puede incorporarse de forma útil al flujo de catálogo de PikoFilm. Si en un refresco posterior consigue IMDb y además cumple el resto de reglas, podrá entrar entonces.
5. **El género aislado no excluye.** Documental, Música o Película de TV no implican por sí mismos basura. Una película legítima de esos géneros se conserva si cumple las reglas. En especial, `movie` y `tvMovie` pueden ser válidos; tipos estructurales como `short`, `tvSpecial`, `tvEpisode`, `tvSeries` o equivalentes no cinematográficos deben quedar fuera.
6. **El título por sí solo no decide.** No se autoriza una regex simple como criterio suficiente de exclusión, porque se comprobaron falsos positivos reales (`Love Live! The School Idol Movie`, `Festival de la Canción de Eurovisión: La historia de Fire Saga`, títulos con “Oscar”, etc.). La clasificación debe apoyarse prioritariamente en tipo/identidad de IMDb y metadata estructurada de TMDb/IMDb.
7. **El crédito también debe ser útil.** Aunque la obra sea una película válida, no se conserva una relación de persona cuyo papel sea `Self`, `Himself/Herself`, `archive footage`, `host`, `presenter`, `interviewee/interviewer`, `contestant`, `participant` o equivalente no interpretativo. Un narrador o una voz de personaje sí puede ser un crédito cinematográfico legítimo.
8. **El catálogo no salta la regla.** Que una película pertenezca al catálogo PikoFilm no puede convertir automáticamente un crédito basura en filmografía válida. La película puede permanecer correctamente en el catálogo y, al mismo tiempo, no aparecer en la filmografía de una persona que sólo figura como `Self`/archivo/host.
9. **“Otros créditos” desaparece.** El frontend de Personas no tendrá una sección ni un contador de “Otros créditos”. Los contenidos rechazados no se muestran y tampoco se conservan en la base como filmografía secundaria.
10. **No habrá papelera de descartados.** El sistema podrá conservar métricas agregadas de cada refresco (por ejemplo, cuántos créditos se descartaron por no tener IMDb o por ser un especial), pero no persistirá las filas completas rechazadas. Esta decisión es coherente con DB-01: son datos derivados sin utilidad actual.

### Modelo de datos objetivo

La implementación V5 deberá normalizar los dos conceptos que hoy conviven en `person_filmography`:

- una entidad de **obra/filmografía** que almacene una sola vez la identidad y metadata compartida de la película (`tmdb_movie_id`, `imdb_id`, título, año, fecha, póster, duración, géneros, popularidad/frescura que se decida conservar);
- una entidad de **relación persona ↔ obra** que almacene únicamente lo específico del crédito (`tmdb_person_id`, referencia a obra, tipo de crédito, personaje/job, orden y cualquier señal funcional necesaria).

No debe repetirse el título, año, póster, géneros y demás metadata de una misma película una vez por cada actor/director relacionado.

La filmografía resultante sigue siendo un dato derivado/reconstruible desde fuentes externas, pero la **foto actual aceptada** de cada persona elegible debe persistir de forma clara y no depender de conservar descartes o históricos.

### Evidencia cuantitativa observada en Neon

Foto analizada antes de la implementación:

- `person_filmography`: 549.892 filas y ~204 MB totales.
- Sólo 9.563 de 144.866 personas tienen filmografía enriquecida.
- Existen 176.116 obras distintas representadas dentro de esas 549.892 filas, evidencia de repetición material de metadata por persona.
- Ya estaban marcadas como rechazadas 73.630 filas `short`, 52.364 `self_or_archive` y 355 `bonus_or_special`: 126.349 filas que no deben migrar al modelo V5.
- Entre los créditos actualmente etiquetados `feature_film`, 103.742 obras TMDb distintas estaban presentes y 6.791 no tenían IMDb resuelto; esas obras sin IMDb quedan fuera por decisión del usuario. Se observaron 11.321 relaciones `feature_film` asociadas a esas obras sin IMDb. Estas cifras pueden solaparse con otros criterios de descarte y no deben sumarse ciegamente para calcular una purga final.
- Una pasada conservadora por señales inequívocas detectó al menos 677 obras adicionales hoy tratadas como `feature_film` que parecen conciertos/eventos/representaciones/recopilatorios no cinematográficos, afectando 1.260 créditos. Es un suelo de limpieza, no una lista definitiva.
- Dentro de relaciones protegidas hoy por razón `catalog` se observaron 1.152 créditos con señales `Self/archive/host/...`, correspondientes a 484 obras: pertenecer al catálogo no debe seguir blindando esas relaciones basura.
- Se detectaron 82 obras de catálogo de menos de 60 minutos asociadas a 422 relaciones. DB-02 puede excluir esas relaciones de Personas; cualquier decisión de retirar esas obras del catálogo maestro pertenece a la auditoría/decisión del dominio de catálogo y no se ejecutará implícitamente desde Personas.

### Impacto obligatorio de implementación

La futura implementación de DB-02 **no es un cambio aislado de esquema**. Debe modificar y probar de forma coordinada todos estos planos:

#### 1. Base de datos y migración hacia atrás

- crear el nuevo modelo normalizado mediante migraciones `db/migrations/` siguiendo el workflow branch-first de Neon;
- construir las nuevas tablas a partir del histórico actual aplicando el clasificador V5 desde el primer backfill;
- **no copiar** al modelo nuevo créditos ya rechazados, obras sin IMDb ni nuevos tipos de basura confirmados;
- conservar la tabla/modelo anterior temporalmente como red de seguridad durante la transición;
- comparar conteos y contenido persona por persona antes del corte;
- medir `pg_total_relation_size` antes/después para conocer el ahorro real, sin inventar una cifra a priori;
- cambiar consumidores al modelo nuevo antes de retirar el antiguo;
- retirar la estructura antigua y liberar su almacenamiento sólo tras validación funcional y autorización expresa del usuario.

#### 2. Proceso automático `PROC-PER-001` / Batch / worker

- usar una única regla canónica de elegibilidad de persona;
- corregir la detección de directores;
- clasificar la obra antes de persistirla;
- exigir `imdb_id` resuelto antes de insertar una obra en filmografía;
- descartar antes de escritura cortos, especiales, conciertos, teatro filmado, eventos, recopilatorios y demás no-películas confirmadas;
- descartar relaciones `Self/archive/host/...` incluso cuando la obra esté en el catálogo;
- escribir sólo el conjunto aceptado y reemplazar/refrescar la foto actual de forma idempotente;
- registrar métricas agregadas de aceptación/descarte sin conservar payload de basura;
- mantener la política adaptativa de refresco, pero sobre el nuevo universo aceptado.

#### 3. Refresco manual de Persona

- la acción manual debe usar exactamente la misma regla que el Batch; no puede existir un camino alternativo que permita enriquecer un junior o guardar basura que el automático rechaza;
- el usuario podrá refrescar una persona elegible, pero la acción no saltará el umbral ni el clasificador;
- si una obra antes descartada por falta de IMDb obtiene IMDb posteriormente, un refresco podrá incorporarla si supera todas las demás reglas.

#### 4. Frontend / UX de Personas

- eliminar la sección, pestaña, contador y cualquier texto de **“Otros créditos”**;
- mostrar exclusivamente filmografía aceptada;
- actualizar conteos, filtros, cabeceras, estados vacíos y cualquier métrica que hoy dependa de `is_pikofilm_relevant=false`;
- no presentar al usuario descartes técnicos salvo, si aporta valor operativo en Calidad, un resumen agregado y comprensible de la última actualización.

#### 5. Lecturas y APIs internas

- `getPersonV2`, dashboard de Personas, Calidad de Personas y cualquier consumer de `person_filmography` deben migrar al contrato nuevo;
- ninguna consulta debe volver a asumir que la tabla contiene dos universos “relevante” y “otros”; el universo persistido ya será el aceptado;
- si se conserva una vista de compatibilidad durante la transición, debe ser temporal y no convertirse en una segunda fuente de verdad.

#### 6. Tests y gates

Deben existir pruebas contractuales como mínimo para:

- persona con 1–5 películas: no elegible;
- actor con >5: elegible;
- director `credit_type='director'` con >5: elegible;
- obra sin IMDb: no persiste;
- `movie`/`tvMovie` legítima con IMDb: puede persistir;
- `short`, concierto, teatro filmado, evento deportivo, ceremonia, recopilatorio/especial: no persiste;
- película legítima cuyo título contenga palabras como `live`, `festival` u `Oscar`: no se excluye sólo por el título;
- `Self/archive/host/...`: relación descartada aunque la película pertenezca al catálogo;
- voz/personaje/narrador legítimo: no se elimina por exceso de agresividad;
- desaparición completa de “Otros créditos” de la UX y de sus conteos;
- paridad funcional del resto de datos de la ficha de Persona tras migrar;
- refresco repetido idempotente sin recrear basura ni multiplicar obras.

#### 7. Observabilidad y transición

Durante migración y primeros refrescos debe poder verse, al menos:

- personas evaluadas/elegibles/no elegibles;
- obras recibidas de fuente;
- obras aceptadas;
- descartadas por `missing_imdb`;
- descartadas por tipo no cinematográfico;
- descartadas por duración/corto;
- descartadas por tipo de crédito (`Self/archive/...`);
- errores de identidad/metadata;
- tamaño del modelo antes/después y evolución posterior.

Estas métricas son de control; no justifican conservar las filas rechazadas.

### Plan de limpieza de datos actuales

La limpieza no se hará mediante un `DELETE` masivo improvisado sobre `person_filmography`.

Secuencia aprobada conceptualmente:

1. crear el nuevo modelo en una rama temporal de Neon;
2. ejecutar el clasificador V5 sobre los datos existentes;
3. backfill únicamente de obras con IMDb y créditos aceptados;
4. validar conteos, personas y ejemplos reales contra la tabla anterior;
5. probar frontend, Calidad y procesos automáticos contra el nuevo modelo;
6. medir tamaño/índices y revisar divergencias;
7. desplegar el código que lee/escribe el modelo nuevo siguiendo el flujo habitual;
8. validar producción;
9. sólo entonces, y con autorización expresa del usuario para la mutación histórica, retirar la estructura antigua y recuperar el espacio asociado.

La futura migración deberá permitir rollback durante la transición. No se autoriza una pérdida irreversible del modelo antiguo antes de haber demostrado paridad de la foto útil.

### Límites de la aprobación

- **DB-02 queda aprobada como diseño V5.**
- Esta aprobación **no autoriza todavía** ejecutar `DELETE`, `TRUNCATE`, `DROP`, backfill destructivo ni otra mutación de datos históricos en Neon Production.
- Cuando llegue la implementación, cualquier retirada física del histórico antiguo se probará primero branch-first y se pedirá autorización explícita antes de aplicarla a producción.
- La decisión no ordena retirar del catálogo maestro una película que falle las reglas específicas de filmografía de Personas; sólo determina qué se conserva como filmografía de Persona.

### Resultado de producto esperado

Personas dejará de almacenar y enseñar “todo lo que TMDb llama crédito”. Una persona consolidada tendrá una filmografía limpia de **películas reales, identificables por IMDb y útiles para PikoFilm**. Un junior seguirá existiendo correctamente en reparto/créditos de las películas del catálogo, pero no generará una filmografía externa completa. Los descartes no llenarán la base ni aparecerán en el frontal.
