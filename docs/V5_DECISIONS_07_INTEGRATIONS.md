# PikoFilm V5 — Decisiones Punto 7 · Integraciones externas

Estado: **Fase 2 COMPLETADA — 10/10 propuestas aprobadas**.

Rama: `audit/v5-07-integrations`.

## INT-01 — Retirar la ruta legacy rota de enriquecimiento de Identidad

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Retirar `lib/enrich-title.js` como receta funcional de enriquecimiento y evitar que cualquier UI, proceso o fallback siga usando su modelo heredado.

El refresco de una identidad conocida deberá orquestar únicamente los núcleos canónicos vigentes:

- Identidad IMDb/TMDb mediante los procesos de Identidad/Validación;
- datos estructurales mediante `DATA-001`;
- ratings mediante `DATA-002` y `title_ratings`;
- PikoScore mediante el core V3;
- FilmAffinity legacy deja de actuar como autoridad funcional de la ficha;
- TMDb/OMDb utilizados por los procesos vigentes quedan sujetos a su gobierno canónico.

### Alcance aprobado

- localizar todos los callers directos e indirectos de `enrichTitle()`;
- sustituirlos por orquestación de procesos/núcleos actuales;
- mantener la UX de “Refrescar datos” si sigue aportando valor, pero sin ejecutar la receta legacy;
- eliminar la dependencia funcional de columnas retiradas como `fa_id`, `fa_rating`, `fa_votes`, `tmdb_rating`, `tmdb_votes`, `imdb_rating` e `imdb_votes` en `movies`;
- no realizar borrados destructivos en Neon ni mutar datos históricos como parte de esta decisión de roadmap.

### Motivo

La auditoría del Punto 7 confirmó que `enrich-title.js` sigue teniendo consumers vivos —incluido el refresco de Identidad— pero referencia columnas que ya no existen en el esquema real de Neon y duplica lógica de ratings/PikoScore/FilmAffinity/TMDb que ya dispone de rutas canónicas separadas.

### Límite

Esta aprobación define V5; no autoriza todavía implementar la corrección durante la fase de decisiones salvo petición expresa posterior.

## INT-02 — Gobierno único y obligatorio para TMDb/OMDb/MDBList/Watchmode

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Convertir el gobierno de integraciones externas de Internet en una frontera técnica obligatoria para TMDb, OMDb, MDBList y Watchmode.

Patrón obligatorio:

`Proceso → cliente canónico de fuente → API Governance → proveedor externo`

Queda prohibido que procesos funcionales hagan `fetch()` directo a estos proveedores fuera de su cliente canónico.

### Contrato aprobado

Cada cliente canónico deberá aplicar de forma uniforme:
- timeout explícito;
- rate limit/cuota cuando aplique;
- límite de concurrencia;
- circuit breaker;
- clasificación estándar de 404/429/5xx/timeouts;
- semántica `retryable` coherente;
- observabilidad de llamadas;
- separación entre fallo del proveedor, fallo interno de PikoFilm, input inválido y estado funcional esperado;
- compatibilidad manual/Batch sin duplicar lógica.

Los cores que dependan de una fuente gobernada serán fail-closed: si no disponen del gobierno requerido, no podrán degradar a un fetch directo.

### Alcance por proveedor

- TMDb: eliminar bypasses vivos, incluido identity-resolver y otros callers directos.
- OMDb: incorporar Novedades/omdb-minimum al gobierno común.
- MDBList: consolidar helpers para evitar futuros bypasses.
- Watchmode: integrarlo formalmente en governance con timeout, concurrencia, breaker, métricas y límites explícitos.

### Excepciones

Plex e IMDb datasets no se fuerzan artificialmente a este mismo modelo. Plex tendrá contrato especializado propio como fuente física; IMDb Discovery seguirá tratándose como pipeline de datasets. Wikidata deberá tener cliente canónico propio, pero no se le impondrán límites comerciales que no correspondan.

### Motivo

La auditoría confirmó que el apiGate funciona donde está aplicado, pero existen callers vivos que lo evitan y Watchmode opera en Production completamente fuera del gobierno común.

### Límite

Esta decisión define arquitectura V5. No implementa todavía los cambios ni autoriza mutaciones destructivas.

## INT-03 — Contrato único de errores externos y health real por proveedor

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Crear una taxonomía canónica y obligatoria para errores relacionados con integraciones externas, separando claramente salud del proveedor de fallos internos de PikoFilm.

### Categorías mínimas aprobadas

- `provider_error`: fallo real del proveedor;
- `rate_limited`: límite/cuota/HTTP 429;
- `timeout`;
- `not_found_expected`: 404 funcionalmente esperado;
- `not_found_unexpected`: 404 que revela una inconsistencia;
- `invalid_input`;
- `internal_contract_error`: error interno de PikoFilm, esquema, parser o contrato;
- `degraded_fallback`: la fuente principal falló pero un fallback válido permitió continuar.

Cada error conservará además, cuando aplique: `source`, `step`, estado HTTP, `retryable`, proveedor, entidad y contexto funcional.

### Reglas aprobadas

- `source` deja de equivaler automáticamente a “el proveedor falló”.
- La salud de una integración sólo contabilizará errores realmente atribuibles al proveedor.
- Retry/backoff debe derivarse de la categoría real, no de una etiqueta genérica.
- Un input inválido, una columna inexistente o un bug de contrato interno no se reintentará ni se contabilizará como indisponibilidad del proveedor.
- Los fallbacks válidos deben quedar observados como degradación, no como éxito limpio ni como fallo total.

### Motivo

La auditoría demostró que errores internos como `column "tmdb_rating" does not exist` y `relation "tmdb_external_ids" does not exist` quedaron etiquetados como TMDb, contaminando health, retry y diagnóstico. También se observaron 404 e inputs inválidos marcados como retryable.

### Límite

Esta decisión define el contrato V5; no implementa todavía cambios ni altera datos históricos.

## INT-04 — Cliente Plex canónico con perfiles operativos

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Crear un único cliente canónico para todas las llamadas Plex, manteniendo a Plex fuera del apiGate de APIs públicas.

### Contrato aprobado

El cliente Plex común deberá centralizar:
- timeout explícito;
- retry y máximo de intentos;
- clasificación 404/429/5xx;
- normalización de timeout/conectividad;
- heartbeat durante esperas largas;
- observabilidad;
- semántica `retryable`;
- cancelación/kill switch cuando aplique.

### Perfiles operativos

El cliente podrá exponer perfiles distintos, con parámetros deliberados según el tipo de workload:
- metadata corta;
- inventario de biblioteca;
- inventario masivo de episodios;
- captura técnica;
- discovery del servidor.

No se exige un único timeout para todos los casos; se exige una única implementación y un contrato coherente.

### Alcance

- migrar SER-001, SER-002, NOV-009, Technical y futuros callers Plex al cliente común;
- mantener la interpretación funcional final de un 404 en el proceso caller;
- distinguir técnicamente item inexistente, referencia stale, timeout, conectividad y error HTTP;
- conservar a Plex como fuente física canónica y de historial, sin introducirlo artificialmente en el gobierno de cuotas de TMDb/OMDb/MDBList/Watchmode.

### Motivo

La auditoría detectó tres políticas HTTP Plex coexistentes: Series, NOV-009 y Technical. Series dispone del contrato más robusto; los otros caminos mantienen fetch/retry/timeout diferentes.

### Límite

Esta decisión define V5; no implementa todavía la consolidación ni modifica datos de Plex/Neon.

## INT-05 — Watchmode como integración de primer nivel y alcance limitado

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Formalizar Watchmode como integración de primer nivel de PikoFilm, limitada estrictamente a disponibilidad/streaming en España y sin convertirla en fuente generalista de metadata.

### Contrato funcional aprobado

Definir explícitamente:
- qué preguntas puede responder Watchmode;
- cuándo debe consultarse;
- cuándo TMDb es suficiente y Watchmode no debe llamarse;
- qué respuesta cuenta como evidencia positiva;
- diferencia entre “sin información” y “no disponible”;
- frescura/caducidad de la evidencia;
- coste/cuota máxima;
- comportamiento de SER-004 cuando Watchmode está degradado o caído;
- cuándo corresponde `partial` y cuándo `succeeded` con warning;
- qué datos deben persistirse y cuáles no.

### Frontera

Responsabilidad conceptual de Watchmode:

**confirmar disponibilidad relevante en España cuando TMDb no aporta evidencia suficiente**.

No se usará como sustituto general de TMDb, IMDb, ratings ni metadata editorial.

### Gobierno técnico

Con INT-02 aprobada, Watchmode deberá integrarse en el gobierno común de APIs con timeout explícito, breaker, concurrencia, métricas, clasificación de errores y límites de cuota.

### Motivo

La auditoría confirmó que Watchmode está activo en Production, altera resultados de SER-004 y genera degradación parcial, pero carece todavía de un contrato formal de producto y operación.

### Límite

Esta decisión define V5; no implementa todavía cambios ni modifica datos históricos.

## INT-06 — Matriz canónica de autoridad y fallback por dato

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Definir y versionar en Git una matriz canónica que establezca, para cada dato relevante de PikoFilm, qué fuente tiene autoridad funcional, qué fuentes pueden actuar únicamente como fallback/evidencia y qué fuentes no tienen permiso para sobrescribirlo.

### Principio aprobado

**Que una fuente pueda proporcionar un dato no significa que tenga autoridad para modificarlo.**

Cada integración deberá declarar:
- datos sobre los que tiene autoridad funcional;
- datos que puede aportar sólo como fallback o evidencia;
- datos que no puede sobrescribir.

### Ejemplos de autoridad

- realidad física/presencia: Plex;
- historial de visionado: Plex;
- identidad IMDb ↔ TMDb: IMDb + TMDb, con intervención manual controlada;
- metadata estructural: TMDb como fuente principal, con fallbacks únicamente donde se autoricen;
- ratings: `title_ratings`, alimentado por la cascada canónica DATA-002;
- PikoScore: core PikoScore V3;
- disponibilidad España: TMDb con Watchmode según INT-05;
- Discovery: datasets oficiales IMDb con Wikidata/TMDb para atributos concretos;
- Personas y Sagas: TMDb salvo excepciones explícitas.

### Reglas

- MDBList no podrá sobrescribir metadata estructural sólo porque la devuelva en su payload.
- FilmAffinity legacy no recuperará autoridad funcional sobre campos del catálogo.
- Los fallbacks deberán ser deliberados, documentados y acotados por campo.
- Los procesos y clientes futuros deberán respetar la matriz; no se permiten mezclas oportunistas de fuentes por módulo.
- La matriz deberá facilitar la retirada segura de integraciones residuales al hacer explícitas sus responsabilidades reales.

### Motivo

La auditoría encontró múltiples recetas históricas que mezclaban TMDb, FilmAffinity, Wikidata, OMDb y MDBList de forma distinta según el módulo. Esa ambigüedad de ownership facilita sobrescrituras y dependencias ocultas.

### Límite

Esta decisión define gobierno funcional V5; no implementa todavía cambios ni altera datos históricos.

## INT-07 — Contrato canónico de frescura, caché y reutilización de evidencias externas

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Definir un contrato canónico de frescura por tipo de dato y fuente externa para decidir cuándo reutilizar evidencia persistida y cuándo volver a consultar al proveedor.

### Principio aprobado

**PikoFilm no debe volver a llamar a una integración externa si ya dispone de evidencia suficientemente fresca para la necesidad funcional actual.**

### Metadatos mínimos de vigencia

Cuando aplique, cada evidencia externa deberá poder expresar:
- `fetched_at`;
- `expires_at` o política equivalente;
- fuente;
- estado `fresh / aging / stale`;
- última comprobación con `no_change`;
- motivo de refresco anticipado;
- si la evidencia existente puede seguir utilizándose mientras se actualiza.

### Reglas

- la frescura se define por dato + fuente, no sólo por proveedor;
- identidad, streaming, ratings, personas, sagas, metadata y series pueden tener ventanas diferentes;
- manual, Batch y automático compartirán la misma decisión de vigencia;
- una acción manual de “refrescar” significa garantizar el SLA de frescura, no necesariamente forzar una llamada externa;
- la política V5 debe ser compatible con una futura Adaptive Freshness sin implantar automáticamente esa innovación.

### Motivo

La auditoría confirmó políticas de refresco fragmentadas y evidencia persistida con contratos distintos según dominio. Esto provoca llamadas redundantes, presión innecesaria sobre cuotas y semántica desigual entre manual y Batch.

### Límite

Esta decisión define el contrato V5 de vigencia/reutilización; no implementa aún Adaptive Freshness ni modifica datos históricos.

## INT-08 — Registro único de integraciones y retirada progresiva de clientes duplicados

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Crear un registro canónico versionado en Git que sea el inventario técnico único de integraciones externas y establezca un único cliente oficial por proveedor.

### Contenido mínimo del registro

Cada integración deberá declarar:
- nombre e identificador canónico;
- cliente oficial de PikoFilm;
- procesos autorizados a consumirla;
- datos que puede aportar según INT-06;
- secretos/configuración requeridos;
- timeout/retry/governance aplicables;
- executor permitido;
- estado `active / deprecated / retired`;
- módulos legacy conocidos;
- condición/fecha de retirada cuando aplique.

### Regla aprobada

**Un proveedor externo no puede mantener dos clientes oficiales simultáneamente.**

Durante una migración puede coexistir código antiguo, pero deberá:
- estar marcado `deprecated`;
- no aceptar nuevos callers;
- disponer de protección/tests contra nuevas dependencias;
- retirarse sólo después de confirmar 0 consumers reales.

### Alcance inicial

Consolidar progresivamente:
- FilmAffinity JS duplicado y lógica embebida legacy;
- implementaciones Wikidata duplicadas;
- helper alternativo MDBList;
- callers TMDb directos sustituidos por INT-02;
- clientes Plex sustituidos por INT-04.

### Motivo

La auditoría encontró varias implementaciones por proveedor con semánticas distintas. Esa duplicidad permite que futuros cambios importen accidentalmente una ruta antigua y reintroduzcan bugs, bypasses de governance o autoridad de datos incorrecta.

### Límite

La aprobación no autoriza borrado inmediato. Primero se migran callers, se verifica 0 consumo y después se retira el código correspondiente.

## INT-09 — Discovery externo con contrato propio y separación IMDb/Wikidata/TMDb

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Formalizar `PROC-NOV-001` como una integración compuesta con contrato propio, manteniéndolo fuera del apiGate general pero haciendo explícitas y observables sus fases y responsabilidades.

### Fases canónicas

1. IMDb datasets → candidato base.
2. Wikidata → enriquecimiento de atributos concretos.
3. TMDb → fallback únicamente para atributos autorizados que sigan faltando.

### Contrato aprobado

Cada fase deberá disponer de:
- timeout propio;
- métricas separadas;
- errores atribuidos a la fuente correcta;
- política de caché/frescura compatible con INT-07;
- límites de concurrencia;
- degradación explícita;
- resultado parcial observable cuando aplique.

### Reglas

- eliminar etiquetas combinadas opacas como `wikidata_tmdb` cuando oculten cuál fue la fuente que falló;
- TMDb no se usará como fallback generalista dentro de Discovery;
- cada fuente respetará la matriz de autoridad de INT-06;
- un fallo de enriquecimiento no debe confundirse con fallo del dataset base IMDb;
- Discovery conserva GitHub Actions como runtime mientras no exista otra decisión arquitectónica.

### Motivo

La auditoría confirmó que Discovery es una excepción legítima al gobierno normal de APIs, pero su implementación mezcla IMDb, Wikidata y TMDb con observabilidad y degradación demasiado acopladas.

### Límite

Esta aprobación define V5; no migra el runtime ni implementa todavía cambios en el workflow.

## INT-10 — Health operativo por integración con degradación controlada

**Estado: APROBADA**  
**Fecha: 2026-09-20**

### Decisión

Crear un estado operativo canónico por integración externa, derivado de señales reales y reutilizable por procesos, Batch, Operaciones y UX.

### Estados mínimos

- `healthy`
- `degraded`
- `rate_limited`
- `unavailable`
- `misconfigured`
- `unknown`

### Señales

El estado podrá derivarse, según la integración, de:
- errores reales del proveedor según INT-03;
- latencia y timeouts;
- rate limits/cuota;
- circuit breaker;
- configuración/credenciales;
- éxito reciente;
- disponibilidad de fallback autorizado;
- frescura de evidencia válida.

### Reglas operativas

- Los procesos podrán consultar el health antes de materializar o ejecutar trabajo.
- Una fuente degradada no implica necesariamente fallo total si existe fallback autorizado por INT-06.
- Un proveedor limitado por cuota podrá aplazar trabajo en lugar de provocar fallos masivos.
- Plex inaccesible nunca deberá interpretarse automáticamente como desaparición física masiva.
- Una credencial ausente debe clasificarse `misconfigured` y no generar retries inútiles.
- La UX de Operaciones mostrará el estado resumido y reservará el detalle técnico para drill-down.

### Motivo

La auditoría encontró breakers, errores, partials y fallbacks dispersos sin una representación única del estado operativo real de cada integración.

### Límite

La decisión define el contrato V5; no implementa todavía lógica de suspensión automática ni autonomía adicional fuera de las reglas ya aprobadas.
