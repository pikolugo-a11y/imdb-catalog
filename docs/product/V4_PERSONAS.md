# V4 Personas — contrato funcional

Estado: **implementación autorizada y vertical canónica**. Issue: #476. Issue maestra: #457.

## Propósito

Personas V4 es una superficie de descubrimiento cinematográfico. Permite explorar actores, actrices y directores relevantes a partir de las obras de PikoFilm y detectar filmografía relevante que todavía está fuera del catálogo. No es una pantalla de consumo, seguimiento de visionado ni recomendaciones automáticas.

## Contratos aprobados

1. Personas prioriza descubrimiento y exploración de personas cinematográficamente relevantes; conserva métricas útiles como PikoScore medio.
2. El ranking principal nunca se decide por cantidad bruta de créditos. Créditos marginales o secundarios no pueden dominar por volumen.
3. La apertura por defecto es **Destacados · Relevancia**.
4. La relevancia es una señal interna de ordenación que combina calidad de las obras, tamaño relevante de filmografía con rendimientos decrecientes e importancia general de la persona. No se expone como una nueva valoración al usuario; PikoScore sigue siendo la métrica de calidad visible.
5. Sólo la filmografía relevante participa en el ranking. Los créditos clasificados como `self_or_archive`, `bonus_or_special`, `short` u otros secundarios permanecen fuera del cálculo.
6. La ficha separa obras relevantes en PikoFilm y fuera de PikoFilm. Las externas identificadas pueden enviarse a Novedades. La filmografía se ordena por año descendente y luego por popularidad persistida.
7. `Otros créditos` sigue disponible como vista secundaria con motivo del descarte, sin contaminar relevancia ni PikoScore medio.
8. La tabla principal expone Persona, Rol, Filmografía relevante, PikoScore medio, En Plex y Fuera de PikoFilm. Cobertura y Pendientes dejan de ser métricas protagonistas de Personas.
9. El refresco de perfil/filmografía es una acción manual explícita desde la ficha. Entrar, buscar, filtrar o navegar por Personas no provoca llamadas externas pesadas.

## Relevancia interna

La implementación usa exclusivamente datos ya persistidos en la lectura principal. La señal combina PikoScore medio, cantidad de obras relevantes con función logarítmica y popularidad persistida de la persona. Las funciones logarítmicas introducen rendimientos decrecientes para que acumular muchos créditos no desplace automáticamente a personas con filmografías más importantes y mejor valoradas.

Los coeficientes son un detalle de calibración interno y pueden ajustarse con evidencia real sin convertir la relevancia en una nueva nota editorial visible. Cualquier cambio que altere el propósito funcional del ranking requiere nueva decisión de producto.

## Filmografía y exclusiones secundarias

PROC-PER-001 conserva su clasificación canónica existente:
- títulos ya presentes en catálogo se mantienen relevantes;
- `self`, archivo, host/presenter/commentary se apartan como `self_or_archive`;
- making-of, behind the scenes, featurettes y especiales equivalentes se apartan como `bonus_or_special`;
- metrajes inferiores a 60 minutos se apartan como `short`;
- el resto se conserva como filmografía relevante.

La V4 no modifica esta receta ni la paridad Individual/Batch de PROC-PER-001.

## UX

La vista principal es tabla en escritorio y lista compacta en móvil. La jerarquía visual sigue Shell/Inicio/Catálogo/Ficha V4: dark-first, línea y paneles contenidos, PikoScore en acento cálido y estados funcionales con color reservado al significado. La ficha prioriza identidad, filmografía relevante, PikoScore medio, presencia Plex y obras fuera de PikoFilm; biografía y créditos secundarios quedan progresivamente subordinados.

## Implementación

- Listado: `app/personas/page.js`.
- Ficha: `app/personas/[id]/page.js`.
- Consulta acotada: `lib/people-dashboard.js`.
- Lectura/refresh individual: `lib/people-v2.js` + PROC-PER-001 existente.
- Estilos: `app/personas/personas-v4.css`.
- Regresión V4: `test/personas-v4-contract.test.mjs` incluida en `test:quality`.
- Regresión de rendimiento existente: `test/personas-performance-contract.test.mjs` sigue en CI.
- No requiere migraciones Neon ni cambios operativos Railway.
- El deployment de producción lo realiza manualmente el usuario.
