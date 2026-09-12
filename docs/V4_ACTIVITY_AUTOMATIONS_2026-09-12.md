# V4 — Automatizaciones en Actividad

Decisión aprobada: Actividad se organiza como `Cronología | Calendario | Automatizaciones`.

## Objetivo

La vista Automatizaciones responde a dos preguntas humanas: **qué hará PikoFilm automáticamente** y **cuándo puede hacerlo**. No sustituye a Calidad ni a Operaciones.

## Inventario vivo

Los procesos automáticos de negocio configurables son los declarados seguros por el planificador V4: MOV-001, SER-002, SER-003, SER-004, DATA-002, PER-001 y PQ-001. La pantalla muestra para cada uno estado activo/pausado, regla que determina cuándo existe trabajo vencido, franja preferida, próxima ejecución realmente planificada, volumen pendiente y última ejecución con su resultado.

Los automatismos de infraestructura se muestran aparte como **Sistema**. PLAN-002 despierta el planificador **una vez por hora**; en ese mismo ciclo revisa vencimientos, reconcilia la planificación y despacha el trabajo que toca. HOME-001 toma el snapshot diario del Dashboard. Son visibles pero no se editan desde esta pantalla.

## Configuración

La configuración funcional se persiste en `app_settings` bajo `automation_schedule_v1`; no requiere una tabla nueva. Cada proceso configurable admite pausa/activación y una **franja preferida** en hora de Madrid. El perfil por defecto es Equilibrado. Cambiar la franja reabre para planificación los bloques automáticos futuros no protegidos; pausar cancela bloques automáticos futuros que todavía no han empezado y no interrumpe una ejecución ya lanzada.

El planificador sigue decidiendo qué entidades están vencidas según las reglas canónicas de cada proceso. La franja controla **cuándo puede arrancar el trabajo**, no altera las reglas de calidad/frescura que determinan cuándo toca revisarlo.

## Observabilidad

Toda modificación manual de automatizaciones se observa mediante PROC-PLAN-001 y debe aparecer posteriormente en Cronología en lenguaje funcional. Los detalles técnicos permanecen en Operaciones.

## Seguridad UX

Nunca se exponen expresiones cron como interfaz principal. Las horas mostradas y configuradas son de `Europe/Madrid`. Los procesos de sistema se muestran como sólo lectura para evitar romper el motor de ejecución.
