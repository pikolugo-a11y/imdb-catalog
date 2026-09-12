# PikoFilm V4 — Auditoría profunda aprobada · 2026-09-12

Estado: **APROBADA por el usuario**.

Baseline auditado: `main` tras PR #528 (`985c5f5d9e03f9ae6508f6909183a19ce1d741ad`).

Esta auditoría sustituye revisiones superficiales por QA de producto completo: coherencia funcional, UX, navegación, estados, acciones, feedback, responsive, accesibilidad, rendimiento, escalabilidad, observabilidad y contraste con Neon vivo.

## Regla de ejecución aprobada

La remediación se hará en **una sola ronda y una sola rama**, sin microparches inconexos, en este orden:

1. Actividad: corregir la semántica de `Requiere atención` para representar necesidad actual y no fallos históricos ya superados; cerrar además problemas de DST, feedback y límites silenciosos.
2. PikoQuality funcional: distinguir captura pendiente, procesamiento, error y C6 pendiente con la misma verdad que Operaciones.
3. Escalabilidad: paginar/limitar de forma explícita Series con miles de episodios y detalles Batch con miles de items.
4. UX común: acciones con estado pending/éxito/error y paginación semánticamente accesible.
5. Responsive y navegación: recuperar Sagas en móvil y evitar pérdida de información funcional en vistas móviles.
6. Superficies legacy: integrar `Calidad · Sin estado` y `Novedades · Criterios` en el lenguaje V4 y hacer visible la configuración importante.
7. QA real de navegador: añadir una capa mínima de tests E2E/UX para navegación, filtros, back/forward, responsive, acciones, empty states y paginación.

## Hallazgos prioritarios aprobados

### P0/P1 — coherencia funcional

- **Actividad**: el KPI de atención puede contar como pendientes ejecuciones históricas `failed/partial/blocked` aunque el estado funcional actual ya se haya resuelto. Durante la auditoría Neon mostraba 252 entradas de atención en Actividad frente a 0 incidencias técnicas activas en Operaciones; 237 procedían de `PROC-MOV-001`, y parte de ellas ya estaban completas o fuera de un estado de atención actual.
- **PikoQuality funcional**: con 63.764 archivos físicos, 63.760 capturas técnicas vigentes, 4 errores técnicos y 0 C6 pendientes, la UI funcional agrupaba los cuatro errores como `sin captura` y comunicaba que PikoFilm estaba actualizando, aunque no hubiera una ejecución activa.
- **Operaciones / detalle Batch**: `getRunDetail()` puede cargar todos los `batch_run_items`; existen runs reales de 9.371, 9.243 y 5.004 items.
- **Series / detalle**: eliminar el antiguo límite silencioso resolvió truncamiento, pero la vista `Todas` puede renderizar una serie completa sin ventana; existe una serie con 2.484 episodios.

### P1/P2 — UX y navegación

- Sagas no está accesible desde el menú móvil aunque el shell detecte `/sagas` como sección activa de `Más`.
- La búsqueda global carece de navegación de resultados con teclado/combobox completo.
- Varios paginadores usan `<Link className="disabled">`, que sigue siendo navegable/focable.
- Persisten formularios sin feedback uniforme en Actividad, Excluidas, PikoQuality unitario, algunas acciones de Sagas/Series y configuración de Novedades.
- `Novedades · Criterios` existe pero carece de entrada visible y mantiene UX legacy.
- `Calidad · Sin estado` funciona pero sigue siendo una isla visual construida con estilos inline.
- En Persona móvil se pierde PikoQuality y se degrada el motivo específico de créditos secundarios.
- Algunos enlaces de ficha sin `tmdb_person_id` usan `href="#"` en vez de mostrarse como texto no interactivo.

### P2 — rendimiento y deuda estructural

- El calendario de Actividad conserva una construcción de días con offset fijo `+02:00`, incompatible con el cambio a UTC+1 de Madrid.
- Actividad tiene límites silenciosos de 600 planes, 250 hijos y 100 errores sin comunicar truncamiento.
- El auto-refresh de Actividad se ejecuta incluso sin actividad viva.
- Operaciones limita incidencias a 20 sin paginación/aviso.
- `Fuente / executor` en Operaciones no representa de forma inequívoca `trigger_source`, executor y fuente de error.
- La Persona detalle puede leer un PikoQuality `evaluated` sin exigir explícitamente versión C6/fingerprint vigente, aunque en la auditoría no se detectaron valores obsoletos vivos.
- El root conserva múltiples generaciones de CSS global histórico; debe racionalizarse con cautela, sin limpieza destructiva indiscriminada.

## Hallazgos verificados como NO bug

- 188 exclusiones frente a 186 Lifecycle `EXCLUDED`: correcto; dos exclusiones corresponden a candidatos que nunca entraron en Catálogo.
- Inicio no tenía el supuesto error fantasma reportado al comienzo; fue un problema de refresco.
- Personas principal ya tiene búsqueda, ranking y paginación corregidos; durante la auditoría las 9.561 personas relevantes estaban al día.
- Lifecycle no presentaba títulos sin estado ni `TECH_PENDING` históricos falsos en el punto auditado.
- C6 estaba vigente para toda evidencia técnica válida: 63.760/63.760; los cuatro restantes eran errores técnicos conocidos.
- `series_quality_runs` y `process_runs` todavía coexisten, pero sus últimos timestamps estaban sincronizados en la comprobación; se considera deuda, no contradicción viva.

## Criterio de salida de esta ronda

La ronda no se dará por cerrada sólo porque compile. Debe cumplir:

- tests contractuales existentes verdes;
- tests nuevos para cada regresión corregida;
- cobertura UX automatizada de navegación, responsive, acciones, estados y paginación;
- build verde;
- PR único revisado y mergeado;
- sin deploy de producción por parte del asistente;
- informe final con qué se cambió, resultado, CI, PR y SHA de merge.

La **validación visual/funcional real en navegador contra producción** se mantiene como paso del propietario después de desplegar `main` en Vercel, de acuerdo con el reparto operativo del proyecto. El CI del repositorio compila deliberadamente con una `DATABASE_URL` placeholder y no dispone de una base funcional aislada equivalente a producción; por tanto no se considera honesto presentar un Playwright contra fixtures o contra una base paralela como sustituto de esa validación real. La parte automatizable queda protegida mediante contratos UX/regresión y build completo.

## Resultado de la remediación

La remediación se implementó íntegramente en una sola rama, `fix/v4-deep-audit-remediation`, y se entrega mediante el PR #529.

- **Actividad**: `Requiere atención` se deriva de la necesidad funcional vigente y deja de convertir fallos históricos ya superados en trabajo humano actual. Se elimina el offset fijo `+02:00`, se respeta `Europe/Madrid`, el auto-refresh sólo permanece activo mientras existe actividad viva y los límites de detalle dejan de ser silenciosos.
- **PikoQuality**: la UX separa captura pendiente, error de captura, C6 pendiente/error y mantenimiento realmente activo. La cobertura usa como denominador el universo físico activo y un error técnico no se presenta como “actualizando” si no hay ejecución viva.
- **Series**: los episodios se sirven paginados en bloques de 100, conservando los contadores del ámbito completo. Las series de miles de episodios dejan de renderizarse de una sola vez.
- **Operaciones**: incidencias, eventos, errores, ejecuciones hijas e items Batch están paginados. `trigger_source` y executor/fuente se filtran de forma separada. Los runs Batch de miles de items mantienen diagnóstico sin cargar el universo completo.
- **Navegación y accesibilidad**: Sagas vuelve a estar disponible en móvil; la búsqueda global incorpora teclado y semántica combobox/listbox; los destinos inexistentes dejan de ser falsos enlaces `#`; los controles de paginación desactivados dejan de ser navegables/focables.
- **Acciones humanas**: se generaliza feedback pending y se añade confirmación reutilizable para acciones delicadas; la cancelación global de Sagas y la exclusión de una obra quedan explícitamente confirmadas.
- **Personas**: la ficha sólo muestra PikoQuality C6 vigente para el fingerprint técnico actual y la versión móvil conserva PikoQuality y el motivo específico de créditos secundarios.
- **Superficies legacy**: `Calidad · Integridad Lifecycle` y `Novedades · Criterios IMDb` quedan integradas en el lenguaje visual/funcional V4; Criterios pasa a tener acceso visible desde Novedades y feedback de guardado.
- **Regresión automatizada**: se añade `test/v4-deep-audit-remediation-contract.test.mjs` al conjunto `test:quality` y se actualizan los contratos afectados para comprobar la arquitectura final en vez de literales o ubicaciones legacy.

### Validación técnica previa al cierre

En el PR #529, el CI #607 (`34692492914`) pasó correctamente:

- validación de workers canónicos;
- self-check PikoScore 3;
- suite contractual global, incluida la nueva cobertura de auditoría;
- navegación sin prefetch masivo;
- lectura acotada de Personas;
- build completo de Next.js.

El cierre definitivo requiere que el último commit documental conserve CI verde y que el PR #529 sea mergeado. No se ha realizado deploy de producción ni escrituras funcionales en Neon durante esta remediación.
