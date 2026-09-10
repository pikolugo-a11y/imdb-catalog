# PikoFilm V5 — Decisión 64

## Mejora 64 · V5-C064 — Vigilar el uso real del pool de conexiones de Neon

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Neon · Rendimiento · Capacidad · Fiabilidad

**Problema detectado**

PikoFilm dispone de varios procesos y workers que pueden abrir conexiones a Neon de forma concurrente. Incluso con consultas correctas, una presión excesiva sobre el pool puede introducir esperas, errores o degradación si se alcanza o se aproxima demasiado a la capacidad disponible.

**Alcance aprobado**

1. Medir el uso real de conexiones por superficie/proceso/worker cuando sea técnicamente posible.
2. Identificar picos de concurrencia y periodos en los que el pool se aproxime a saturación.
3. Detectar conexiones retenidas más tiempo del necesario o patrones de reutilización ineficientes.
4. No aumentar límites ni cambiar configuración por intuición: cualquier ajuste deberá estar sustentado por evidencia de saturación o ineficiencia real.
5. Si se demuestra un cuello de botella, revisar en este orden: reutilización de conexiones, duración de transacciones/conexiones, concurrencia y, sólo cuando proceda, tamaño/configuración del pool.
6. Evitar que una optimización local de un worker aumente innecesariamente la presión global sobre Neon.
7. Integrar la lectura de capacidad con Operaciones/healthcheck cuando aporte señal útil, evitando telemetría pesada o duplicada.
8. Cualquier cambio de capacidad debe validarse con mediciones antes/después y sin degradar estabilidad.

**Condición de implementación**

El objetivo es reducir conexiones innecesarias y conocer el margen real disponible. No se considerará completada la mejora si sólo se modifica un límite sin demostrar la causa del problema y el efecto del cambio.

**Resultado esperado para el usuario**

PikoFilm tendrá visibilidad sobre la presión real de conexiones a Neon y podrá corregir saturaciones o ineficiencias antes de que se conviertan en errores, sin sobredimensionar recursos por precaución.

**Decisión del usuario:** aprobada.
