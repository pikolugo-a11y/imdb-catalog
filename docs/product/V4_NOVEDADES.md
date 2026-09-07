# V4 · Novedades

Estado: contrato funcional aprobado (7/7).

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

## 5. Decisión humana
En Lista las acciones principales son **Añadir a PikoFilm** y **Excluir**. Excluir bloquea globalmente el IMDb y exige confirmación clara. Retirar una propuesta manual es distinto: elimina esa evidencia manual, no crea una exclusión global.

Una exclusión no reaparece silenciosamente por otra fuente. Restaurar es una decisión explícita y devuelve el título al circuito canónico.

## 6. Admisión y Lifecycle Continuation
Añadir crea el título inmediatamente con mínimos, conserva todas las evidencias/orígenes y retira el candidato de Novedades. Plex puede conservar además su vínculo físico conocido sin crear un pipeline diferente.

El clic de admisión es la última acción humana ordinaria: debe iniciar **Lifecycle Continuation**, que encadena automáticamente las operaciones individuales canónicas ya definidas y continúa hasta el máximo estado alcanzable sin intervención humana.

La continuación debe ser durable/asíncrona (Railway/Batch Engine), no una cadena larga durante render o request de Vercel. Se detiene sólo al completar, llegar a una decisión humana, encontrar un bloqueo funcional real o un error no recuperable automáticamente.

## 7. Observabilidad transversal
Toda continuación automática es monitorizable desde Operaciones: título, origen, inicio, pasos, estado actual, errores, intentos y punto de detención. Un fallo no reinicia ciegamente desde cero; debe poder reanudarse/reintentarse desde estado persistido.

Cada fase sigue siendo responsable de mostrar su bloqueo funcional. Ejemplo: un fallo/bloqueo de Calidad de datos debe ser visible en Calidad de datos; Operaciones conserva simultáneamente la traza técnica completa. Esta regla aplica a cada fase recorrida por Lifecycle.

## No negociables
- No enriquecimiento pesado durante render.
- No columnas diseñadas para datos que Calidad todavía no ha producido.
- No pipelines de preparación distintos por origen.
- No estados “Procesando” eternos sin ejecución activa.
- No automatizaciones opacas: toda mutación automática deja traza en Operaciones.
