# PikoFilm V5 — Roadmap canónico de decisiones

Estado: **EN CONSTRUCCIÓN**.

Fuente de candidatos y evidencias: `docs/PRE_V5_DEEP_AUDIT.md`.

Este documento es la fuente canónica de decisiones para PikoFilm V5. El inventario PRE‑V5 permanece como fotografía de auditoría; aquí se registra, una por una, cada decisión del usuario, sus condiciones, prioridad final y alcance. Sólo las mejoras **APROBADAS** forman parte del roadmap de implantación V5.

## Reglas de decisión

- Estados permitidos: **APROBADA**, **RECHAZADA**, **POSPUESTA**.
- Cada decisión se persiste en Git antes de presentar la siguiente mejora.
- Las condiciones o matices del usuario forman parte obligatoria de la decisión.
- Al terminar la revisión, las aprobadas se reordenarán por dependencias, riesgo y prioridad para formar el plan de implantación; el orden de decisión no obliga al orden de desarrollo.
- Regla transversal V5: todo automatismo o proceso relevante aprobado deberá dejar **resultado funcional en Actividad** y **trazabilidad técnica en Operaciones**, salvo excepción expresamente aprobada.
- La sincronización Plex global continúa siendo manual salvo decisión explícita posterior.

---

## Decisiones

### Mejora 1 · V5-C002 — Garantizar que el Activity Planner automático realmente se ejecuta

**Estado:** APROBADA  
**Prioridad definitiva:** P0 si se confirma que actualmente está bloqueado; P1 si funciona y el trabajo queda como hardening preventivo.  
**Categoría:** Fiabilidad · Automatización · Observabilidad

**Problema detectado**

Vercel declara `/api/cron/activity-planner` cada hora y la propia ruta valida `CRON_SECRET`, pero el middleware privado sólo exceptúa explícitamente otro cron (`/api/cron/dashboard-snapshot`). Existe por tanto riesgo de que la llamada horaria sea interceptada antes de llegar a la ruta del planificador.

**Alcance aprobado**

1. Comprobar de forma concluyente en producción si `/api/cron/activity-planner` atraviesa el middleware y llega a ejecutar su handler.
2. Si está bloqueado, corregir el acceso de forma estrictamente limitada al cron autenticado; nunca abrir la aplicación ni rebajar la protección privada.
3. Añadir contrato automatizado que cruce `vercel.json`, middleware y autenticación de las rutas cron para impedir que vuelva a existir un cron declarado pero inalcanzable.
4. Verificar ejecución real, no sólo que la ruta devuelve un código HTTP aceptable.
5. Mantener idempotencia y protecciones existentes del planificador.

**Condición añadida por el usuario**

Para aprovechar las superficies V4 ya construidas, **cada ejecución del planificador debe quedar registrada en Actividad y Operaciones**:

- **Actividad:** debe explicar en lenguaje funcional que la planificación automática se revisó y cuál fue el resultado: sin cambios, trabajos creados/lanzados/aplazados, incidencias, etc.
- **Operaciones:** debe conservar la ejecución técnica correlacionada (`run_id`), origen cron/sistema, duración, estado, eventos, errores, métricas y detalle necesario para diagnóstico.
- Ambas vistas deben referirse al mismo hecho canónico/correlación; no se crearán dos fuentes de verdad paralelas.

**Resultado esperado para el usuario**

Cuando PikoFilm diga que revisa automáticamente la planificación cada hora, existirá una garantía verificable de que realmente ocurre y será posible comprobar qué hizo desde Actividad y diagnosticar cómo se ejecutó desde Operaciones.

**Decisión del usuario:** aprobada con la condición obligatoria de observabilidad en Actividad + Operaciones.

### Mejora 2 · V5-C001 — Retirar por completo el polling legado de Lifecycle

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Defecto · Eficiencia · Limpieza legacy

**Problema detectado**

Producción ha registrado miles de solicitudes diarias a `/api/lifecycle-activity` y el componente legado `LifecycleActivity` mantiene un polling cada 4 segundos, aunque V4 sustituyó esa experiencia por la superficie canónica de Actividad.

**Alcance aprobado**

1. Identificar de forma concluyente todos los consumidores actuales de `LifecycleActivity` y `/api/lifecycle-activity` antes de eliminar nada.
2. Confirmar que ninguna capacidad vigente de V4 depende de ese polling.
3. Retirar el componente legado, su polling y el endpoint cuando el consumer sweep demuestre que son innecesarios.
4. Añadir protección automatizada para impedir que el endpoint o un polling equivalente reaparezcan por accidente.
5. Verificar tras implantación, con métricas/logs de producción, que las llamadas residuales desaparecen o quedan reducidas únicamente a algún consumidor explícitamente justificado.
6. No sustituir el polling antiguo por otro mecanismo periódico equivalente si no existe una necesidad funcional real.

**Observabilidad y regla transversal**

La eliminación de ruido legacy no debe crear nueva actividad artificial. Las tareas técnicas de migración, verificación o cualquier incidencia relevante durante la retirada deben quedar trazadas en **Operaciones**; si provocan un efecto funcional visible para el usuario, también deben quedar reflejadas en **Actividad**, compartiendo la correlación canónica correspondiente.

**Resultado esperado para el usuario**

PikoFilm conservará la misma funcionalidad V4, pero dejará de ejecutar miles de comprobaciones innecesarias. Esto reduce tráfico, consumo de Vercel/Neon y ruido operativo, además de retirar una pieza antigua que podría confundir futuras evoluciones.

**Decisión del usuario:** aprobada.
