# PikoFilm V1 — alcance funcional

## Principio rector
PikoFilm no es una plataforma de streaming. Sirve para decidir qué incorporar a Plex, correlacionar el catálogo deseado con la biblioteca real y auditar su integridad/calidad.

## Áreas V1

### Inicio
Centro de control: catálogo, cruces Plex, en proceso, incidencias de películas, estado de series y elementos Plex sin cruce.

### Catálogo
Buscador y filtros. Estados visibles: `Falta`, `En proceso`, `En Plex`. Ficha con título español/original, año, duración, géneros, país, sinopsis, puntuaciones, votos, reparto, colección, enlaces y situación Plex.

### Plex
Inventario real separado del catálogo deseado, con foco en cruces y elementos fuera del catálogo.

### Calidad de películas
Identificaciones/ficheros sospechosos y cola resoluble como correcta, incorrecta o aplazada.

### Calidad de series
Motor separado: serie → temporada → episodio. Estados efectivos: presente, faltante confirmado en España, aún no disponible, disponibilidad desconocida y excepción. Una serie puede estar incompleta globalmente y estar al día en España.

### Sagas
Detalle título a título con En Plex / En proceso / Falta y porcentaje de completitud.

### Administración
Estado e historial de sincronizaciones, pipelines y trabajos. No lanza procesos pesados en V1.

## Seguridad
- CI de PR permitido: build de solo lectura, timeout y concurrencia limitada.
- Mantenimiento manual permitido: `workflow_dispatch`, solo lectura y máximo 10 elementos.
- Sin cron.
- Sin workflows que escriban commits.
- Sin despliegues automáticos a Vercel.
- Sin procesamiento masivo en GitHub Actions.
- Sin modificación automática de Plex.
- Sin automatización de descargas.

## Despliegue
La V1 se valida en PR y después se publica mediante un único despliegue manual controlado. Las mejoras posteriores se gestionan como issues y se agrupan antes de nuevos despliegues.
