# V4 · Calidad

Estado: **contrato funcional cerrado + arquitectura UX elegida (75/75)**.

Este documento es la fuente canónica de continuidad para Calidad V4. Se creó tras una pérdida de contexto visible del chat el 2026-09-09 para que ninguna decisión vuelva a depender de memoria conversacional.

## Regla de procedencia de esta recuperación

- **D1–D24** se recuperan con trazabilidad conversacional directa/retención de contexto y contraste con el código vivo.
- **D25–D73** restauran el **estado semántico aprobado al cierre funcional**. La transcripción literal intermedia dejó de estar disponible en el chat; por tanto aquí se preserva el contrato funcional, no se pretende reconstruir palabra por palabra el texto perdido. **No se añade comportamiento nuevo** por esta recuperación.
- **D74–D75** corresponden a la fase UX posterior al cierre funcional. La elección final confirmada es el **modelo híbrido**.
- Si una transcripción histórica reapareciese y hubiera una diferencia puramente verbal, se podrá ajustar la redacción. Cualquier diferencia funcional exige una decisión explícita del usuario; nunca se corrige silenciosamente este contrato.

## Propósito

Calidad es el **centro de salud funcional y decisiones humanas** de PikoFilm. La automatización mantiene el sistema; Calidad enseña lo que merece seguimiento funcional y, sobre todo, lo que realmente necesita una decisión. Operaciones conserva la traza técnica, ejecución, errores y mantenimiento de infraestructura.

PikoFilm sigue siendo la BBDD/colección maestra. Plex sólo gobierna presencia física y reproducción; que algo no esté en Plex no significa que deba eliminarse del catálogo ni que sea contenido “pendiente de ver”.

# Ledger de decisiones recuperado

## Fundamentos, mantenimiento y frescura

**D1 — Rol de Calidad.** Calidad V4 es el centro de salud funcional + decisiones humanas. Debe distinguir resolución automática, seguimiento funcional y verdadera intervención del usuario. Operaciones contiene el detalle técnico.

**D2 — No convertir mantenimiento en trabajo manual.** Tras limpiar la deuda histórica, Calidad no será una cola manual de mantenimiento. La deuda real heredada de Películas se conserva y se resuelve progresivamente; Lifecycle debe impedir que vuelva a generarse una deuda comparable.

**D3 — Mantenimiento automático por dominio.** Los dominios que envejecen o cambian externamente se actualizan automáticamente. Cada tipo de dato tiene su propia política de cadencia/eventos.

**D4 — Fallos y reintentos.** Un fallo automático permanece en su dominio con reintentos espaciados —horas/días, nunca una ráfaga inmediata—. Mientras reintenta se muestra de forma simple; al agotarse, se muestra fallo persistente, intentos, última/próxima referencia temporal, `Reintentar ahora` y acceso opcional al detalle técnico. No se fijaron intervalos numéricos exactos en la decisión funcional.

**D5 — No existe una frescura global.** La frescura se define por naturaleza de dato y combina tiempo, cambios de evidencia y eventos del sistema.

## Series · referencia, Plex, TMDb y disponibilidad

**D6 — Dos disparadores de Series.** Series se revisa cuando cambia la evidencia Plex y también por mantenimiento externo TMDb aunque Plex no cambie. La detección de cambios Plex depende del sync global manual definido en D20.

**D7 — Frescura inteligente de Series.** Se conserva `next_check_at`, la invalidación por cambios Plex y el diagnóstico basado en confianza de referencia. El usuario sólo debe entrar cuando quede una anomalía real; los controles individuales siguen disponibles.

**D8 — Cadencia TMDb de Series.** En emisión con próxima fecha conocida: alrededor de `next_air_date`; en emisión sin próxima fecha: 7 días; incierta/desconocida: 30 días; finalizada hace menos de 2 años: 6 meses; finalizada hace 2–10 años: 1 año; finalizada estable hace más de 10 años: 3 años. Un cambio Plex rompe el calendario cuando corresponda.

**D9 — Ratings automáticos.** Cuando ratings están vencidos se ejecuta la actualización canónica; sólo si cambian ratings se recalcula PikoScore. Se conservan los controles individuales.

**D10 — Cadencia de ratings.** Antigüedad desde estreno: <3 meses → 14 días; <1 año → 30 días; <3 años → 90 días; <10 años → 180 días; resto → 365 días. Se reutilizan timestamps históricos; no existe reset artificial a día cero. La deuda antigua se procesa progresivamente y con límite de carga.

**D11 — Filmografía de Personas adaptativa.** Activa/reciente → 30 días; menos reciente → 90 días; años sin trabajos → 1 año; fallecida/inactiva desde hace muchos años → 3 años. Se conserva `filmography_refreshed_at`, se planifica progresivamente y siempre existe refresco individual.

**D12 — PikoQuality dirigido por eventos.** PikoQuality no caduca por calendario: se recalcula con nuevo archivo físico, cambio de fingerprint técnico o cambio de versión de fórmula. No se usa C6 como tarea manual ordinaria. Se conserva `Recalcular ahora` individual.

**D13 — Disponibilidad España por temporada.** Se conserva `checked_at/state/source/confidence/manual`. `UNKNOWN` vuelve a comprobarse automáticamente tras 14 días. Una disponibilidad confirmada no se consulta cada 14 días; se reactiva cuando cambia la referencia, aparecen temporadas/episodios o la evidencia queda invalidada. Las correcciones manuales están protegidas.

**D14 — Datos estructurales sin caducidad periódica.** DATA-001 se ejecuta por hueco real: título nuevo incompleto, proceso que detecta un campo obligatorio ausente o pérdida/invalidación de evidencia. No se usa para sustituir valores ya existentes.

**D15 — Correcciones estructurales manuales protegidas.** Una corrección manual no puede ser sobrescrita silenciosamente por una fuente externa. Un desacuerdo puede mostrarse como información. `Volver a automático` elimina explícitamente el override.

**D16 — Identidad validada no tiene mantenimiento.** Una identidad válida permanece válida. No expira ni entra en revisión periódica. Sólo vuelve a tocarse mediante una corrección explícita.

## Películas · presencia física y validación

**D17 — Validación física de películas.** Toda película con archivo físico Plex que entra por Novedades/Lifecycle pasa por validación física. Sin archivo Plex se salta esa fase. Un archivo que aparece después o cambia se vuelve a analizar. Se conserva la deuda histórica y la acción individual `Analizar película`. Este comportamiento ya existía PRE-V4 y V4 lo conserva/restaura, no lo presenta como una función nueva.

**D18 — Enlace Plex → PROC-MOV-001.** Cuando el sync manual Plex detecta un archivo nuevo o un cambio físico relevante, PROC-MOV-001 se dispara automáticamente. Si todo es correcto continúa hacia PikoQuality; si hay anomalía queda en Calidad → Películas. La acción manual individual se conserva.

**D19 — `Ya la corregí` mantiene el reset completo.** No se sustituye por una reparación parcial. Una corrección de asociación o del archivo reinicia el procesamiento funcional y deja que el siguiente sync Plex/Novedades reconstruya el estado limpio, preservando identidad/evidencias operativas que deban persistir.

## Series · automatización posterior al sync

**D20 — Sync Plex global manual.** No existe polling Plex programado. El usuario añade/modifica en Plex y pulsa `Sincronizar Plex`. Desde ese instante, el procesamiento de las series afectadas es automático: detalle Plex, reconciliación de episodios y recálculo de Calidad. Se mantiene `Actualizar Plex` individual.

**D21 — TMDb automático al vencer.** Cuando llega `next_check_at`, PikoFilm refresca TMDb sin esperar un clic. Si cambian temporadas, episodios o estado, recalcula contra Plex; si no cambia, programa el siguiente chequeo. Los fallos siguen D4. `Actualizar TMDb` individual permanece.

**D22 — Episodios futuros no son faltantes.** Un episodio anunciado por TMDb es informativo hasta que sea exigible. Tras su estreno se evalúa disponibilidad en España; sólo con evidencia suficiente y ausencia física puede convertirse en `Falta`.

**D23 — Reconciliación conservadora.** Las coincidencias demostrables y archivos combinados se resuelven automáticamente. Si hay varias interpretaciones razonables, PikoFilm no adivina: lo lleva al detalle de Series con evidencia Plex/TMDb, título, numeración, duración y explicación. Las decisiones manuales persisten mientras no cambie el archivo que las sustenta.

**D24 — Resumen funcional de cambios.** Cuando una serie cambia por automatización se conserva un resumen funcional —p. ej. temporada añadida, episodios nuevos, episodio perdido en Plex, archivo sin correspondencia, disponibilidad ES confirmada—. No sustituye a los logs de Operaciones; sirve para explicar “qué cambió” en la experiencia diaria.

## Series · estado final recuperado del cierre funcional

**D25 — Controles manuales siempre disponibles.** Automatizar mantenimiento nunca elimina el control por serie. Desde su ficha deben mantenerse Plex, TMDb, disponibilidad España y las decisiones/reaperturas de anomalías que correspondan.

**D26 — `Atención` significa intervención humana.** Una serie que sólo está esperando un proceso automático no debe contaminar el contador principal de trabajo humano.

**D27 — `Seguimiento automático` es un estado de primera clase.** Mantenimiento vencido, actualización en curso o retry recuperable se presenta como seguimiento del sistema, no como una tarea que el usuario tenga que pulsar para desbloquear.

**D28 — `Al día` significa ausencia de trabajo real.** Una serie queda al día cuando no requiere decisión humana y no existe una anomalía funcional pendiente; el sistema puede conservar su próxima fecha de mantenimiento sin convertirla en incidencia.

**D29 — Dos superficies de Series.** Se conservan la pantalla general y la ficha de detalle. La general sirve para triage/consulta diaria rápida; la ficha es el workbench de diagnóstico y resolución.

**D30 — El sync global no exige un segundo clic.** Tras `Sincronizar Plex`, cualquier serie cambiada se procesa en detalle automáticamente. La fila no debe ofrecer `Actualizar Plex` como requisito para continuar; ese control queda como ejecución manual bajo demanda.

**D31 — El vencimiento TMDb no exige un clic.** Una fila `TMDb pendiente` es mantenimiento automático/seguimiento, no una tarea manual obligatoria. El botón individual existe para forzar la actualización cuando el usuario quiera.

**D32 — Próximos episodios son información, no deuda.** Deben poder mostrarse en la ficha sin elevar atención ni inflar faltantes.

**D33 — La disponibilidad ES es el gate de exigibilidad física.** Un episodio ya emitido pero sin evidencia suficiente de disponibilidad en España no se declara faltante en Plex.

**D34 — `UNKNOWN` se reintenta, no se deriva a trabajo humano por caducidad.** Cada chequeo sin evidencia reinicia su ventana automática de 14 días; un fallo de proveedor sigue la política D4.

**D35 — Temporada completa en Plex no consume chequeos ES.** `PLEX_COMPLETE` evita consultas de disponibilidad mientras la cobertura permanezca completa; si deja de estarlo, la disponibilidad vuelve a evaluarse.

**D36 — Cambios de referencia reactivan sólo lo necesario.** Nueva temporada/episodio o evidencia invalidada debe recalcular el ámbito afectado sin destruir correcciones manuales válidas ni reiniciar indiscriminadamente toda la serie.

**D37 — Archivos combinados cuentan como cobertura válida.** Uno o varios archivos que demuestren cubrir episodios oficiales se marcan como cobertura combinada y no generan falsos faltantes.

**D38 — Extras y archivos Plex sin correspondencia se resuelven con evidencia.** La automatización resuelve sólo lo demostrable; los casos ambiguos permiten decisión manual, reapertura y caducidad de la decisión cuando cambia la evidencia física.

**D39 — Una desaparición de Plex no borra PikoFilm.** El comportamiento existente se conserva: el elemento físico pasa a `active=false`, registra `missing_since`/estado `missing` y el título sigue en la BBDD maestra. Plex no decide la existencia editorial del título.

**D40 — Ausencia física no equivale a deuda editorial ni de consumo.** Los estados físicos de Plex se usan para calidad/cobertura; nunca para inferir contenido “por ver”, y no eliminan títulos del catálogo maestro.

**D41 — El motivo del cambio debe ser visible sin abrir Operaciones.** Lista y ficha pueden explicar el cambio funcional reciente usando D24; el detalle técnico sigue fuera del flujo normal.

**D42 — Series se optimiza para uso diario.** Es la superficie más viva de Calidad: prioridad a rapidez, lectura accionable, pocos clics y coherencia global. El primer diseño UX lo resuelve el sistema de producto; se ajusta después de probarlo, no mediante una especificación verbal exhaustiva del usuario.

## PikoQuality

**D43 — Sin caducidad por tiempo.** PikoQuality cambia por evidencia técnica/fórmula, no porque hayan pasado N días.

**D44 — Archivo nuevo/cambiado dispara captura y recálculo.** La cadena de análisis técnico debe quedar enlazada al cambio físico detectado por el sync Plex, sin crear una tarea manual ordinaria.

**D45 — Fingerprint gobierna vigencia técnica.** Una decisión/cálculo ligado a un archivo deja de ser evidencia vigente cuando cambia su fingerprint relevante; se recalcula sobre el archivo actual.

**D46 — Cambio de fórmula se procesa progresivamente.** Una nueva versión de PikoQuality puede invalidar cálculos anteriores y debe recalcularse de forma controlada, sin convertir toda la biblioteca en trabajo humano.

**D47 — C6/Batch técnico no es la UX normal.** Los controles de barrido técnico masivo pertenecen a Operaciones/mantenimiento. Calidad muestra estado y decisiones, no obliga a lanzar manualmente un C6 para mantener la biblioteca.

**D48 — Recalcular título individual permanece.** La automatización global nunca elimina `Recalcular ahora` sobre una entidad concreta.

**D49 — Prioridad PikoQuality es informativa/accionable, no una cola obligatoria.** La salud, distribución y prioridad ayudan a elegir dónde mirar; el usuario no queda forzado a procesar una cola transversal en un orden impuesto.

**D50 — Fallos PikoQuality siguen la política común.** Retry automático espaciado; sólo un fracaso persistente o una decisión funcional real merece atención del usuario. Operaciones conserva la traza.

## Datos, ratings y PikoScore

**D51 — La caducidad de ratings se resuelve automáticamente.** No se convierte por sí sola en trabajo humano en Calidad.

**D52 — PikoScore sólo se recalcula cuando corresponde.** Si el refresco de ratings no cambia los valores que alimentan PikoScore, no se fuerza un recálculo inútil.

**D53 — Se mantiene la cadencia adaptativa de D10.** La edad del estreno determina la frecuencia; no hay una fecha fija universal para todos los títulos.

**D54 — Estructura incompleta se rellena por hueco real.** DATA-001 actúa sobre faltantes, no sobre desacuerdos entre proveedores ni sustitución automática de un dato presente.

**D55 — Valor incorrecto y valor ausente son problemas distintos.** Un dato existente que el usuario considera erróneo se corrige mediante el flujo de corrección/override, no mediante el completador de huecos.

**D56 — Override manual tiene precedencia.** La procedencia debe permitir saber que un valor es manual y protegerlo hasta `Volver a automático`.

**D57 — PikoFilm no arbitra discrepancias IMDb/FA/TMDb por sistema.** Diferencias entre fuentes pueden coexistir; no se crea una cola humana sólo porque dos proveedores difieran.

**D58 — Deuda vieja de frescura se absorbe progresivamente.** No se lanza una tormenta de llamadas ni se reinician timestamps históricos sólo por activar V4.

**D59 — Controles por título permanecen.** Actualizar ratings, completar/corregir datos y recalcular PikoScore siguen accesibles individualmente aunque exista mantenimiento automático.

## Personas

**D60 — Filmografía usa la política adaptativa D11.** La misma ventana de 30 días no se aplica universalmente a todas las personas.

**D61 — No se resetea la historia de refresco.** V4 reutiliza `filmography_refreshed_at` y estados previos; el scheduler sólo trabaja lo vencido/relevante.

**D62 — No existe refresco masivo indiscriminado de todas las personas.** El mantenimiento es progresivo y prioriza personas relevantes; no se fuerza un barrido simultáneo de miles de personas.

**D63 — Refresco individual de Persona siempre disponible.** Buscar/abrir una persona concreta permite forzar su proceso aunque el scheduler la considere vigente.

**D64 — Fallos de Personas siguen D4.** Un proveedor caído o error recuperable no convierte automáticamente la persona en una tarea humana.

## Identidad y validación

**D65 — Identidad válida es estable.** No tiene TTL ni refresco periódico. Los procesos automáticos no la reabren por antigüedad.

**D66 — Sólo una corrección explícita reabre una identidad validada.** Las ambigüedades reales anteriores a validación sí pueden necesitar decisión humana; una identidad ya aceptada no se cuestiona silenciosamente.

## Recuperación Lifecycle

**D67 — Recuperación sólo representa incoherencia real.** `sin-estado`/huérfanos no es una cola de mantenimiento normal ni un lugar donde enviar cualquier fallo.

**D68 — Primero se intenta continuar/recalcular automáticamente.** Un estado recuperable por Lifecycle Continuation no debe convertirse en trabajo manual si el sistema puede resolverlo de forma segura.

**D69 — Reinicio manual conserva la entidad.** La recuperación recalcula el estado funcional sin borrar la película ni su asociación Plex válida; es distinta del reset completo de Películas definido en D19.

**D70 — El fallo técnico de recuperación pertenece a Operaciones.** Calidad explica el bloqueo funcional; logs, executor, stack/eventos e intentos detallados viven en Operaciones.

## Calidad global y cierre funcional

**D71 — No hay una cola transversal obligatoria.** El usuario puede elegir trabajar Series, Películas, Datos, Personas, etc.; Calidad no impone una lista única que mezcle todos los dominios y fuerce un orden de trabajo.

**D72 — La portada es radar/hub, no un duplicado de cada cola.** Debe resumir **Requieren atención**, **En seguimiento automático** y **Al día**, explicar el motivo y llevar al dominio correcto. El diagnóstico/resolución vive donde corresponde.

**D73 — Cierre funcional de Calidad.** Con los contratos anteriores, Calidad queda funcionalmente cerrada para pasar a UX. Se preservan todas las capacidades existentes que sigan siendo válidas, los controles individuales y la separación Calidad/Operaciones. No se empieza implementación hasta cerrar la estructura UX.

## UX · decisiones 74 y 75

**D74 — No copiar mecánicamente la fragmentación V3.** En UX se comparan tres estructuras: (A) una página independiente por cada subárea, (B) todo Calidad en una única pantalla, (C) modelo híbrido. El criterio es reducir navegación/ruido sin quitar profundidad a los dominios complejos.

**D75 — Modelo híbrido elegido.** La estructura objetivo es:

- **Calidad** como hub principal de salud funcional.
- **Centro de Calidad común** para las áreas que comparten patrón y no necesitan protagonismo de pantalla: `Identidad + Validación`, `Datos`, `Personas`, `PikoQuality`, `Integridad Lifecycle`.
- **Películas** como página especializada, más ligera: validación física, estados/seguimiento y deuda histórica.
- **Series** como página especializada rica **más ficha de detalle**, porque es el dominio más vivo: temporadas, episodios, Plex, TMDb, España, anomalías y cambios recientes.
- Estados visuales transversales: **Requieren atención / En seguimiento automático / Al día**.

Se descartan tanto la fragmentación de “una pantalla protagonista por cada subárea” como un mega-dashboard único que mezcle todo.

## Boceto UX recuperado

Referencia visual seleccionada: **`V4-UX-014-calidad-estructura-hibrida.png`**, guardada en la biblioteca de trabajo `/PikoFilm/V4/UX-Mockups/`.

El boceto compara explícitamente:

- Opción A — una página por cada área: demasiada fragmentación/navegación.
- Opción B — todo en una sola página: demasiada densidad y pérdida de profundidad para Series/Películas.
- **Propuesta elegida — modelo híbrido**: hub + centro común + páginas especializadas de Películas y Series.

Conclusión funcional del boceto: **“Sí merece la pena separar Series y Películas. El resto debe simplificarse dentro de un Centro de Calidad común.”**

`V4-UX-007-calidad-centro-salud.png` queda como material visual anterior útil para lenguaje/estética, pero su estructura no prevalece sobre D75.

## No negociables recuperados

- Plex sync global **manual**; nunca polling programado.
- Automatización después del sync, no segundo clic obligatorio por entidad.
- Trabajo automático ≠ Atención humana.
- Operaciones es trazabilidad técnica, no paso obligatorio del flujo normal.
- Controles manuales individuales siempre disponibles.
- Decisiones manuales/evidencias se protegen y sólo se invalidan por una causa explícita y trazable.
- PikoFilm sigue siendo la BBDD maestra aunque cambie la presencia física Plex.
- Series mantiene dos pantallas: general + detalle.
- La deuda histórica de Películas no se oculta ni se resetea artificialmente.
- No se introduce recomendación, watched/unwatched ni lógica de consumo.

## Gate de continuidad

A partir de este documento, **ninguna nueva decisión de Calidad se considera cerrada hasta que quede persistida en Git en este mismo contrato (o en el documento canónico que lo sustituya explícitamente)**. El chat sirve para decidir; Git es la fuente de verdad durable.
