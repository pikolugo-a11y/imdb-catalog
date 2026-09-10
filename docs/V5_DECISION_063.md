# PikoFilm V5 — Decisión 63

## Mejora 63 · V5-C063 — Versión/fingerprint explícita del esquema de Neon

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Arquitectura · Neon · Despliegues · Fiabilidad · Operaciones

**Problema detectado**

Una versión de PikoFilm puede asumir la existencia de determinadas tablas, columnas, funciones o índices críticos sin disponer hoy de un identificador canónico simple que permita comprobar si Neon está exactamente en el estado esperado. Esto complica la detección temprana de migraciones incompletas o desfases entre código y base de datos.

**Alcance aprobado**

1. Definir una versión o fingerprint explícita y verificable del esquema crítico de PikoFilm.
2. El fingerprint debe cubrir únicamente estructuras relevantes para compatibilidad funcional/técnica, evitando ruido por elementos no críticos.
3. Integrarlo con la Mejora 5 para verificar schema readiness antes de desplegar código dependiente.
4. Integrarlo con el healthcheck de Operaciones aprobado en la Mejora 7.
5. Mostrar en Operaciones el esquema esperado y el detectado con estados comprensibles: correcto, degradado, incompatible o sin evidencia.
6. No sustituye las migraciones: sirve para comprobar que terminaron bien y que el entorno ejecuta la versión de esquema esperada.
7. Debe ser automatizable y utilizable por CI/despliegue sin depender de comprobaciones manuales.
8. Cualquier cambio de fingerprint debe ser trazable junto con la migración o cambio de esquema que lo motiva.

**Observabilidad**

Las verificaciones técnicas de esquema deben quedar en Operaciones con resultado, versión/fingerprint esperado, versión/fingerprint encontrado y fallo concreto cuando exista. No deben generar ruido en Actividad salvo que el desfase tenga una consecuencia funcional real.

**Resultado esperado para el usuario**

PikoFilm podrá saber de forma inmediata si el código y Neon están realmente sincronizados. Si falta una migración o una estructura crítica no coincide, el problema se detectará antes o quedará claramente diagnosticado en Operaciones.

**Decisión del usuario:** aprobada.
