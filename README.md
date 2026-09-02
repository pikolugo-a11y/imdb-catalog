# PikoFilm

**PikoFilm es una base de datos audiovisual personal maestra** para seleccionar, enriquecer, correlacionar con Plex, controlar la calidad y explotar el universo editorial de películas, series y miniseries que el usuario considera relevantes, estén o no físicamente en Plex.

El propósito completo y las reglas permanentes del proyecto están definidos en [`docs/PROJECT_RULES.md`](docs/PROJECT_RULES.md). Toda evolución debe respetar ese contrato.

> **Desarrollo con IA:** cualquier nueva sesión, chat o agente que vaya a trabajar sobre PikoFilm debe comenzar por [`AGENTS.md`](AGENTS.md) y [`docs/AI_DEVELOPMENT_GUIDE.md`](docs/AI_DEVELOPMENT_GUIDE.md). La documentación canónica forma parte de la implementación y debe actualizarse en el mismo bloque que cualquier cambio funcional o arquitectónico.

## Modelo actual

PikoFilm separa cuatro conceptos:

- **Catálogo:** universo editorial y punto único de consulta.
- **Plex:** presencia física real de archivos y sistema de reproducción.
- **Novedades:** única puerta de entrada para Discovery, Plex y altas manuales.
- **Lifecycle:** estado materializado que decide qué proceso corresponde a cada título.

Flujo común:

`Novedades → Identidad → Validación de Identidad → Datos → PikoScore`

Después:

- sin archivo Plex → `COMPLETE`;
- película en Plex → `Validación de película → PikoQuality → COMPLETE`;
- serie en Plex → `Referencia/diagnóstico de episodios → PikoQuality → COMPLETE`.

Las exclusiones están fuera del flujo hasta restauración explícita.

## PikoScore

PikoScore 2.0 combina IMDb, FilmAffinity y TMDb con confianza dependiente del volumen de votos, ajuste contextual para cine español, antigüedad, consenso y un modificador limitado de Rotten Tomatoes/Metacritic.

Actualizar ratings y calcular PikoScore son procesos separados. El cálculo de PikoScore se realiza únicamente con datos ya almacenados.

## Procesamiento

Cada proceso funcional debe tener una única operación canónica. La ejecución individual y cualquier Batch deben reutilizar exactamente ese mismo núcleo de negocio; el Batch sólo puede aportar selección, cola, leases, concurrencia, retry, pausa/reanudación/cancelación y agregación de métricas. Si individual y Batch requieren mantener lógica funcional separada, se considera una desviación arquitectónica prioritaria.

## Stack

- Next.js 15 / React 19.
- Vercel.
- Neon PostgreSQL.
- Plex API.
- TMDb, OMDb, FilmAffinity e IMDb.

## Seguridad y operación

GitHub contiene código, no el catálogo masivo. Neon es la fuente de verdad persistente.

- CI se ejecuta en Pull Requests.
- No hay cron operativo activo.
- Los workflows pesados existentes son manuales y varios son legado pendiente de retirada.
- Los bloques de trabajo terminados se integran mediante PR/CI y merge a `main`.
- Los commits no deben provocar deployment automático.
- **ChatGPT no realiza deployments; el deployment de Vercel lo realiza manualmente el usuario.**

## Documentación canónica

- [`AGENTS.md`](AGENTS.md) — entrada obligatoria para cualquier agente o nueva sesión de IA.
- [`docs/AI_DEVELOPMENT_GUIDE.md`](docs/AI_DEVELOPMENT_GUIDE.md) — contrato de mantenimiento, mapa de impacto documental y reglas de paridad Individual/Batch.
- [`docs/FUNCTIONAL_SPECIFICATION_V2.md`](docs/FUNCTIONAL_SPECIFICATION_V2.md) — especificación funcional actual.
- [`docs/TECHNICAL_SPECIFICATION_V2.md`](docs/TECHNICAL_SPECIFICATION_V2.md) — arquitectura técnica actual.
- [`docs/CANONICAL_DATA.md`](docs/CANONICAL_DATA.md) — modelo canónico de países y géneros.
- [`docs/ROADMAP_FRONTEND.md`](docs/ROADMAP_FRONTEND.md) — mejoras del frontal.
- [`docs/ROADMAP_MIGRATION.md`](docs/ROADMAP_MIGRATION.md) — limpieza/adaptación de legado.
- [`docs/ROADMAP_FUNCTIONAL.md`](docs/ROADMAP_FUNCTIONAL.md) — futuras evoluciones.
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — estado operativo.
- [`docs/PROJECT_RULES.md`](docs/PROJECT_RULES.md) — propósito y reglas permanentes.

La documentación versionada debe describir el sistema vivo. El histórico de versiones anteriores permanece accesible en Git, no como fuente de verdad activa del proyecto.

## No objetivos

PikoFilm no gestiona reproducciones, progreso, visto/no visto, historial de consumo ni hábitos de visionado. Esa responsabilidad pertenece a Plex. PikoFilm gobierna la BBDD audiovisual, no sustituye a Plex como reproductor o gestor de consumo.
