# PikoFilm V5 — Innovaciones Punto 6 · Workers y servicios persistentes

Estado: **Fase 3 activa**.

Regla: revisar al menos 5 innovaciones una a una. Sólo las aprobadas se incorporan a `docs/ROADMAP_INNOVADOR.md`.

---

## INNO-WKR-01 — PikoFilm Runtime Fabric

**RECHAZADA.**

### Motivo

La propuesta abstraía los workers físicos en una malla genérica de capacidades capaz de elegir dinámicamente dónde ejecutar cada proceso.

Se rechaza porque, para el uso real y el horizonte próximo de PikoFilm:

- no aporta una mejora funcional clara;
- añade una capa importante de abstracción y complejidad;
- los cuatro workers actuales ya cubren correctamente las necesidades observadas;
- no existe necesidad demostrada de mover dinámicamente procesos entre múltiples infraestructuras;
- el valor potencial futuro no compensa hoy el coste conceptual y operativo.

### Decisión

No se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Invariante derivada

> Una innovación de infraestructura sólo merece entrar en el Road Map Innovador cuando ofrece una mejora comprensible y material para PikoFilm, no únicamente una arquitectura más genérica.


---

## INNO-WKR-02 — PikoFilm Burst Mode

**RECHAZADA.**

### Motivo

La propuesta planteaba aumentar temporalmente el número de workers ante picos extraordinarios de backlog y volver después a una sola réplica.

Se rechaza porque PikoFilm es una aplicación personal con un catálogo de unas 20.000 películas y el volumen real esperado no justifica diseñar autoescalado para escenarios artificiales de miles o decenas de miles de trabajos simultáneos.

En este contexto:

- una réplica por servicio tiene capacidad suficiente según la auditoría real;
- WKR-13 ya gobierna correctamente la concurrencia segura;
- añadir autoescalado introduce complejidad operacional y potencial coste sin una necesidad demostrada;
- un sistema personal debe priorizar simplicidad, fiabilidad y eficiencia sobre elasticidad pensada para plataformas multiusuario.

### Decisión

No se incorpora a `docs/ROADMAP_INNOVADOR.md`.

### Invariante derivada

> Las innovaciones de infraestructura deben dimensionarse para el producto real: PikoFilm es una aplicación personal y no debe diseñarse como una plataforma SaaS masiva sin una necesidad concreta.


---

## INNO-WKR-03 — Shadow Worker

**RECHAZADA.**

### Motivo

La propuesta consistía en ejecutar temporalmente una versión nueva de un worker en modo sombra, con los mismos inputs reales pero sin efectos funcionales, para comparar sus resultados con la versión vigente antes de desplegar.

El usuario la rechaza. No se incorpora al Road Map Innovador.

### Decisión

No se añade a `docs/ROADMAP_INNOVADOR.md`.


---

## INNO-WKR-04 — PikoFilm Job Mode

**RETIRADA — DUPLICADA CON V5. No cuenta para las 5 innovaciones mínimas.**

### Motivo

La propuesta planteaba que los workers arrancasen bajo demanda, procesasen su cola, drenasen y se apagasen al quedar ociosos.

Tras contrastarla con las decisiones ya aprobadas del Punto 6, no constituye una innovación separada:

- WKR-02 ya define idle adaptativo y reducción de polling;
- WKR-05 ya define drain seguro antes de detener un worker;
- WKR-11 ya define wake hint productor→worker;
- WKR-12 ya prepara suspensión física/scale-to-zero por pool una vez demostrados wake, recovery, observabilidad y latencia de arranque.

La diferencia de convertir ese patrón en el comportamiento por defecto de todos los pools es una decisión de implementación/alcance dentro de WKR-12, no una apuesta innovadora independiente.

### Decisión

Se retira de la ronda y no se incorpora a `docs/ROADMAP_INNOVADOR.md`. Debe presentarse una nueva INNO-WKR-04 realmente distinta.


---

## Criterio reforzado de innovación

Tras revisar las primeras propuestas, el usuario exige que las innovaciones del Punto 6 sean **realmente rompedoras** y no extensiones menores de decisiones V5 ya aprobadas.

A partir de este punto, una innovación válida debe explorar cambios estructurales como, por ejemplo:

- sustituir Railway por otra plataforma o modelo de ejecución;
- eliminar una capa tecnológica completa;
- mover workers de cloud a local o viceversa;
- cambiar radicalmente el modelo de ejecución persistente;
- replantear la frontera entre infraestructura local y cloud.

No deben presentarse como innovación ideas que sean simplemente:

- más autoscaling;
- más observabilidad;
- más backoff;
- más concurrencia;
- más variantes de wake/sleep ya cubiertas por WKR-01..WKR-13.

Este criterio se aplica a las innovaciones restantes del Punto 6.


---

## INNO-WKR-04 — PikoFilm Local Core

**APROBADA PARA ESTUDIAR.**

### Visión

Estudiar una arquitectura futura en la que **Railway desaparezca por completo de PikoFilm** y la ejecución persistente pase a un único runtime local situado junto a Plex o dentro de la misma red local.

Arquitectura conceptual:

- Vercel → interfaz web;
- Neon → BBDD central;
- PikoFilm Local Core → ejecución de API/FAST/Plex/Technical;
- Plex → servidor/local media;
- Railway → eliminado.

### Valor potencial

- eliminar cuatro servicios Railway persistentes y su coordinación;
- eliminar diferencias de Docker/Node/restart entre pools cloud;
- reducir latencia y dependencia de red en operaciones Plex;
- permitir acceso local directo a filesystem cuando aporte valor;
- habilitar detección local de cambios físicos de biblioteca;
- simplificar la arquitectura para una aplicación personal, si el runtime local demuestra suficiente disponibilidad y seguridad.

### Qué debe estudiarse antes de cualquier adopción

- disponibilidad real de la máquina que hospede Local Core;
- comportamiento cuando esa máquina esté apagada o aislada;
- actualizaciones y rollback del runtime local;
- autenticación y seguridad de la conexión con Neon;
- exposición mínima de credenciales;
- recovery y trabajo pendiente durante periodos offline;
- compatibilidad con acceso remoto a PikoFilm;
- comparación objetiva de coste, fiabilidad, latencia y mantenimiento frente a Railway;
- relación y posible solapamiento con INNO-02 — PikoFilm Native / Local-First.

### Alcance de la aprobación

La aprobación significa **incorporar la alternativa al Road Map Innovador para estudio**.

No autoriza:

- migrar fuera de Railway;
- instalar todavía software local;
- retirar ningún worker;
- modificar Production;
- asignarla a V5/V6/V7.

### Invariante

> Railway sólo debe eliminarse si una arquitectura local demuestra de forma objetiva que simplifica PikoFilm sin degradar disponibilidad, recovery, seguridad ni acceso remoto.


---

## INNO-WKR-05 — PikoFilm Split Execution

**APROBADA PARA ESTUDIAR.**

### Visión

Estudiar una arquitectura futura que **elimine Railway** separando la ejecución según dónde tenga sentido físico y operativo que viva cada workload.

Arquitectura conceptual:

- Vercel + Neon mantienen aplicación y control central;
- los procesos que sólo necesitan Internet/Neon se ejecutan como **jobs cloud efímeros bajo demanda**;
- un **PikoFilm Local Agent** mínimo, situado junto a Plex, ejecuta únicamente workloads que requieren Plex, filesystem o recursos locales;
- desaparecen los cuatro workers Railway persistentes actuales.

### Cloud jobs candidatos

- TMDb y otras fuentes públicas;
- IMDb/fuentes externas;
- PikoScore;
- Personas;
- enriquecimientos;
- reconstrucciones/read models;
- procesos de calidad que no necesiten Plex local.

### Local Agent candidatos

- Plex;
- inventario físico de biblioteca;
- nombres/rutas/hashes;
- Technical;
- futuras inspecciones directas del filesystem.

### Valor potencial

- eliminar Railway como plataforma persistente;
- no mantener workers cloud encendidos sin trabajo;
- mantener local únicamente la parte que realmente necesita acceso LAN/filesystem;
- desacoplar la infraestructura de Plex del procesamiento puramente cloud;
- comparar proveedores/modelos de durable jobs o container jobs efímeros sin comprometer todavía uno concreto.

### Estudio obligatorio

Debe compararse objetivamente con:

1. arquitectura Railway actual;
2. INNO-07 — PikoFilm Local Core;
3. INNO-02 — PikoFilm Native / Local-First.

El estudio debe incluir coste, latencia, disponibilidad, recovery, seguridad, complejidad, despliegue, mantenimiento, credenciales, acceso remoto y compatibilidad con el Batch Engine.

### Alcance de la aprobación

La aprobación significa **incorporar esta arquitectura como alternativa futura para estudiar**.

No autoriza:

- eliminar Railway ahora;
- elegir proveedor de jobs cloud;
- instalar un agente local;
- modificar Production;
- asignar el cambio a V5/V6/V7.

### Invariante

> La división cloud/local sólo merece sustituir Railway si reduce de forma demostrable la complejidad y coste sin perder durabilidad, recovery ni simplicidad operativa.

---

## Cierre Fase 3 — Punto 6

**COMPLETADA.** Se han revisado individualmente cinco innovaciones válidas del Punto 6:

- INNO-WKR-01 — Runtime Fabric: **RECHAZADA**;
- INNO-WKR-02 — Burst Mode: **RECHAZADA**;
- INNO-WKR-03 — Shadow Worker: **RECHAZADA**;
- INNO-WKR-04 — Local Core: **APROBADA PARA ESTUDIAR** → ROADMAP INNO-07;
- INNO-WKR-05 — Split Execution: **APROBADA PARA ESTUDIAR** → ROADMAP INNO-08.

La propuesta intermedia Job Mode fue retirada por duplicar decisiones V5 y no cuenta dentro de las cinco.
