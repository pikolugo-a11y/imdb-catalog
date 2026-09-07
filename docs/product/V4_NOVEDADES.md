# V4 · Novedades

Estado: contrato funcional aprobado (9/9).

## Propósito
Novedades es el centro único de admisión a PikoFilm. Responde: **qué títulos nuevos esperan una decisión o pueden incorporarse al catálogo**. No es Calidad ni un historial de títulos ya resueltos.

## 1. Una cola, varios orígenes
Existe una única cola/candidato canónico. Manual, Plex, Discovery, Sagas y Personas son evidencias/orígenes del mismo circuito, no productos ni pipelines distintos.

**1 IMDb → 1 candidato → N evidencias/orígenes → 1 decisión de admisión.**

Los orígenes pueden aportar contexto (persona, saga, ratingKey Plex, etc.) pero, una vez creado el candidato, no alteran el procesamiento.

## 2. Intake y preparación canónicos
Todos los orígenes deben invocar el mismo contrato de intake y el mismo proceso de preparación de mínimos. No se permiten resolvers separados por origen para decidir si un candidato está listo.

Mínimos de admisión: IMDb válido + título + tipo. Año y cualquier dato adicional son opcionales en Novedades.

## 3. Estados de trabajo
Novedades sólo contiene trabajo pendiente:
- **Lista**: mínimos resueltos; puede admitirse o excluirse.
- **Procesando**: existe una ejecución real activa intentando resolver mínimos. No puede derivarse sólo de un flag persistido antiguo.
- **Atención**: no hay ejecución activa y todavía faltan mínimos o el último intento falló.

Todo candidato en Atención debe ofrecer una salida explícita: reintentar preparación y, cuando proceda, resolver IMDb manualmente.

Catalogada y Excluida no son vistas/estados de Novedades: al resolverse desaparecen. Las exclusiones se consultan/restauran desde Catálogo → Excluidas.

## 4. Priorización y UI
Orden por defecto: Lista → Atención → Procesando; dentro de cada grupo, detección más reciente primero. Filtros de estado y de origen: Manual, Plex, Discovery, Sagas, Personas.

La tabla se diseña alrededor de datos fiables en esta fase: Título, Tipo, IMDb, Origen/evidencias, contexto, Estado, Detectada y Acciones. Año sólo acompaña al título cuando existe. País, ratings, votos, PikoScore y demás no son columnas estructurales de Novedades.

Discovery conserva su control manual y su regla operativa existente: puede lanzarse como máximo una vez cada 7 días. Novedades debe mostrar la última ejecución, la próxima fecha disponible y el botón de lanzamiento; V4 no puede ocultar una capacidad heredada sin decisión explícita.

## 5. Decisión humana
En Lista las acciones principales son **Añadir a PikoFilm** y **Excluir**. Excluir bloquea globalmente el IMDb y exige confirmación clara. Retirar una propuesta manual es distinto: elimina esa evidencia manual, no crea una exclusión global.

Una exclusión no reaparece silenciosamente por otra fuente. Restaurar es una decisión explícita y devuelve el título al circuito canónico.

## 6. Admisión y Lifecycle Continuation
Añadir crea el título inmediatamente con mínimos, conserva todas las evidencias/orígenes y retira el candidato de Novedades. Plex puede conservar además su vínculo físico conocido sin crear un pipeline diferente.

El clic de admisión es la última acción humana ordinaria: debe iniciar **Lifecycle Continuation**, que encadena automáticamente las operaciones individuales canónicas ya definidas y continúa hasta el máximo estado alcanzable sin intervención humana.

La continuación debe ser durable/asíncrona (Railway/Batch Engine), no una cadena larga durante render o request de Vercel. Se detiene sólo al completar, llegar a una decisión humana, encontrar un bloqueo funcional real o un error no recuperable automáticamente.

Al pulsar Añadir, el usuario permanece en Novedades. No se navega automáticamente a una ficha todavía transitoria.

## 7. Observabilidad transversal
Toda continuación automática es monitorizable desde Operaciones: título, origen, inicio, pasos, estado actual, errores, intentos y punto de detención. Un fallo no reinicia ciegamente desde cero; debe poder reanudarse/reintentarse desde estado persistido.

Cada fase sigue siendo responsable de mostrar su bloqueo funcional. Ejemplo: un fallo/bloqueo de Calidad de datos debe ser visible en Calidad de datos; Operaciones conserva simultáneamente la traza técnica completa. Esta regla aplica a cada fase recorrida por Lifecycle.

## 8. Feedback persistente del procesamiento automático
El usuario no debe tener que abrir Operaciones para saber cómo terminó una admisión automática. El Shell mantiene un centro de actividad persistente con los Lifecycle recientes y muestra un aviso cuando una ejecución cambia de procesando a resultado final.

Los resultados funcionales son:
- **Completa** → acceso directo a la ficha.
- **Necesita revisión** → acceso directo al área exacta de Calidad que requiere decisión humana.
- **Error o detención técnica** → acceso a recuperación/Operaciones, sin ocultar el punto de fallo.

Operaciones conserva la traza técnica; el Shell comunica el resultado funcional. Una admisión y su Lifecycle deben quedar enlazados mediante relación padre/hijo para que constituyan una única historia funcional aunque existan registros técnicos separados.

## 9. Resultados recuperables y no leídos
El toast inmediato es sólo una señal; nunca es el único lugar donde vive el resultado. El centro de actividad del Shell conserva un histórico corto de Lifecycle recientes en cualquier pantalla y distingue resultados **no vistos** mediante contador persistente.

Cambiar de página o perder el toast no marca un resultado como visto. Un resultado se considera visto cuando el usuario abre su destino desde Actividad. Los resultados recientes siguen disponibles después de navegar o recargar la aplicación; el estado de lectura se conserva en el navegador. Operaciones no es necesaria para conocer el desenlace ordinario.

## No negociables
- No enriquecimiento pesado durante render.
- No columnas diseñadas para datos que Calidad todavía no ha producido.
- No pipelines de preparación distintos por origen.
- No estados “Procesando” eternos sin ejecución activa.
- No automatizaciones opacas: toda mutación automática deja traza en Operaciones.
- Ninguna fase automática puede repetirse indefinidamente sin cambio de Lifecycle: la falta de progreso debe detenerse y quedar trazada.
