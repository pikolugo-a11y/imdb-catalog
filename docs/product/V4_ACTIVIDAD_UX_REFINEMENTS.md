# PikoFilm V4 — Refinamientos UX de Actividad

## Calendario de planificación — vista agenda de 30 días

**Aprobado por validación visual del usuario (2026-09-10).**

La vista `Calendario` de Actividad V4 deja de presentarse como una lista vertical de tarjetas. Debe funcionar como una agenda/calendario visual que permita entender la distribución de carga de un vistazo.

### Contrato UX

- Mostrar los próximos 30 días en una **rejilla semanal de 7 columnas** (lunes a domingo), manteniendo visibles también los días sin trabajo.
- Cada día debe mostrar de forma compacta:
  - fecha;
  - volumen total planificado;
  - nivel de carga;
  - resumen de los tipos de trabajo previstos.
- Los días vacíos deben ser visibles para que el usuario pueda identificar huecos de capacidad.
- Los días con carga alta o anomalías deben destacar visualmente sin ocultar el resto del calendario.
- Al seleccionar un día se mostrará su **detalle diario** con los bloques planificados y las acciones ya existentes: reprogramar, cambiar prioridad, fijar/desproteger y marcar/quitar pico deliberado.
- La cronología funcional sigue siendo una vista separada y no cambia por este refinamiento.
- La rejilla es una transformación de presentación sobre `process_plans`; no crea una fuente de datos paralela ni duplica planificación.
- En pantallas estrechas la UX puede transformarse en agenda por días, preservando días vacíos y detalle diario.

Objetivo: poder detectar en segundos días saturados, días vacíos y oportunidades claras de redistribución sin recorrer una lista de cientos de bloques.
