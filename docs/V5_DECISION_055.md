# PikoFilm V5 — Decisión 55

### Mejora 55 · V5-C055 — Detectar anomalías de funcionamiento antes de un fallo claro

**Estado:** APROBADA  
**Prioridad definitiva:** P2.  
**Categoría:** Operaciones · Observabilidad · Fiabilidad · Detección temprana

**Problema detectado**

Algunos procesos pueden degradarse de forma progresiva sin llegar todavía a fallar de forma explícita: aumento anómalo de duración, crecimiento de la tasa de fallos, descenso brusco del volumen procesado u otros cambios relevantes respecto a su comportamiento habitual.

**Alcance aprobado**

1. Incorporar detección simple de anomalías únicamente sobre procesos críticos donde exista una señal útil y suficientemente estable.
2. Usar reglas transparentes y comprensibles basadas en métricas operativas reales; no crear un sistema opaco ni una capa compleja de IA.
3. Priorizar señales como duración anormalmente alta, frecuencia de fallos superior a la habitual, ausencia o descenso anómalo de unidades procesadas y otras desviaciones con utilidad diagnóstica demostrable.
4. Aplicar umbrales conservadores y calibrados con comportamiento histórico representativo para minimizar falsos positivos.
5. No generar alertas por pequeñas variaciones normales ni convertir Operaciones en una superficie ruidosa.
6. Toda anomalía detectada debe enlazar o correlacionarse con la ejecución canónica correspondiente en `process_runs` y, cuando proceda, con sus eventos/errores técnicos.
7. Integrar esta capacidad con las mejoras de salud y frescura ya aprobadas, evitando fuentes de verdad o sistemas de alerta paralelos.

**Condición añadida por el usuario**

La detección debe limitarse a **pocas reglas, sólo sobre procesos críticos y con umbrales suficientemente conservadores para evitar falsos avisos**.

**Observabilidad y ruido**

- **Operaciones:** es la superficie canónica para mostrar y diagnosticar estas anomalías.
- **Actividad:** sólo debe reflejarse si la anomalía tiene una consecuencia funcional real y relevante para PikoFilm; la mera desviación técnica no debe generar ruido funcional.
- La detección no debe crear ejecuciones artificiales duplicadas ni una segunda fuente de verdad.

**Resultado esperado para el usuario**

PikoFilm podrá advertir de una degradación real de un proceso importante antes de que termine convirtiéndose en un fallo evidente, sin llenar Operaciones de avisos irrelevantes.

**Decisión del usuario:** aprobada con alcance limitado a procesos críticos y umbrales conservadores.
