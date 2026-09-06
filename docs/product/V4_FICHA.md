# V4 Ficha — contrato funcional

Estado: **implementación autorizada**. Issue canónica: #467.

## Propósito

La Ficha V4 es el detalle unificado de una obra de PikoFilm. PikoFilm sigue siendo una base de datos/colección audiovisual: Plex aporta la verdad física de presencia y archivos, pero la Ficha no controla visionado, progreso ni recomendaciones.

## Contratos aprobados

1. La cabecera identifica la obra y su situación física. PikoScore es la valoración protagonista; ratings externos sólo aportan contexto secundario.
2. La sinopsis y datos editoriales útiles (país, estreno, duración cuando aplica) se muestran sin convertir la cabecera en una ficha técnica masiva.
3. PikoScore se explica con confianza, fuentes/familias y contribuciones comprensibles; nunca se exponen fórmulas o nomenclatura interna.
4. `En Plex` / `Sin Plex` describe sólo presencia física. PikoQuality y datos técnicos aparecen cuando existe copia física y datos válidos.
5. Dirección/creación y reparto principal son navegables a Personas; la Ficha no intenta volcar todos los créditos externos.
6. Las sagas aparecen como contexto compacto y secundario. Se distingue cobertura en PikoFilm y presencia en Plex sin lenguaje de “pendiente de ver”.
7. En series, cada temporada puede mostrar integridad física (`23/23 ✓ Completa`, `22/23 × Pendiente`) y PikoQuality de temporada. `Pendiente` significa archivos/episodios físicos, nunca visionado.
8. Sólo los casos que realmente requieren decisión humana deben aparecer como atención contextual. Los errores técnicos pertenecen a Operaciones.
9. IMDb/TMDb y otros identificadores útiles se mantienen en zona secundaria. Cuando existe una página origen navegable, el identificador abre esa fuente en pestaña nueva.
10. `Excluir de PikoFilm` vive en la Ficha, es secundaria pero visible y exige confirmación.
11. Volver desde la Ficha restaura exactamente el estado de Catálogo o Excluidas recibido en `from`.
12. Los fallos de datos secundarios no bloquean la Ficha. Sólo la ausencia/fallo de identidad imprescindible provoca error global con `Reintentar`.

## UX

La composición visual queda bajo responsabilidad de V4 y debe ser homogénea con Shell/Inicio/Catálogo. La jerarquía es: identidad + PikoScore + estado físico primero; contexto externo, saga, créditos e identificadores después. Sagas y temporadas usan densidad compacta para no comerse la página. Desktop e iPhone mantienen la misma capacidad con composición responsive.

## Implementación

- Ruta canónica: `app/catalogo/[imdbId]/page.js`.
- Estilos V4: `app/catalogo/[imdbId]/ficha-v4.css`.
- Exclusión confirmada: `app/catalogo/[imdbId]/ExcludeTitleForm.js`.
- Resiliencia: `Promise.allSettled` para bloques secundarios + `error.js` con reintento.
- Regresión: `test/ficha-v4-contract.test.mjs` incluido en `test:quality`.
- No requiere migraciones Neon ni cambios operativos Railway.
