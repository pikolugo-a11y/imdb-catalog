# Auditoría final V4 previa a V5 — 2026-09-12

## 0. Propósito y regla de cierre

Esta es la auditoría final de V4 antes de abrir nuevas decisiones V5. Su objetivo no es volver a diseñar áreas V4 ya cerradas, sino detectar defectos reales, deuda operativa/UX y señales arquitectónicas que deban corregirse antes del cierre o convertirse después en materia prima de V5.

Reglas aplicadas:

- no se despliega Vercel Production;
- no se modifica producción ni datos históricos de Neon;
- no se reabre Calidad V4 ni otras áreas cerradas sin una regresión demostrable;
- no se aprueba ninguna decisión V5 C074+ desde este documento;
- las decisiones V5 C066–C073 ya tomadas se respetan y no se replantean;
- se distingue entre defecto de cierre V4, deuda aceptable para V5 y mera limpieza.

Base auditada: `main` en `d6d32f628812b0d7f34d9649ada2c258a284ec30`.

## 1. Alcance de la auditoría

Se revisaron conjuntamente:

1. Estado real de producción en Vercel, Railway y Neon.
2. Ejecuciones y errores recientes de `process_runs` / `process_run_errors`.
3. Salud del planificador y planes pendientes/retrasados.
4. Integridad básica de Lifecycle, catálogo y Plex.
5. Semántica y presentación de Actividad y Operaciones.
6. Código de sincronización Plex y workers canónicos.
7. Estratos de UI/CSS/componentes y organización del repositorio.
8. Estrategia de tests y su capacidad para detectar fallos reales de runtime.
9. Coherencia con las decisiones V5 C066–C073 ya persistidas.
10. Limitaciones de la propia validación final que conviene resolver en V5.

## 2. Veredicto ejecutivo

V4 está **operativamente estable en su conjunto** y las correcciones recientes han eliminado los problemas graves que aparecieron durante el cierre. En el momento de la auditoría no había ejecuciones raíz atascadas, planes retrasados, planes expirados, planes pendientes de planificación ni trabajo planificado vencido sin despachar. Los cuatro servicios Railway estaban desplegados con éxito y el despliegue Vercel de producción correspondía al commit auditado.

Sin embargo, **no recomiendo declarar V4 definitivamente cerrada todavía**. Queda un defecto de runtime real y reproducible por inspección de código en la ruta de sincronización global de Plex: al tratar determinados timeouts se intenta mutar `error.message` sobre un objeto de error que puede exponer `message` como propiedad de solo lectura. Neon registró dos fallos reales con ese `TypeError`, y la línea problemática sigue presente en `main`. Debe corregirse y protegerse con un test antes del cierre.

El resto de hallazgos no justifica reabrir V4 funcionalmente. Son principalmente pistas de V5: simplificación arquitectónica, unificación visual, observabilidad materializada, workers dormidos de verdad, pruebas de navegador y accesibilidad, higiene de repositorio y reducción de capas heredadas.

## 3. Hallazgo bloqueante de cierre V4

### F-001 — Mutación insegura de errores en timeout Plex

**Severidad:** P1 — corregir antes de declarar V4 cerrada.  
**Área:** Plex / Novedades / runtime de Vercel.  
**Estado:** confirmado por datos + confirmado en código actual.

Neon registró al menos estas dos incidencias recientes en `PROC-NOV-009`, entidad `series_library / plex`:

- 2026-09-11 23:57:06Z
- 2026-09-12 11:54:14Z

Mensaje:

`TypeError: Cannot set property message of [object Object] which has only a getter`

La implementación actual de `lib/plex-sync.js`, función `get(...)`, captura un error de `fetch`/`AbortSignal.timeout()` y, al reconocer timeout, hace:

`error.source='plex'; error.retryable=true; error.message='...'`

El objeto lanzado por `fetch` puede ser un `DOMException`/error nativo con propiedades no mutables. Por tanto, el propio manejador de error sustituye el fallo original por un `TypeError` secundario, perdiendo además el diagnóstico funcional real.

**Corrección esperada:** crear un `Error` propio normalizado y preservar `cause`, `source`, `retryable` y contexto, sin mutar el objeto recibido. Añadir test de regresión con un error cuyo `message` sea de solo lectura.

**Nota temporal:** los dos registros preceden al despliegue final `d6d32f6…`, pero el código vulnerable sigue exactamente presente en ese commit. Por eso no se considera un error histórico ya resuelto.

## 4. Salud productiva comprobada

### F-002 — No hay cola operativa atascada

**Severidad:** OK.

Snapshot de Neon durante la auditoría:

- planes `delayed`: 0
- planes `expired`: 0
- planes `pending_planning`: 0
- planes `planned` vencidos >2 h sin `dispatch_run_id`: 0
- ejecuciones raíz `queued/running`: 0
- Lifecycle huérfano respecto a `movies`: 0
- títulos `movies` sin Lifecycle ni exclusión: 0
- estados Lifecycle incompatibles con tipo película/serie: 0

Esto confirma que Actividad/planificador no está escondiendo una cola degradada detrás de una interfaz verde.

### F-003 — El único Plex activo sin IMDb es un caso TMDb-only válido

**Severidad:** OK / no corregir.

El contador bruto devolvía un Plex activo sin IMDb: `Will y Grace`, rating key `156955`. La auditoría de identidad demostró que no es una regresión:

- existe TMDb `74321`;
- candidato catalogado en modo `tmdb_only`;
- identidad manual de Plex registrada;
- `series_reference` apunta a la identidad técnica `tt990049053054057053053`.

Por tanto, no debe volver a marcarse como problema ni forzarse un IMDb inexistente.

### F-004 — Errores históricos “sin resolver” no equivalen a incidencias activas

**Severidad:** P2 de observabilidad, no bloqueo V4.

La tabla contenía 119 filas con `resolved_at IS NULL`. Aplicando la misma semántica que usa Operaciones —ignorar un error cuando existe una ejecución posterior satisfactoria del mismo proceso y entidad— no quedaban grupos activos relevantes en la comprobación anterior de la auditoría.

Conclusión: Operaciones está comportándose correctamente para el usuario, pero el almacenamiento conserva un estado físico de “no resuelto” que no representa la realidad funcional posterior.

Esto no exige reabrir Operaciones V4, pero sí es una señal clara para V5: resolución materializada/compactación de errores para que observabilidad física y observabilidad lógica converjan.

## 5. Infraestructura y workers

### F-005 — El worker técnico “parado” continúa despertando y escribiendo heartbeat

**Severidad:** P2 / candidato fuerte V5.

`worker/technical-snapshot-worker.mjs` mantiene un bucle infinito. Cuando el control está `disarmed`, `paused` o `stopped`, sigue:

1. leyendo `getTechnicalControl(sql)`;
2. escribiendo `heartbeatTechnicalWorker(...)`;
3. registrando el resultado;
4. durmiendo `idleMs`;
5. repitiendo.

El valor por defecto de `TECHNICAL_SNAPSHOT_IDLE_MS` es 10 s, con mínimo 5 s. Los logs de Railway confirman despertares repetitivos aun estando el motor detenido.

Funcionalmente “stopped” significa que no captura trabajo, pero operacionalmente el proceso sigue haciendo tráfico periódico contra Neon y ensuciando logs. Para V5 conviene separar “servicio vivo” de “motor trabajando”: backoff muy largo en estado detenido, evento/NOTIFY, wake-up explícito o mecanismo equivalente.

### F-006 — Warning de módulos Node en el servicio Plex

**Severidad:** P3.

El servicio Plex arranca correctamente pero emite aviso de resolución/tipo de módulo. No produce un fallo funcional, pero añade ruido y ambigüedad al packaging de workers. Debe eliminarse como limpieza técnica V5 o al tocar ese runtime.

### F-007 — Producción protegida impide una auditoría visual automática externa completa

**Severidad:** P2 de proceso de calidad.

El deployment de producción está protegido y las comprobaciones automáticas desde el conector reciben 401, incluso con la ruta temporal de acceso disponible en la integración. Esto no es un defecto de PikoFilm, pero sí deja un hueco: la auditoría de código/runtime puede certificar mucho, pero la última validación renderizada depende de la inspección manual del usuario.

La consecuencia correcta no es quitar protección. La pista V5 es disponer de E2E/smoke tests en un entorno accesible al CI, coherente con V5-C072.

## 6. Actividad y Operaciones — auditoría UX final

### F-008 — La separación conceptual ya es correcta

**Severidad:** OK.

La última iteración corrige el principal problema de comprensión:

- Actividad responde “qué pasó / qué está pasando / qué viene”.
- Operaciones responde “hay algo que hacer / qué puedo lanzar”.
- IDs, procesos y filtros técnicos quedan subordinados a diagnóstico avanzado.

No se recomienda volver a mezclar ambas superficies en V5.

### F-009 — El lenguaje humano depende todavía de payloads estructurados desiguales entre procesos

**Severidad:** P2 / candidato V5.

SER-002 ya emite `activity_summary`, `entity_label` y cambios concretos antes/después. Otros procesos siguen dependiendo de traducciones genéricas a partir de `functional_result`, contadores o joins de lectura.

Riesgo UX: dos procesos técnicamente similares pueden producir niveles de detalle muy distintos en Actividad. V5 debería formalizar un contrato de “resultado humano” para procesos observables: entidad, resumen, cambios, magnitudes y siguiente paso, generado por el propio proceso y no reconstruido ad hoc por cada pantalla.

### F-010 — La resolución lógica de incidencias es invisible como acontecimiento

**Severidad:** P2 / candidato V5.

Operaciones deja de mostrar correctamente una incidencia si un run posterior de la misma entidad/proceso tiene éxito. Sin embargo, no existe necesariamente un evento humano explícito del tipo “PikoFilm se recuperó / el problema quedó resuelto automáticamente”.

Esto puede hacer que una incidencia desaparezca sin explicación. V5 puede mejorar la narrativa de recuperación sin volver a llenar la base de logs: materializar sólo transiciones significativas.

### F-011 — La automatización horaria reduce ruido, pero la cronología conserva historial previo de alta frecuencia

**Severidad:** P3 / no mutar histórico.

Tras pasar PLAN-002 de cada 5 minutos a una vez por hora, los runs históricos anteriores siguen existiendo durante la retención. La agrupación de ruido en Actividad lo hace soportable. No se recomienda reescribir ni borrar manualmente histórico por estética; la retención lo eliminará naturalmente.

### F-012 — UX visual definitiva requiere la última validación humana en producción

**Severidad:** gate manual, no bug conocido.

El código y los contratos validan jerarquía, copies y semántica, pero no sustituyen comprobaciones reales de:

- cortes de texto;
- densidad en móvil;
- foco y navegación real;
- estados vacíos y loading;
- scroll horizontal;
- tamaños táctiles;
- contraste efectivo tras composición CSS;
- comportamiento con datos extremos.

Esta es precisamente una de las razones por las que V5-C072 y V5-C073 siguen siendo decisiones valiosas.

## 7. Deuda de UI / arquitectura frontend

### F-013 — Conviven demasiadas generaciones de CSS

**Severidad:** P1 de mantenibilidad V5.

El árbol de `main` conserva simultáneamente familias como:

- `home-dashboard.css`, `home-dashboard-v2.css`, `home-dashboard-v4.css`, `home-v4.css`;
- `catalog-r4.css`, `catalog-v3.css`, `catalog-v4.css`;
- `series-command-v3.css` y `series-command.css`;
- `excluded-v3.css` y `excluded-v4.css`;
- `sagas-modern.css` y `sagas-v4.css`;
- `operations.css` y `operations-v4.css`;
- estratos globales `v1.css`, `v12.css`, `v2.css`, `v3-shell.css`, `v4-search.css`.

No se afirma que todos estén muertos: algunos pueden seguir importados deliberadamente. El problema es de propiedad y evolución. Un cambio visual simple puede atravesar varias épocas de estilos y producir excepciones locales.

**Pista V5:** consolidar tokens, shell, controles, cards, tablas/listas, estados, responsive y tipografía en un sistema visual único; retirar estilos anteriores sólo tras inventario de imports.

### F-014 — Coexisten componentes/queries con nomenclatura V2/V3/V4

**Severidad:** P2 de mantenibilidad V5.

Ejemplos observados en el árbol:

- `CatalogFiltersV3.js` / `CatalogFiltersV4.js`;
- `StatisticsExplorer.js` / `StatisticsExplorerV4.js`;
- queries y módulos con sufijos `v1`, `v2`, `v3` utilizados junto a pantallas V4;
- restos de `LifecycleActivity` tras sustituir el acceso principal por Actividad.

La numeración histórica deja de explicar cuál es la pieza canónica. V5 debería acabar con “versiones paralelas” y pasar a nombres funcionales estables.

### F-015 — Riesgo de superficies legacy que siguen compilando aunque ya no formen parte del flujo principal

**Severidad:** P2.

Existen rutas/componentes heredados que ya no son la navegación primaria. Mantenerlos sin propietario claro aumenta superficie de pruebas, dependencias y posibilidades de incoherencia.

V5 debe hacer un inventario de rutas realmente accesibles y clasificarlas como: canónicas, compatibilidad/redirect o eliminables. No borrar sólo por nombre antiguo.

## 8. Persistencia, migraciones y estructura del repositorio

### F-016 — Dos directorios de migraciones

**Severidad:** P2 / candidato V5.

Conviven `db/migrations/` y `migrations/`. Aunque tengan orígenes históricos distintos, esto dificulta responder una pregunta básica: “¿qué migraciones constituyen el esquema canónico y en qué orden se aplican?”.

V5 debería tener una única política documentada de migraciones y, si se conservan dos ubicaciones, una razón explícita y una herramienta que valide el orden/aplicación.

### F-017 — Shims extensionless junto a módulos `.js`

**Severidad:** P3.

Existen pares como `lib/db` + `lib/db.js` y `lib/process-runtime` + `lib/process-runtime.js`. Pueden ser compatibilidad necesaria, pero sin documentación parecen duplicados accidentales.

V5: documentar o retirar shims tras comprobar imports y runtime.

### F-018 — Gran acumulación de ramas ya no activas

**Severidad:** P2 de higiene del repositorio.

La API de GitHub devuelve decenas de ramas antiguas `audit/*`, `feat/*`, `fix/*`, `docs/*` ya asociadas a trabajos finalizados. Entre ellas permanecen ramas de auditorías, Actividad, Operaciones, Series y múltiples hotfixes.

No se eliminan en esta auditoría porque sería una mutación no pedida. Antes de iniciar V5 conviene hacer una limpieza explícita, conservando sólo `main` y cualquier rama realmente abierta/necesaria.

Esto también reduce el riesgo de retomar accidentalmente código obsoleto.

## 9. Estrategia de tests

### F-019 — Los contract tests de fuente son útiles pero insuficientes para runtime

**Severidad:** P1 de calidad V5.

Una parte significativa de los tests V4 comprueba patrones de código con `fs.readFileSync` + `assert.match`. Sirven muy bien para proteger contratos arquitectónicos sencillos, pero no ejecutan necesariamente la ruta que protegen.

El bug F-001 ilustra el límite: un test puede verificar que existe timeout/retry y aun así no descubrir que un error nativo no permite mutar `message`.

No se propone eliminar esos tests. V5 debe complementarlos con:

- unit tests de comportamiento;
- integración de procesos canónicos;
- E2E de navegador;
- pruebas de errores reales/fakes con propiedades inmutables.

Esto refuerza V5-C071 y V5-C072.

### F-020 — Necesidad de descubrimiento automático de tests

**Severidad:** ya decidida en V5-C071.

La auditoría no abre una decisión nueva. La coexistencia de muchas suites y contratos aumenta el riesgo de crear un test correcto que nunca forme parte del comando de CI. La decisión ya aprobada de descubrimiento automático ataca exactamente este riesgo.

### F-021 — Accesibilidad necesita automatización además de contratos de copy/markup

**Severidad:** ya decidida en V5-C073.

La revisión de fuente puede detectar atributos o patrones esperados, pero no el resultado completo del árbol renderizado. La decisión V5-C073 sigue bien orientada y se ve reforzada por esta auditoría.

## 10. Observabilidad y semántica operativa

### F-022 — `technical_status` y `functional_result` tienen semánticas distintas y debe preservarse

**Severidad:** OK / documentación V5.

Se observaron runs técnicamente satisfactorios cuyo resultado funcional era `blocked`. Esto no es corrupción: significa “el proceso ejecutó correctamente y concluyó que el trabajo no puede continuar funcionalmente”.

Actividad ya trata `functional_result='blocked'` como atención. V5 no debe colapsar ambos estados en uno solo. Lo que sí conviene es convertir la distinción en contrato explícito común para todas las superficies.

### F-023 — Resolución de errores calculada en lectura

**Severidad:** P2.

Como muestra F-004, la lógica de “ya se resolvió porque hubo un run posterior exitoso” vive en la query de Operaciones. Es correcta para la UI, pero crea dos verdades:

- estado persistido: `resolved_at IS NULL`;
- estado funcional: resuelto por evidencia posterior.

Pista V5: resolver/compactar de forma materializada al cerrar runs o con mantenimiento periódico, conservando trazabilidad sin dejar cientos de falsos no-resueltos.

### F-024 — External-source health debe seguir siendo ligero

**Severidad:** ya decidida en V5-C070.

No apareció evidencia que justifique polling agresivo de TMDb/Watchmode/Plex sólo para pintar health. La auditoría refuerza la decisión C070 de health ligero y oportunista.

### F-025 — Razones humanas de espera/bloqueo siguen siendo necesarias

**Severidad:** ya decidida en V5-C067.

La mejora reciente de Actividad demuestra el valor de explicar “qué pasó” en lenguaje del usuario. V5-C067 debe extender el mismo principio a esperas, backoff y bloqueos de APIs sin mostrar jerga técnica como UX primaria.

## 11. Coherencia con decisiones V5 ya tomadas

La auditoría **no reabre**:

- V5-C066 — dry-run de Batch: RECHAZADA. No se recomienda recrearlo bajo otro nombre.
- V5-C067 — razones humanas de espera/bloqueo: APROBADA.
- V5-C068 — auditoría CI específica de bypass de API governance: RECHAZADA.
- V5-C069 — redefinir gobernanza Watchmode/TMDb sin evidencia: RECHAZADA. Esta auditoría no encontró motivo para tocarla.
- V5-C070 — health ligero de fuentes externas: APROBADA.
- V5-C071 — descubrimiento automático de tests: APROBADA.
- V5-C072 — E2E de navegador sobre flujos críticos: APROBADA.
- V5-C073 — accesibilidad automática en CI: APROBADA.

C074 y siguientes siguen aplazadas hasta cerrar F-001 y declarar V4 definitivamente cerrada.

## 12. Temas candidatos para V5 una vez cerrada V4

Estos temas **no son decisiones ni numeración aprobada**. Son únicamente pistas obtenidas de la auditoría para revisar una a una cuando corresponda:

1. **Contrato único de resultado humano por proceso**: entidad, resumen, cambios, contadores y siguiente paso emitidos por el proceso canónico.
2. **Workers realmente dormidos**: stopped/paused con backoff/evento, no polling de 5–20 s permanente.
3. **Sistema visual único**: consolidar generaciones CSS/componentes y eliminar nomenclatura V2/V3/V4 de las piezas canónicas.
4. **Observabilidad materializada**: resolver/compactar incidencias cuando una ejecución posterior demuestra recuperación.
5. **Normalización de errores inmutables**: nunca mutar errores ajenos; wrapped errors con `cause` y metadatos propios.
6. **Higiene estructural**: ramas antiguas, migraciones, shims, rutas legacy y archivos sin propietario.
7. **Gate de runtime más real**: complementar contracts de fuente con unit/integration/E2E, ya alineado con C071–C073.
8. **Narrativa de recuperación**: cuando PikoFilm arregla solo una incidencia, reflejarlo como transición humana sin convertir Actividad en un log infinito.

## 13. Qué NO debe convertirse en trabajo V5 por esta auditoría

Para evitar scope creep:

- no reintroducir heurísticas de título/duración en reconciliación de Series;
- no rehacer Calidad V4 por estética;
- no cambiar Watchmode/TMDb sin un problema concreto;
- no añadir dry-run Batch;
- no retirar protección de producción para facilitar tests;
- no borrar histórico de Actividad manualmente;
- no tratar identidades TMDb-only válidas como errores;
- no fusionar `technical_status` y `functional_result`.

## 14. Gate final propuesto para cerrar V4

V4 puede declararse cerrada cuando se cumplan estos puntos:

1. Corregir F-001 sin mutar objetos Error externos y añadir test de regresión.
2. CI de PR y `main` verde.
3. Confirmar que el fix no cambia la semántica funcional de `PROC-NOV-009` y que sigue registrando el error original/normalizado con contexto útil.
4. Despliegue de producción realizado por el usuario.
5. Última validación visual/funcional humana de las pantallas críticas: Inicio, Catálogo/ficha, Calidad, Actividad, Operaciones y Novedades.
6. Si esa validación no revela una regresión real, congelar V4 y comenzar el repaso V5 desde las decisiones ya persistidas, usando los temas del apartado 12 como candidatos posteriores.

## 15. Conclusión

La foto final es mucho mejor que la de auditorías anteriores: no hay cola rota, no hay planes atrasados, no hay huérfanos de Lifecycle, los workers están desplegados, Actividad y Operaciones ya tienen una función comprensible y la reconciliación de Series tiene una regla canónica simple.

El único defecto que esta auditoría considera suficientemente serio para impedir el sello final de V4 es F-001. El resto no debe provocar otra ronda interminable de V4: son precisamente las pistas que deben alimentar V5 de forma ordenada y decisión por decisión.
