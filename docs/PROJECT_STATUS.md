# PikoFilm — Bitácora y estado operativo

> **Documento vivo y obligatorio.** Actualizar después de cada hito, deploy, batería de pruebas, incidencia y antes de terminar sesión.

## Estado registrado
**Fecha:** 20/08/2026 (Europe/Madrid)  
**Fase:** evolución UX V3 — Mi Biblioteca / bandeja Plex → Catálogo implementada y pendiente de deployment/aceptación  
**Repositorio:** `pikolugo-a11y/imdb-catalog`  
**Rama operativa:** `main`

## Reglas operativas innegociables
- Deployments Vercel: siempre manuales por el usuario. ChatGPT no despliega.
- Pruebas funcionales/visuales: siempre ejecutadas por el usuario. ChatGPT diseña, dirige y registra.
- No cerrar trabajo funcional antes de deployment + PASS explícito.
- Mantener funcional, técnico y bitácora actualizados.

## Hito actual — Mi Biblioteca
Se ha redefinido `/plex` como bandeja de entrada operativa de elementos presentes físicamente en Plex y todavía ausentes del catálogo. Los ya vinculados quedan únicamente como contexto agregado y se gestionan desde Catálogo/Calidad.

Implementado en `main`:
- tabla compacta como vista principal;
- filtros Todos / Películas / Series, búsqueda y año;
- acción directa **Añadir al catálogo** reutilizando el enriquecimiento individual canónico;
- elementos sin IMDb ofrecen **Resolver identidad**;
- sin ficha intermedia Plex;
- última sincronización + **Actualizar Plex** visibles;
- título original mostrado solo cuando existe dato canónico disponible;
- columna normal `Estado/Listo para añadir` eliminada por redundante;
- `added_at` rotulado **Añadido a Plex**;
- ausencia de año señalada discretamente;
- jerarquía del resumen superior reducida: pendientes como mensaje principal y vinculados como contexto secundario;
- estado vacío `Todo al día`.

Último commit de código/UX del hito antes de documentación: `140b7b1d0c5b0a9100988d917d61c0c103e3ebdd`. Después se actualizaron especificaciones y esta bitácora, por lo que debe desplegarse el HEAD final de `main`, no ese commit intermedio.

## Pendiente de aceptación
1. Deployment manual del HEAD actual de `main` por el usuario.
2. Verificar que producción corresponde exactamente al HEAD desplegado.
3. Prueba visual: jerarquía superior, tabla sin Estado, etiqueta Añadido a Plex y responsive razonable.
4. Prueba funcional con una fila IMDb válida: Añadir al catálogo → alta → la fila desaparece de Mi Biblioteca tras revalidación.
5. Prueba funcional de una fila sin IMDb: Resolver identidad lleva al flujo canónico de Calidad/Identidad.
6. Regresión: Actualizar Plex sigue operativo y la fecha de última sincronización se actualiza cuando corresponde.

## Próximo paso exacto
Usuario despliega manualmente el HEAD actual de `main` en Vercel. Después ChatGPT verifica commit/READY y conduce la batería de aceptación prueba a prueba.

## Documentos a leer al retomar
1. `docs/PROJECT_STATUS.md`.
2. `docs/PROJECT_RULES.md`.
3. `docs/FUNCTIONAL_SPECIFICATION_V2.md`.
4. `docs/TECHNICAL_SPECIFICATION_V2.md`.
5. Issues abiertas y últimos commits de `main`.
